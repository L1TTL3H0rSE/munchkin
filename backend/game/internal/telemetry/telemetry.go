package telemetry

import (
	"context"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/trace"
)

const instrumentationName = "github.com/leinodev/munchkin/backend/game"

const (
	OutcomeSuccess             = "success"
	OutcomeReplay              = "replay"
	OutcomeVersionConflict     = "version_conflict"
	OutcomeIdempotencyConflict = "idempotency_conflict"
	OutcomeExpired             = "expired"
	OutcomeRejected            = "rejected"
	OutcomeRuleViolation       = "rule_violation"
	OutcomeInternalError       = "internal_error"
	OutcomeNoop                = "noop"
)

const (
	ResponseNone     = "none"
	ResponsePass     = "pass"
	ResponseMaterial = "material"
	ResponseAccept   = "accept"
	ResponseDecline  = "decline"
	ResponseCancel   = "cancel"
	ResponseTimeout  = "timeout"
)

type InteractionSignal struct {
	Kind        string
	CloseReason string
	Outcome     string
	Response    string
	StartedAt   time.Time
	CompletedAt time.Time
	Timeout     bool
	Extended    bool
	Stale       bool
	Retry       bool
}

type HTTPStart struct {
	Method string
	Header http.Header
}

type HTTPEnd struct {
	RoutePattern string
	StatusCode   int
	CompletedAt  time.Time
}

type Recorder interface {
	StartHTTP(context.Context, HTTPStart) (context.Context, func(HTTPEnd))
	RecordInteraction(context.Context, InteractionSignal)
}

type noopRecorder struct{}

func Noop() Recorder {
	return noopRecorder{}
}

func (noopRecorder) StartHTTP(
	ctx context.Context,
	_ HTTPStart,
) (context.Context, func(HTTPEnd)) {
	return ctx, func(HTTPEnd) {}
}

func (noopRecorder) RecordInteraction(
	context.Context,
	InteractionSignal,
) {
}

type otelRecorder struct {
	tracer              trace.Tracer
	propagator          propagation.TextMapPropagator
	requestDuration     metric.Float64Histogram
	requestCount        metric.Int64Counter
	interactionDuration metric.Float64Histogram
	interactionCount    metric.Int64Counter
	timeoutCount        metric.Int64Counter
	extensionCount      metric.Int64Counter
	staleCount          metric.Int64Counter
	retryCount          metric.Int64Counter
}

func newOTelRecorder(
	tracer trace.Tracer,
	meter metric.Meter,
	propagator propagation.TextMapPropagator,
) (*otelRecorder, error) {
	requestDuration, err := meter.Float64Histogram(
		"http.server.request.duration",
		metric.WithUnit("ms"),
	)
	if err != nil {
		return nil, err
	}
	requestCount, err := meter.Int64Counter("http.server.request.count")
	if err != nil {
		return nil, err
	}
	interactionDuration, err := meter.Float64Histogram(
		"game.interaction.window.duration",
		metric.WithUnit("ms"),
	)
	if err != nil {
		return nil, err
	}
	interactionCount, err := meter.Int64Counter(
		"game.interaction.response.count",
	)
	if err != nil {
		return nil, err
	}
	timeoutCount, err := meter.Int64Counter(
		"game.interaction.timeout.count",
	)
	if err != nil {
		return nil, err
	}
	extensionCount, err := meter.Int64Counter(
		"game.interaction.material_extension.count",
	)
	if err != nil {
		return nil, err
	}
	staleCount, err := meter.Int64Counter(
		"game.interaction.stale_conflict.count",
	)
	if err != nil {
		return nil, err
	}
	retryCount, err := meter.Int64Counter(
		"game.interaction.retry.count",
	)
	if err != nil {
		return nil, err
	}
	return &otelRecorder{
		tracer:              tracer,
		propagator:          propagator,
		requestDuration:     requestDuration,
		requestCount:        requestCount,
		interactionDuration: interactionDuration,
		interactionCount:    interactionCount,
		timeoutCount:        timeoutCount,
		extensionCount:      extensionCount,
		staleCount:          staleCount,
		retryCount:          retryCount,
	}, nil
}

func (recorder *otelRecorder) StartHTTP(
	ctx context.Context,
	start HTTPStart,
) (context.Context, func(HTTPEnd)) {
	startedAt := time.Now().UTC()
	ctx = recorder.propagator.Extract(
		ctx,
		propagation.HeaderCarrier(start.Header),
	)
	ctx, span := recorder.tracer.Start(
		ctx,
		"http.server.request",
		trace.WithSpanKind(trace.SpanKindServer),
		trace.WithTimestamp(startedAt),
	)
	method := methodClass(start.Method)
	return ctx, func(end HTTPEnd) {
		completedAt := end.CompletedAt
		if completedAt.IsZero() {
			completedAt = time.Now().UTC()
		}
		statusCode := end.StatusCode
		if statusCode == 0 {
			statusCode = http.StatusOK
		}
		attributes := httpAttributes(
			method,
			routeClass(end.RoutePattern),
			statusCode,
		)
		span.SetAttributes(attributes...)
		span.End(trace.WithTimestamp(completedAt))
		options := metric.WithAttributes(attributes...)
		recorder.requestCount.Add(ctx, 1, options)
		recorder.requestDuration.Record(
			ctx,
			float64(completedAt.Sub(startedAt))/float64(time.Millisecond),
			options,
		)
	}
}

func (recorder *otelRecorder) RecordInteraction(
	ctx context.Context,
	signal InteractionSignal,
) {
	startedAt := signal.StartedAt
	if startedAt.IsZero() {
		startedAt = signal.CompletedAt
	}
	completedAt := signal.CompletedAt
	if completedAt.IsZero() {
		completedAt = time.Now().UTC()
	}
	if startedAt.After(completedAt) {
		startedAt = completedAt
	}
	attributes := interactionAttributes(signal)
	_, span := recorder.tracer.Start(ctx, "game.interaction")
	span.SetAttributes(attributes...)
	span.End()
	options := metric.WithAttributes(attributes...)
	recorder.interactionCount.Add(ctx, 1, options)
	recorder.interactionDuration.Record(
		ctx,
		float64(completedAt.Sub(startedAt))/float64(time.Millisecond),
		options,
	)
	if signal.Timeout {
		recorder.timeoutCount.Add(ctx, 1, options)
	}
	if signal.Extended {
		recorder.extensionCount.Add(ctx, 1, options)
	}
	if signal.Stale {
		recorder.staleCount.Add(ctx, 1, options)
	}
	if signal.Retry {
		recorder.retryCount.Add(ctx, 1, options)
	}
}

func SafeStartHTTP(
	recorder Recorder,
	ctx context.Context,
	start HTTPStart,
) (safeContext context.Context, safeEnd func(HTTPEnd)) {
	safeContext = ctx
	safeEnd = func(HTTPEnd) {}
	if recorder == nil {
		return safeContext, safeEnd
	}
	func() {
		defer func() {
			if recover() != nil {
				safeContext = ctx
				safeEnd = func(HTTPEnd) {}
			}
		}()
		safeContext, safeEnd = recorder.StartHTTP(ctx, start)
	}()
	unsafeEnd := safeEnd
	safeEnd = func(end HTTPEnd) {
		defer func() {
			_ = recover()
		}()
		unsafeEnd(end)
	}
	return safeContext, safeEnd
}

func SafeRecordInteraction(
	recorder Recorder,
	ctx context.Context,
	signal InteractionSignal,
) {
	if recorder == nil {
		return
	}
	defer func() {
		_ = recover()
	}()
	recorder.RecordInteraction(ctx, signal)
}

func InteractionKind(value string) string {
	switch value {
	case "combat_response",
		"addressed_response",
		"private_choice",
		"target_response",
		"run_away_response",
		"economy_offer",
		"charity_transfer",
		"theft_response",
		"death_loot_priority":
		return value
	default:
		return "unknown"
	}
}

func CloseReason(value string) string {
	switch value {
	case "",
		"open",
		"all_responded",
		"accepted",
		"declined",
		"cancelled",
		"superseded",
		"deadline_expired",
		"auto_skipped_no_public_action",
		"subject_invalidated",
		"parent_closed",
		"game_finished":
		if value == "" {
			return "open"
		}
		return value
	default:
		return "unknown"
	}
}

func outcomeClass(value string) string {
	switch value {
	case OutcomeSuccess,
		OutcomeReplay,
		OutcomeVersionConflict,
		OutcomeIdempotencyConflict,
		OutcomeExpired,
		OutcomeRejected,
		OutcomeRuleViolation,
		OutcomeInternalError,
		OutcomeNoop:
		return value
	default:
		return OutcomeInternalError
	}
}

func responseClass(value string) string {
	switch value {
	case ResponseNone,
		ResponsePass,
		ResponseMaterial,
		ResponseAccept,
		ResponseDecline,
		ResponseCancel,
		ResponseTimeout:
		return value
	default:
		return ResponseNone
	}
}

func methodClass(value string) string {
	switch strings.ToUpper(value) {
	case http.MethodGet, http.MethodPost, http.MethodOptions:
		return strings.ToUpper(value)
	default:
		return "OTHER"
	}
}

func routeClass(pattern string) string {
	switch {
	case pattern == "GET /healthz":
		return "health"
	case pattern == "POST /api/v1/lobbies":
		return "lobby_create"
	case pattern == "GET /api/v1/lobbies/{gameID}":
		return "lobby_read"
	case pattern == "GET /api/v1/content/{setID}/assets/{assetPath...}":
		return "content_asset"
	case pattern == "POST /api/v1/games/{gameID}/players":
		return "game_join"
	case pattern == "GET /api/v1/games/{gameID}":
		return "game_read"
	case pattern == "GET /api/v1/games/{gameID}/events":
		return "game_events"
	case pattern == "POST /api/v1/games/{gameID}/start":
		return "game_start"
	case strings.HasPrefix(
		pattern,
		"POST /api/v1/games/{gameID}/commands/",
	):
		return "game_command"
	default:
		return "unknown"
	}
}

func statusClass(statusCode int) string {
	switch {
	case statusCode >= 200 && statusCode < 300:
		return "2xx"
	case statusCode >= 300 && statusCode < 400:
		return "3xx"
	case statusCode >= 400 && statusCode < 500:
		return "4xx"
	case statusCode >= 500 && statusCode < 600:
		return "5xx"
	default:
		return "other"
	}
}

func httpAttributes(
	method string,
	route string,
	statusCode int,
) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String("http.request.method", method),
		attribute.String("http.route.class", route),
		attribute.Int("http.response.status_code", statusCode),
		attribute.String("http.response.status_class", statusClass(statusCode)),
	}
}

func interactionAttributes(
	signal InteractionSignal,
) []attribute.KeyValue {
	return []attribute.KeyValue{
		attribute.String(
			"game.interaction.kind",
			InteractionKind(signal.Kind),
		),
		attribute.String(
			"game.interaction.close_reason",
			CloseReason(signal.CloseReason),
		),
		attribute.String(
			"game.interaction.outcome",
			outcomeClass(signal.Outcome),
		),
		attribute.String(
			"game.interaction.response",
			responseClass(signal.Response),
		),
	}
}

func BuildVersion() string {
	if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" {
		return info.Main.Version
	}
	return "unknown"
}

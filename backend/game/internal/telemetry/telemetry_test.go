package telemetry

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	metricdata "go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func telemetryTestRecorder(
	t *testing.T,
) (*otelRecorder, *tracetest.SpanRecorder, *sdkmetric.ManualReader) {
	t.Helper()
	spanRecorder := tracetest.NewSpanRecorder()
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSpanProcessor(spanRecorder),
	)
	metricReader := sdkmetric.NewManualReader()
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(metricReader),
	)
	t.Cleanup(func() {
		_ = tracerProvider.Shutdown(context.Background())
		_ = meterProvider.Shutdown(context.Background())
	})
	recorder, err := newOTelRecorder(
		tracerProvider.Tracer(instrumentationName),
		meterProvider.Meter(instrumentationName),
		propagation.TraceContext{},
	)
	if err != nil {
		t.Fatal(err)
	}
	return recorder, spanRecorder, metricReader
}

func TestHTTPTracePropagationAndBoundedAttributes(t *testing.T) {
	recorder, spans, metrics := telemetryTestRecorder(t)
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/end-turn", func(
		writer http.ResponseWriter,
		request *http.Request,
	) {
		if _, ok := writer.(http.Flusher); !ok {
			t.Fatal("telemetry middleware removed streaming support")
		}
		if request.PathValue("gameID") != "private-game-id" {
			t.Fatalf("game path value=%q", request.PathValue("gameID"))
		}
		writer.WriteHeader(http.StatusConflict)
	})
	request := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/games/private-game-id/commands/end-turn",
		nil,
	)
	request.Header.Set(
		"traceparent",
		"00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
	)
	request.Header.Set("Authorization", "Bearer private-credential")
	request.Header.Set("Idempotency-Key", "private-command-id")
	response := httptest.NewRecorder()
	WrapHTTP(recorder, mux).ServeHTTP(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("status=%d", response.Code)
	}
	ended := spans.Ended()
	if len(ended) != 1 {
		t.Fatalf("spans=%d", len(ended))
	}
	if got := ended[0].Parent().TraceID().String(); got != "0af7651916cd43dd8448eb211c80319c" {
		t.Fatalf("parent trace=%s", got)
	}
	assertSafeAttributes(t, ended[0].Attributes())
	var resourceMetrics metricdata.ResourceMetrics
	if err := metrics.Collect(context.Background(), &resourceMetrics); err != nil {
		t.Fatal(err)
	}
	assertSafeMetricAttributes(t, resourceMetrics)
}

func TestInteractionSignalsSanitizePrivateAndUnboundedValues(t *testing.T) {
	recorder, spans, metrics := telemetryTestRecorder(t)
	completedAt := time.Date(2026, 7, 31, 9, 0, 30, 0, time.UTC)
	recorder.RecordInteraction(
		context.Background(),
		InteractionSignal{
			Kind:        "game-private-game-id",
			CloseReason: "player-private-player-id",
			Outcome:     "credential-private-token",
			Response:    "card-private-card-id",
			StartedAt:   completedAt.Add(-30 * time.Second),
			CompletedAt: completedAt,
			Timeout:     true,
			Extended:    true,
			Stale:       true,
			Retry:       true,
		},
	)
	ended := spans.Ended()
	if len(ended) != 1 {
		t.Fatalf("spans=%d", len(ended))
	}
	assertSafeAttributes(t, ended[0].Attributes())
	values := attributeValues(ended[0].Attributes())
	for _, expected := range []string{
		"unknown",
		"internal_error",
		"none",
	} {
		if !strings.Contains(values, expected) {
			t.Fatalf("attributes %q lack %q", values, expected)
		}
	}
	var resourceMetrics metricdata.ResourceMetrics
	if err := metrics.Collect(context.Background(), &resourceMetrics); err != nil {
		t.Fatal(err)
	}
	assertSafeMetricAttributes(t, resourceMetrics)
	names := metricNames(resourceMetrics)
	for _, expected := range []string{
		"game.interaction.window.duration",
		"game.interaction.response.count",
		"game.interaction.timeout.count",
		"game.interaction.material_extension.count",
		"game.interaction.stale_conflict.count",
		"game.interaction.retry.count",
	} {
		if _, exists := names[expected]; !exists {
			t.Fatalf("metric %q is missing from %v", expected, names)
		}
	}
}

type panicRecorder struct{}

func (panicRecorder) StartHTTP(
	context.Context,
	HTTPStart,
) (context.Context, func(HTTPEnd)) {
	panic("exporter unavailable")
}

func (panicRecorder) RecordInteraction(
	context.Context,
	InteractionSignal,
) {
	panic("exporter unavailable")
}

func TestTelemetryFailureIsFailOpen(t *testing.T) {
	ctx := context.Background()
	safeContext, end := SafeStartHTTP(
		panicRecorder{},
		ctx,
		HTTPStart{Method: http.MethodGet},
	)
	if safeContext != ctx {
		t.Fatal("panic recorder changed request context")
	}
	end(HTTPEnd{StatusCode: http.StatusOK})
	SafeRecordInteraction(
		panicRecorder{},
		ctx,
		InteractionSignal{Outcome: OutcomeSuccess},
	)
	recorder, shutdown, err := New(ctx, Config{Enabled: false})
	if err != nil {
		t.Fatal(err)
	}
	recorder.RecordInteraction(ctx, InteractionSignal{})
	if err := shutdown(ctx); err != nil {
		t.Fatal(err)
	}
}

func TestEnvironmentConfigIsDisabledByDefaultAndBounded(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	t.Setenv("DEPLOYMENT_ENVIRONMENT", "private-tenant-id")
	t.Setenv("SERVICE_VERSION", "")
	config := ConfigFromEnvironment()
	if config.Enabled ||
		config.ServiceName != "munchkin-game" ||
		config.Environment != "unknown" {
		t.Fatalf("disabled config=%#v", config)
	}
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4318")
	t.Setenv("DEPLOYMENT_ENVIRONMENT", "production")
	config = ConfigFromEnvironment()
	if !config.Enabled || config.Environment != "production" {
		t.Fatalf("enabled config=%#v", config)
	}
}

type failingSpanExporter struct {
	calls atomic.Int64
}

func (exporter *failingSpanExporter) ExportSpans(
	context.Context,
	[]sdktrace.ReadOnlySpan,
) error {
	exporter.calls.Add(1)
	return errors.New("collector unavailable")
}

func (*failingSpanExporter) Shutdown(context.Context) error {
	return nil
}

func TestExporterFailureCannotReachGameplayCaller(t *testing.T) {
	exporter := &failingSpanExporter{}
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithSyncer(exporter),
	)
	metricReader := sdkmetric.NewManualReader()
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(metricReader),
	)
	recorder, err := newOTelRecorder(
		tracerProvider.Tracer(instrumentationName),
		meterProvider.Meter(instrumentationName),
		propagation.TraceContext{},
	)
	if err != nil {
		t.Fatal(err)
	}
	SafeRecordInteraction(
		recorder,
		context.Background(),
		InteractionSignal{
			Kind:        "combat_response",
			Outcome:     OutcomeSuccess,
			Response:    ResponseMaterial,
			StartedAt:   time.Now().Add(-time.Second),
			CompletedAt: time.Now(),
		},
	)
	if exporter.calls.Load() != 1 {
		t.Fatalf("export calls=%d", exporter.calls.Load())
	}
	_ = tracerProvider.Shutdown(context.Background())
	_ = meterProvider.Shutdown(context.Background())
}

func assertSafeAttributes(t *testing.T, values []attribute.KeyValue) {
	t.Helper()
	allowed := map[string]struct{}{
		"http.request.method":           {},
		"http.route.class":              {},
		"http.response.status_code":     {},
		"http.response.status_class":    {},
		"game.interaction.kind":         {},
		"game.interaction.close_reason": {},
		"game.interaction.outcome":      {},
		"game.interaction.response":     {},
	}
	for _, value := range values {
		if _, exists := allowed[string(value.Key)]; !exists {
			t.Fatalf("unallowlisted attribute key=%q", value.Key)
		}
		serialized := strings.ToLower(value.Value.Emit())
		for _, forbidden := range []string{
			"private",
			"credential",
			"game-id",
			"player-id",
			"card-id",
			"command-id",
			"bearer",
			"payload",
		} {
			if strings.Contains(serialized, forbidden) {
				t.Fatalf("private attribute %q=%q", value.Key, serialized)
			}
		}
	}
}

func assertSafeMetricAttributes(
	t *testing.T,
	resourceMetrics metricdata.ResourceMetrics,
) {
	t.Helper()
	seen := 0
	for _, scope := range resourceMetrics.ScopeMetrics {
		for _, metricValue := range scope.Metrics {
			switch data := metricValue.Data.(type) {
			case metricdata.Sum[int64]:
				for _, point := range data.DataPoints {
					seen++
					assertSafeAttributes(t, point.Attributes.ToSlice())
				}
			case metricdata.Histogram[float64]:
				for _, point := range data.DataPoints {
					seen++
					assertSafeAttributes(t, point.Attributes.ToSlice())
				}
			}
		}
	}
	if seen == 0 {
		t.Fatal("no metric data points were collected")
	}
}

func attributeValues(values []attribute.KeyValue) string {
	var result strings.Builder
	for _, value := range values {
		result.WriteString(value.Value.Emit())
		result.WriteByte(' ')
	}
	return result.String()
}

func metricNames(
	resourceMetrics metricdata.ResourceMetrics,
) map[string]struct{} {
	result := make(map[string]struct{})
	for _, scope := range resourceMetrics.ScopeMetrics {
		for _, metricValue := range scope.Metrics {
			result[metricValue.Name] = struct{}{}
		}
	}
	return result
}

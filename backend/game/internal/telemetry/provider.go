package telemetry

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

type Config struct {
	Enabled     bool
	ServiceName string
	Version     string
	Revision    string
	Environment string
}

type Shutdown func(context.Context) error

func ConfigFromEnvironment() Config {
	endpointConfigured := strings.TrimSpace(
		os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
	) != ""
	return Config{
		Enabled:     endpointConfigured,
		ServiceName: "munchkin-game",
		Version:     valueOrDefault("SERVICE_VERSION", BuildVersion()),
		Revision:    valueOrDefault("SERVICE_REVISION", "unknown"),
		Environment: environmentClass(
			valueOrDefault("DEPLOYMENT_ENVIRONMENT", "development"),
		),
	}
}

func New(
	ctx context.Context,
	config Config,
) (Recorder, Shutdown, error) {
	if !config.Enabled {
		return Noop(), func(context.Context) error { return nil }, nil
	}
	traceExporter, err := otlptracehttp.New(ctx)
	if err != nil {
		return Noop(), func(context.Context) error { return nil }, err
	}
	metricExporter, err := otlpmetrichttp.New(ctx)
	if err != nil {
		_ = traceExporter.Shutdown(ctx)
		return Noop(), func(context.Context) error { return nil }, err
	}
	res, err := resource.New(
		ctx,
		resource.WithAttributes(
			attribute.String("service.name", serviceName(config.ServiceName)),
			attribute.String("service.version", versionValue(config.Version)),
			attribute.String("service.revision", versionValue(config.Revision)),
			attribute.String(
				"deployment.environment",
				environmentClass(config.Environment),
			),
		),
	)
	if err != nil {
		_ = traceExporter.Shutdown(ctx)
		_ = metricExporter.Shutdown(ctx)
		return Noop(), func(context.Context) error { return nil }, err
	}
	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(
			traceExporter,
			sdktrace.WithMaxQueueSize(512),
			sdktrace.WithMaxExportBatchSize(128),
			sdktrace.WithBatchTimeout(5*time.Second),
			sdktrace.WithExportTimeout(5*time.Second),
		),
		sdktrace.WithResource(res),
	)
	metricReader := sdkmetric.NewPeriodicReader(
		metricExporter,
		sdkmetric.WithInterval(10*time.Second),
		sdkmetric.WithTimeout(5*time.Second),
	)
	meterProvider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(metricReader),
		sdkmetric.WithResource(res),
	)
	recorder, err := newOTelRecorder(
		tracerProvider.Tracer(instrumentationName),
		meterProvider.Meter(instrumentationName),
		propagation.TraceContext{},
	)
	if err != nil {
		_ = tracerProvider.Shutdown(ctx)
		_ = meterProvider.Shutdown(ctx)
		return Noop(), func(context.Context) error { return nil }, err
	}
	shutdown := func(ctx context.Context) error {
		return errors.Join(
			tracerProvider.Shutdown(ctx),
			meterProvider.Shutdown(ctx),
		)
	}
	return recorder, shutdown, nil
}

func serviceName(value string) string {
	if strings.TrimSpace(value) == "munchkin-game" {
		return "munchkin-game"
	}
	return "munchkin-game"
}

func environmentClass(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "development", "test", "staging", "production":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "unknown"
	}
}

func versionValue(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 128 {
		return "unknown"
	}
	return value
}

func valueOrDefault(key string, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

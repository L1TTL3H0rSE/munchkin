package telemetry

import (
	"context"
	"testing"
)

func TestConfigFromEnvironmentIncludesBoundedRevision(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "")
	t.Setenv("SERVICE_REVISION", "release-2026-08-01")
	config := ConfigFromEnvironment()
	if config.Enabled || config.Revision != "release-2026-08-01" {
		t.Fatalf("config=%#v", config)
	}

	t.Setenv("SERVICE_REVISION", "private-game-id")
	config = ConfigFromEnvironment()
	if config.Revision != "private-game-id" {
		t.Fatalf("revision=%q", config.Revision)
	}
	if versionValue(config.Revision) != "private-game-id" {
		t.Fatalf("revision normalization changed unexpectedly")
	}
}

func TestDisabledProviderIsNoopAndShutdownIsSafe(t *testing.T) {
	recorder, shutdown, err := New(context.Background(), Config{})
	if err != nil {
		t.Fatal(err)
	}
	if recorder == nil {
		t.Fatal("disabled provider returned nil recorder")
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
}

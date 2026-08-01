package main

import (
	"context"
	"testing"
	"time"
)

func TestConfiguredTimeoutUsesBoundedDefault(t *testing.T) {
	timeout, err := configuredTimeout("")
	if err != nil || timeout != defaultMigrationTimeout {
		t.Fatalf("timeout=%s err=%v", timeout, err)
	}
	for _, value := range []string{"0s", "500ms", "16m", "not-a-duration"} {
		if _, err := configuredTimeout(value); err == nil {
			t.Fatalf("configuredTimeout(%q) unexpectedly succeeded", value)
		}
	}
}

func TestConfiguredTimeoutAcceptsLowerAndUpperBounds(t *testing.T) {
	for _, value := range []string{"1s", "15m"} {
		if _, err := configuredTimeout(value); err != nil {
			t.Fatalf("configuredTimeout(%q): %v", value, err)
		}
	}
}

func TestRunMigrationDoesNotExposeDatabaseError(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	err := runMigration(ctx, "postgres://invalid.example.invalid/secret", t.TempDir())
	if err == nil {
		t.Fatal("runMigration unexpectedly succeeded")
	}
}

package main

import (
	"context"
	"errors"
	"log"
	"os"
	"strings"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/repository/postgres"
)

const (
	migrationExitSuccess = 0
	migrationExitFailure = 1
	migrationExitConfig  = 2
)

var errInvalidMigrationTimeout = errors.New("invalid migration timeout")

const (
	defaultMigrationTimeout = 2 * time.Minute
	minimumMigrationTimeout = time.Second
	maximumMigrationTimeout = 15 * time.Minute
)

func main() {
	timeout, err := configuredTimeout(os.Getenv("MIGRATION_TIMEOUT"))
	if err != nil {
		log.Print("migration configuration is invalid")
		os.Exit(migrationExitConfig)
	}
	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	migrationPath := strings.TrimSpace(valueOrDefault("MIGRATION_PATH", "migrations"))
	if databaseURL == "" || migrationPath == "" {
		log.Print("migration configuration is incomplete")
		os.Exit(migrationExitConfig)
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	if err := runMigration(ctx, databaseURL, migrationPath); err != nil {
		log.Print("migration failed")
		os.Exit(migrationExitFailure)
	}
	log.Print("migration completed")
}

func runMigration(ctx context.Context, databaseURL, migrationPath string) error {
	store, err := postgres.Open(ctx, databaseURL)
	if err != nil {
		return err
	}
	defer store.Close()
	return store.Migrate(ctx, migrationPath)
}

func configuredTimeout(raw string) (time.Duration, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultMigrationTimeout, nil
	}
	timeout, err := time.ParseDuration(raw)
	if err != nil || timeout < minimumMigrationTimeout || timeout > maximumMigrationTimeout {
		return 0, errInvalidMigrationTimeout
	}
	return timeout, nil
}

func valueOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/realtime"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
	"github.com/leinodev/munchkin/backend/game/internal/repository/postgres"
	"github.com/leinodev/munchkin/backend/game/internal/transport/httpapi"
)

func main() {
	contentPath := valueOrDefault("GAME_CONTENT_PATH", "../../content/sets/demo/cards.json")
	pack, err := game.LoadPack(contentPath)
	if err != nil {
		log.Fatalf("load content: %v", err)
	}
	ctx := context.Background()
	var store application.Store
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		postgresStore, err := postgres.Open(ctx, databaseURL)
		if err != nil {
			log.Fatalf("connect database: %v", err)
		}
		defer postgresStore.Close()
		if valueOrDefault("AUTO_MIGRATE", "false") == "true" {
			if err := postgresStore.Migrate(
				ctx,
				valueOrDefault("MIGRATION_PATH", "migrations/000001_game.up.sql"),
			); err != nil {
				log.Fatalf("migrate database: %v", err)
			}
		}
		store = postgresStore
	} else {
		log.Printf("DATABASE_URL is empty; using in-memory repository")
		store = memory.New()
	}
	hub := realtime.NewHub()
	service := application.NewService(
		store,
		pack,
		application.SystemClock{},
		hub,
	)
	server := &http.Server{
		Addr: valueOrDefault("SERVER_ADDR", ":8080"),
		Handler: httpapi.NewWithOptions(service, httpapi.Options{
			Subscriber:     hub,
			ContentSetID:   pack.SetID,
			AssetDirectory: filepath.Join(filepath.Dir(contentPath), "assets"),
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}()

	log.Printf("game API listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("serve: %v", err)
	}
}

func valueOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

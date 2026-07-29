package realtime

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/application"
)

func TestHubPublishesVersionOnlyInvalidation(t *testing.T) {
	hub := NewHub()
	ctx, cancelContext := context.WithCancel(context.Background())
	defer cancelContext()
	events, cancel := hub.Subscribe(ctx, "game")
	defer cancel()
	event := application.Invalidation{
		Type:       "game.v1.version_advanced",
		OccurredAt: "2026-07-29T10:00:00Z",
		GameID:     "game",
		Version:    7,
		Reason:     "open_door",
	}
	if err := hub.Publish(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	select {
	case received := <-events:
		raw, err := json.Marshal(received)
		if err != nil {
			t.Fatal(err)
		}
		for _, forbidden := range []string{"hand", "deck", "card", "rng", "credential"} {
			if contains(string(raw), forbidden) {
				t.Fatalf("invalidation leaked %q: %s", forbidden, raw)
			}
		}
	case <-time.After(time.Second):
		t.Fatal("invalidation was not delivered")
	}
}

func TestSlowSubscriberReceivesNewestVersion(t *testing.T) {
	hub := NewHub()
	ctx, cancelContext := context.WithCancel(context.Background())
	defer cancelContext()
	events, cancel := hub.Subscribe(ctx, "game")
	defer cancel()
	for version := uint64(1); version <= 3; version++ {
		if err := hub.Publish(context.Background(), application.Invalidation{
			Type:       "game.v1.version_advanced",
			OccurredAt: "2026-07-29T10:00:00Z",
			GameID:     "game",
			Version:    version,
			Reason:     "test",
		}); err != nil {
			t.Fatal(err)
		}
	}
	select {
	case received := <-events:
		if received.Version != 3 {
			t.Fatalf("slow subscriber got version %d, want 3", received.Version)
		}
	case <-time.After(time.Second):
		t.Fatal("newest invalidation was not delivered")
	}
}

func contains(value, needle string) bool {
	for index := 0; index+len(needle) <= len(value); index++ {
		if value[index:index+len(needle)] == needle {
			return true
		}
	}
	return false
}

package realtime

import (
	"context"
	"sync"

	"github.com/leinodev/munchkin/backend/game/internal/application"
)

type Hub struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan application.Invalidation]struct{}
}

func NewHub() *Hub {
	return &Hub{subscribers: make(map[string]map[chan application.Invalidation]struct{})}
}

func (hub *Hub) Publish(_ context.Context, event application.Invalidation) error {
	hub.mu.RLock()
	defer hub.mu.RUnlock()
	for channel := range hub.subscribers[event.GameID] {
		select {
		case channel <- event:
		default:
			// Keep the newest invalidation without making the authoritative
			// transaction wait for a slow connection.
			select {
			case <-channel:
			default:
			}
			select {
			case channel <- event:
			default:
			}
		}
	}
	return nil
}

func (hub *Hub) Subscribe(
	ctx context.Context,
	gameID string,
) (<-chan application.Invalidation, func()) {
	channel := make(chan application.Invalidation, 1)
	hub.mu.Lock()
	if hub.subscribers[gameID] == nil {
		hub.subscribers[gameID] = make(map[chan application.Invalidation]struct{})
	}
	hub.subscribers[gameID][channel] = struct{}{}
	hub.mu.Unlock()

	var once sync.Once
	cancel := func() {
		once.Do(func() {
			hub.mu.Lock()
			delete(hub.subscribers[gameID], channel)
			if len(hub.subscribers[gameID]) == 0 {
				delete(hub.subscribers, gameID)
			}
			close(channel)
			hub.mu.Unlock()
		})
	}
	go func() {
		<-ctx.Done()
		cancel()
	}()
	return channel, cancel
}

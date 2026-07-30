package memory_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
)

type memoryClock struct {
	value time.Time
}

func (clock *memoryClock) Now() int64 {
	return clock.value.UnixNano()
}

func TestInteractionDeadlinesAreOrderedAndBounded(t *testing.T) {
	ctx := context.Background()
	store := memory.New()
	clock := &memoryClock{
		value: time.Date(2026, time.July, 30, 22, 0, 0, 0, time.UTC),
	}
	service := application.NewService(
		store,
		memoryPack(t),
		clock,
		application.NoopPublisher{},
	)
	later := openMemoryInteraction(t, service, clock, "Later")
	clock.value = clock.value.Add(-10 * time.Second)
	earlier := openMemoryInteraction(t, service, clock, "Earlier")
	due, err := store.DueInteractions(
		ctx,
		clock.value.Add(2*time.Minute),
		1,
	)
	if err != nil {
		t.Fatal(err)
	}
	if len(due) != 1 ||
		due[0].GameID != earlier.GameID ||
		due[0].GameID == later.GameID {
		t.Fatalf("ordered bounded deadlines: %#v", due)
	}
}

func openMemoryInteraction(
	t *testing.T,
	service *application.Service,
	clock *memoryClock,
	name string,
) application.LobbyResult {
	t.Helper()
	ctx := context.Background()
	owner, err := service.CreateLobby(ctx, name)
	if err != nil {
		t.Fatal(err)
	}
	started, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"start-"+name,
		owner.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.OpenInteraction(
		ctx,
		owner.GameID,
		"open-"+name,
		started.Version,
		application.InteractionOpenSpec{
			Kind: game.InteractionKindCombatResponse,
			Parent: game.InteractionParent{
				Phase:       started.Projection.Turn.Phase,
				SubjectKind: game.InteractionSubjectTurn,
				SubjectID:   started.Projection.Turn.PlayerID,
			},
			InitiatorActorID:  owner.PlayerID,
			EligibilityPolicy: game.InteractionEligibilityPublicPredicate,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentPass,
				game.InteractionIntentRespond,
			},
			Participants: []application.InteractionParticipant{{
				ActorID:       owner.PlayerID,
				Requirement:   game.InteractionResponseOptional,
				TimeoutIntent: game.InteractionIntentPass,
			}},
			DeadlinePolicy: game.CollectiveInteractionDeadlinePolicy(),
		},
	); err != nil {
		t.Fatal(err)
	}
	return owner
}

func memoryPack(t *testing.T) game.Pack {
	t.Helper()
	pack, err := game.LoadPack(filepath.Join(
		"..",
		"..",
		"..",
		"..",
		"..",
		"content",
		"sets",
		"demo",
		"cards.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	return pack
}

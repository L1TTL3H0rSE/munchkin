package game

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestInteractionProjectionIsActorSpecificAndVersionBound(t *testing.T) {
	state, pack, _ := interactionTestState(t, 3)
	initiatorID, actorIDs := interactionProjectionActors(state)
	openedAt := time.Unix(1_800_000_000, 0).UTC()
	window := interactionWindowForTest(
		state,
		openedAt,
		actorIDs,
		map[string]bool{},
	)
	state, _ = openInteractionForTest(t, state, pack, window)

	eligible, err := ProjectForActor(state, actorIDs[0], pack)
	if err != nil {
		t.Fatal(err)
	}
	if eligible.Interaction == nil {
		t.Fatal("eligible actor did not receive interaction")
	}
	view := eligible.Interaction
	if view.InteractionID != window.ID ||
		view.PublicKind != "response_window" ||
		view.PublicSubject != "current_turn" ||
		view.MyResponseState != InteractionResponsePending ||
		!view.ResponseRequiredForYou ||
		len(view.Actions) != 1 ||
		view.Actions[0].Type != InteractionIntentPass {
		t.Fatalf("eligible interaction projection: %#v", view)
	}
	for _, action := range view.Actions {
		if action.ActionID == "" ||
			action.InteractionID != window.ID ||
			action.Type == InteractionIntentAutoResolve {
			t.Fatalf("invalid interaction action: %#v", action)
		}
	}

	ineligible, err := ProjectForActor(state, initiatorID, pack)
	if err != nil {
		t.Fatal(err)
	}
	if ineligible.Interaction == nil ||
		ineligible.Interaction.InteractionID != window.ID ||
		ineligible.Interaction.MyResponseState != "" ||
		ineligible.Interaction.ResponseRequiredForYou ||
		len(ineligible.Interaction.Actions) != 0 {
		t.Fatalf("ineligible interaction projection: %#v", ineligible.Interaction)
	}

	nextVersion := state.Clone()
	nextVersion.Version++
	reprojected, err := ProjectForActor(nextVersion, actorIDs[0], pack)
	if err != nil {
		t.Fatal(err)
	}
	if reprojected.Interaction.Actions[0].ActionID == view.Actions[0].ActionID {
		t.Fatal("interaction action ID was not bound to projection version")
	}
}

func TestInteractionProjectionJSONOmitsInternalStateAndLegacyField(t *testing.T) {
	state, pack, _ := interactionTestState(t, 3)
	initiatorID, actorIDs := interactionProjectionActors(state)
	legacy, err := ProjectForActor(state, initiatorID, pack)
	if err != nil {
		t.Fatal(err)
	}
	rawLegacy, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawLegacy), `"interaction"`) {
		t.Fatalf("legacy projection grew interaction field: %s", rawLegacy)
	}

	openedAt := time.Unix(1_800_000_000, 0).UTC()
	window := interactionWindowForTest(
		state,
		openedAt,
		actorIDs,
		map[string]bool{},
	)
	state, _ = openInteractionForTest(t, state, pack, window)
	projected, err := ProjectForActor(state, actorIDs[0], pack)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(projected)
	if err != nil {
		t.Fatal(err)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"eligibility_policy",
		"allowed_intents",
		"extension_budget_seconds",
		"deadline_revision",
		`"type":"respond"`,
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("interaction projection leaked %q: %s", forbidden, raw)
		}
	}
}

func interactionProjectionActors(state State) (string, []string) {
	actorIDs := make([]string, 0, len(state.Players)-1)
	for _, player := range state.Players {
		if player.ID != state.Turn.PlayerID {
			actorIDs = append(actorIDs, player.ID)
		}
	}
	return state.Turn.PlayerID, actorIDs
}

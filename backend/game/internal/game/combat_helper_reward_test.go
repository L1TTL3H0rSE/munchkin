package game

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func offerCombatHelpForTest(
	t *testing.T,
	state State,
	pack Pack,
	currentInteractionID string,
	childInteractionID string,
	helperPlayerID string,
	reward int,
	at time.Time,
) (State, []EventEnvelope) {
	t.Helper()
	events, err := Handle(state, Command{
		Type:                CommandOfferCombatHelp,
		ActorID:             state.Turn.PlayerID,
		InteractionID:       currentInteractionID,
		ChildInteractionID:  childInteractionID,
		HelperPlayerID:      helperPlayerID,
		RewardTreasures:     reward,
		InteractionAt:       at,
		InteractionRevision: state.InteractionWindow.DeadlineRevision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	return applyForTest(t, state, events)
}

func respondCombatHelpForTest(
	t *testing.T,
	state State,
	pack Pack,
	actorID string,
	intent InteractionIntent,
	at time.Time,
) (State, []EventEnvelope) {
	t.Helper()
	events, err := Handle(state, Command{
		Type:                CommandRespondCombatHelp,
		ActorID:             actorID,
		InteractionID:       state.InteractionWindow.ID,
		InteractionIntent:   intent,
		InteractionAt:       at,
		InteractionRevision: state.InteractionWindow.DeadlineRevision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	return applyForTest(t, state, events)
}

func passCombatRespondersForTest(
	t *testing.T,
	state State,
	pack Pack,
	at time.Time,
) (State, []EventEnvelope) {
	t.Helper()
	var all []EventEnvelope
	for _, actorID := range state.InteractionWindow.EligibleActorIDs {
		events, err := Handle(state, Command{
			Type:                CommandPassInteraction,
			ActorID:             actorID,
			InteractionID:       state.InteractionWindow.ID,
			InteractionAt:       at,
			InteractionRevision: state.InteractionWindow.DeadlineRevision,
		}, pack)
		if err != nil {
			t.Fatal(err)
		}
		var envelopes []EventEnvelope
		state, envelopes = applyForTest(t, state, events)
		all = append(all, envelopes...)
	}
	return state, all
}

func TestCombatHelpOfferPrivacyDeclineAndImmutableAccept(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	state.Players[1].Level = 7
	openedAt := time.Date(2026, time.July, 31, 3, 30, 0, 0, time.UTC)
	state, _ = requestCombatWindow(t, state, pack, openedAt)

	combatant, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	var offerAction *InteractionActionView
	for index := range combatant.Interaction.Actions {
		action := &combatant.Interaction.Actions[index]
		if action.Type == InteractionIntentOfferHelp &&
			action.HelperPlayerID == "player-b" &&
			action.RewardTreasures == 1 {
			offerAction = action
		}
	}
	if offerAction == nil {
		t.Fatalf("server-owned help options: %#v", combatant.Interaction)
	}
	if events, err := Handle(state, Command{
		Type:                CommandOfferCombatHelp,
		ActorID:             "player-a",
		InteractionID:       "interaction-combat",
		ChildInteractionID:  "reward-out-of-bounds",
		HelperPlayerID:      "player-b",
		RewardTreasures:     2,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: 1,
	}, pack); err == nil || events != nil {
		t.Fatalf("out-of-bounds helper reward succeeded: %#v", events)
	}

	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-one",
		"player-b",
		1,
		openedAt.Add(5*time.Second),
	)
	if state.SuspendedInteractionWindow == nil ||
		state.InteractionWindow.ID != "offer-one" ||
		state.CombatHelpOffer == nil {
		t.Fatalf("child offer state: %#v", state)
	}
	for _, actorID := range []string{"player-a", "player-b"} {
		projection, err := ProjectForActor(state, actorID, pack)
		if err != nil {
			t.Fatal(err)
		}
		if projection.Interaction == nil ||
			projection.Interaction.PublicKind != "combat_help_offer" ||
			projection.Interaction.CombatHelpOffer == nil ||
			projection.Interaction.CombatHelpOffer.HelperPlayerID != "player-b" ||
			projection.Interaction.CombatHelpOffer.RewardTreasures != 1 {
			t.Fatalf("%s private offer projection: %#v", actorID, projection.Interaction)
		}
	}
	observer, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	rawObserver, err := json.Marshal(observer.Interaction)
	if err != nil {
		t.Fatal(err)
	}
	if observer.Interaction == nil ||
		observer.Interaction.PublicKind != "combat_response" ||
		observer.Interaction.InteractionID != "interaction-combat" ||
		observer.Interaction.ResponseRequiredForYou ||
		len(observer.Interaction.Actions) != 0 ||
		observer.Interaction.CombatHelpOffer != nil ||
		json.Valid(rawObserver) == false {
		t.Fatalf("observer learned private negotiation: %s", rawObserver)
	}

	state, _ = respondCombatHelpForTest(
		t,
		state,
		pack,
		"player-b",
		InteractionIntentDecline,
		openedAt.Add(6*time.Second),
	)
	if state.CombatHelpOffer != nil ||
		state.SuspendedInteractionWindow != nil ||
		state.InteractionWindow.ID != "interaction-combat" ||
		state.InteractionWindow.DeadlineRevision != 1 {
		t.Fatalf("decline did not resume unchanged parent: %#v", state)
	}

	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-two",
		"player-b",
		1,
		openedAt.Add(7*time.Second),
	)
	state, _ = respondCombatHelpForTest(
		t,
		state,
		pack,
		"player-b",
		InteractionIntentAccept,
		openedAt.Add(31*time.Second),
	)
	help := state.Turn.Encounter.CombatHelp
	if help == nil ||
		help.HelperPlayerID != "player-b" ||
		help.RewardTreasures != 1 ||
		help.RewardStatus != CombatHelpRewardAccepted ||
		state.InteractionWindow.DeadlineRevision != 2 ||
		!state.InteractionWindow.DeadlineAt.Equal(
			openedAt.Add(70*time.Second),
		) {
		t.Fatalf("accepted helper state: %#v", state)
	}
	for _, response := range state.InteractionWindow.Responses {
		if response.State != InteractionResponsePending {
			t.Fatalf("accept did not reset parent responses: %#v", response)
		}
	}
	if events, err := Handle(state, Command{
		Type:                CommandOfferCombatHelp,
		ActorID:             "player-a",
		InteractionID:       "interaction-combat",
		ChildInteractionID:  "forbidden-offer",
		HelperPlayerID:      "player-c",
		RewardTreasures:     1,
		InteractionAt:       openedAt.Add(32 * time.Second),
		InteractionRevision: 2,
	}, pack); err == nil || events != nil {
		t.Fatalf("accepted helper was mutable: %#v", events)
	}
	for _, actorID := range []string{"player-a", "player-b", "player-c"} {
		projection, err := ProjectForActor(state, actorID, pack)
		if err != nil {
			t.Fatal(err)
		}
		if projection.Turn.Combat == nil ||
			projection.Turn.Combat.HelperPlayerID != "player-b" ||
			projection.Turn.Combat.HelperRewardTreasures != 1 ||
			projection.Turn.Combat.PlayerStrength < 8 {
			t.Fatalf("%s lacks public accepted helper: %#v", actorID, projection.Turn.Combat)
		}
	}
}

func TestCombatHelpVictorySettlementIsCanonicalAndReplaySafe(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	state.Players[1].Level = 7
	openedAt := time.Date(2026, time.July, 31, 4, 0, 0, 0, time.UTC)
	base := state.Clone()
	state, opened := requestCombatWindow(t, state, pack, openedAt)
	all := append([]EventEnvelope(nil), opened...)
	var envelopes []EventEnvelope
	state, envelopes = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-victory",
		"player-b",
		1,
		openedAt.Add(5*time.Second),
	)
	all = append(all, envelopes...)
	state, envelopes = respondCombatHelpForTest(
		t,
		state,
		pack,
		"player-b",
		InteractionIntentAccept,
		openedAt.Add(6*time.Second),
	)
	all = append(all, envelopes...)
	helperHand := len(state.Players[1].Hand)
	combatantHand := len(state.Players[0].Hand)
	state, envelopes = passCombatRespondersForTest(
		t,
		state,
		pack,
		openedAt.Add(7*time.Second),
	)
	all = append(all, envelopes...)
	events, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          "interaction-combat",
		InteractionAt:          openedAt.Add(8 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 3 ||
		events[0].Type != EventInteractionWindowClosed ||
		events[1].Type != EventCombatHelpRewardSettled ||
		events[2].Type != EventCombatResolved {
		t.Fatalf("atomic helper settlement sequence: %#v", events)
	}
	var settlement stateChangedPayload
	if err := json.Unmarshal(events[1].Payload, &settlement); err != nil {
		t.Fatal(err)
	}
	var draw []string
	for _, outcome := range settlement.Outcomes {
		if outcome.Kind == "draw" && outcome.Deck == DeckTreasure {
			draw = outcome.Order
		}
	}
	if len(draw) == 0 ||
		settlement.State.Turn.Encounter.CombatHelp.RewardStatus !=
			CombatHelpRewardSettled {
		t.Fatalf("settlement did not persist exact draw: %#v", settlement)
	}
	state, envelopes = applyForTest(t, state, events)
	all = append(all, envelopes...)
	if len(state.Players[1].Hand) != helperHand+1 ||
		len(state.Players[0].Hand) != combatantHand+len(draw)-1 ||
		state.Players[1].Hand[helperHand] != draw[0] ||
		state.Turn.Encounter != nil {
		t.Fatalf("canonical helper-first allocation: %#v", state)
	}
	replayed, err := ReplayFrom(base, all)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatalf("helper settlement replay mismatch\nwant=%#v\ngot=%#v", state, replayed)
	}
}

func TestCombatHelpSupersedeCancelDeadlineClampAndParentTimeout(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	openedAt := time.Date(2026, time.July, 31, 4, 30, 0, 0, time.UTC)
	state, _ = requestCombatWindow(t, state, pack, openedAt)
	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-clamped",
		"player-b",
		1,
		openedAt.Add(35*time.Second),
	)
	if !state.InteractionWindow.DeadlineAt.Equal(
		openedAt.Add(60 * time.Second),
	) {
		t.Fatalf("child deadline was not clamped: %#v", state.InteractionWindow)
	}
	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"offer-clamped",
		"offer-superseded",
		"player-c",
		1,
		openedAt.Add(40*time.Second),
	)
	if state.CombatHelpOffer.ID != "offer-superseded" ||
		state.CombatHelpOffer.HelperPlayerID != "player-c" ||
		state.SuspendedInteractionWindow.DeadlineRevision != 1 {
		t.Fatalf("supersede changed parent or lost offer: %#v", state)
	}
	cancel, err := Handle(state, Command{
		Type:                CommandCancelCombatHelp,
		ActorID:             "player-a",
		InteractionID:       "offer-superseded",
		InteractionAt:       openedAt.Add(41 * time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, cancel)
	if state.CombatHelpOffer != nil ||
		state.InteractionWindow.ID != "interaction-combat" ||
		state.InteractionWindow.DeadlineRevision != 1 {
		t.Fatalf("cancel did not resume parent: %#v", state)
	}
	if events, err := Handle(state, Command{
		Type:                CommandOfferCombatHelp,
		ActorID:             "player-a",
		InteractionID:       "interaction-combat",
		ChildInteractionID:  "too-late",
		HelperPlayerID:      "player-b",
		RewardTreasures:     1,
		InteractionAt:       openedAt.Add(51 * time.Second),
		InteractionRevision: 1,
	}, pack); err == nil || events != nil {
		t.Fatalf("offer opened with less than ten seconds: %#v", events)
	}

	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-timeout",
		"player-b",
		1,
		openedAt.Add(42*time.Second),
	)
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       "offer-timeout",
		InteractionAt:       openedAt.Add(60 * time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) < 5 ||
		events[0].Type != EventCombatHelpOfferResolved ||
		events[len(events)-1].Type != EventCombatResolved {
		t.Fatalf("child/parent timeout sequence: %#v", events)
	}
	state, _ = applyForTest(t, state, events)
	if state.CombatHelpOffer != nil ||
		state.SuspendedInteractionWindow != nil ||
		state.InteractionWindow.Status != InteractionWindowClosed ||
		state.InteractionWindow.CloseReason != InteractionCloseDeadlineExpired ||
		state.Turn.Phase == PhaseCombat {
		t.Fatalf("parent timeout did not continue after child: %#v", state)
	}
}

func TestCombatHelpDefeatVoidsRewardWithoutDrawing(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	openedAt := time.Date(2026, time.July, 31, 5, 0, 0, 0, time.UTC)
	state, _ = requestCombatWindow(t, state, pack, openedAt)
	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-defeat",
		"player-b",
		1,
		openedAt.Add(5*time.Second),
	)
	state, _ = respondCombatHelpForTest(
		t,
		state,
		pack,
		"player-b",
		InteractionIntentAccept,
		openedAt.Add(6*time.Second),
	)
	sourceID := moveDefinition(
		t,
		&state,
		"test-monster-aid",
		&state.Players[2].Hand,
	)
	intervention, err := Handle(state, Command{
		Type:                CommandPlayCombatIntervention,
		ActorID:             "player-c",
		InstanceID:          sourceID,
		TargetInstanceID:    string(EffectTargetMonster),
		InteractionID:       "interaction-combat",
		InteractionAt:       openedAt.Add(7 * time.Second),
		InteractionRevision: state.InteractionWindow.DeadlineRevision,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, intervention)
	helperHand := len(state.Players[1].Hand)
	state, _ = passCombatRespondersForTest(
		t,
		state,
		pack,
		openedAt.Add(8*time.Second),
	)
	events, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          "interaction-combat",
		InteractionAt:          openedAt.Add(9 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 3 ||
		events[1].Type != EventCombatHelpRewardVoided ||
		events[2].Type != EventCombatResolved {
		t.Fatalf("defeat reward closure: %#v", events)
	}
	state, _ = applyForTest(t, state, events)
	if len(state.Players[1].Hand) != helperHand {
		t.Fatalf("helper was paid after defeat: %#v", state.Players[1].Hand)
	}
}

func TestCombatHelpVictoryFailsClosedWhenRewardBecomesImpossible(t *testing.T) {
	state, pack, _ := multiplayerCombatState(t)
	state.Players[1].Level = 7
	openedAt := time.Date(2026, time.July, 31, 5, 30, 0, 0, time.UTC)
	state, _ = requestCombatWindow(t, state, pack, openedAt)
	state, _ = offerCombatHelpForTest(
		t,
		state,
		pack,
		"interaction-combat",
		"offer-impossible",
		"player-b",
		1,
		openedAt.Add(5*time.Second),
	)
	state, _ = respondCombatHelpForTest(
		t,
		state,
		pack,
		"player-b",
		InteractionIntentAccept,
		openedAt.Add(6*time.Second),
	)
	state.Players[0].Hand = append(
		state.Players[0].Hand,
		state.TreasureDeck...,
	)
	state.Players[0].Hand = append(
		state.Players[0].Hand,
		state.TreasureDiscard...,
	)
	state.TreasureDeck = nil
	state.TreasureDiscard = nil
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	state, _ = passCombatRespondersForTest(
		t,
		state,
		pack,
		openedAt.Add(7*time.Second),
	)
	events, err := Handle(state, Command{
		Type:                   CommandCloseInteractionWindow,
		ActorID:                "player-a",
		InteractionID:          "interaction-combat",
		InteractionAt:          openedAt.Add(8 * time.Second),
		InteractionCloseReason: InteractionCloseAllResponded,
	}, pack)
	if err == nil || events != nil {
		t.Fatalf("impossible accepted reward committed: %#v", events)
	}
}

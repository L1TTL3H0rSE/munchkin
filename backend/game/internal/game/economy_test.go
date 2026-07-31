package game

import (
	"encoding/json"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

func economyState(t *testing.T, playerCount int) (State, Pack) {
	t.Helper()
	pack := testPack(t)
	state, _ := startedState(t, pack, playerCount)
	state.RulesProfileID = AdvancedCombatProfileID
	state.RulesProfileVersion = AdvancedCombatProfileVersion
	state, _ = finishSetup(t, state, pack)
	if state.Turn.PlayerID != "player-a" ||
		state.Turn.Phase != PhasePreparation {
		t.Fatalf("unexpected economy fixture turn: %#v", state.Turn)
	}
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
	return state, pack
}

func moveEconomyInstance(
	t *testing.T,
	state *State,
	playerIndex int,
	instanceID string,
) {
	t.Helper()
	state.DoorDeck, _ = removeString(state.DoorDeck, instanceID)
	state.TreasureDeck, _ = removeString(state.TreasureDeck, instanceID)
	state.DoorDiscard, _ = removeString(state.DoorDiscard, instanceID)
	state.TreasureDiscard, _ = removeString(
		state.TreasureDiscard,
		instanceID,
	)
	state.Turn.Resolving, _ = removeString(state.Turn.Resolving, instanceID)
	for index := range state.Players {
		removeOwnedInstance(&state.Players[index], instanceID)
	}
	state.Players[playerIndex].Carried = append(
		state.Players[playerIndex].Carried,
		instanceID,
	)
	if err := state.Validate(); err != nil {
		t.Fatal(err)
	}
}

func openEconomyOffer(
	t *testing.T,
	state State,
	pack Pack,
	command Command,
) State {
	t.Helper()
	events, err := Handle(state, command, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Type != EventEconomyOfferOpened {
		t.Fatalf("economy open events=%#v", events)
	}
	next, _ := applyForTest(t, state, events)
	return next
}

func TestEconomyTradeAcceptsAtomicallyAndProjectsClausesToParties(t *testing.T) {
	state, pack := economyState(t, 3)
	offeredID := "folding-umbrella-1"
	requestedID := "red-cap-1"
	moveEconomyInstance(t, &state, 0, offeredID)
	moveEconomyInstance(t, &state, 1, requestedID)
	openedAt := time.Date(2026, 7, 31, 5, 0, 0, 0, time.UTC)
	state = openEconomyOffer(t, state, pack, Command{
		Type:                 CommandProposeTrade,
		ActorID:              "player-a",
		TargetPlayerID:       "player-b",
		InstanceIDs:          []string{offeredID},
		RequestedInstanceIDs: []string{requestedID},
		InteractionID:        "interaction-trade",
		InteractionAt:        openedAt,
	})

	for _, actorID := range []string{"player-a", "player-b"} {
		projection, err := ProjectForActor(state, actorID, pack)
		if err != nil {
			t.Fatal(err)
		}
		if projection.Interaction == nil ||
			projection.Interaction.EconomyOffer == nil ||
			projection.Interaction.EconomyOffer.Kind != EconomyOfferTrade ||
			len(projection.Interaction.EconomyOffer.Offered) != 1 ||
			len(projection.Interaction.EconomyOffer.Requested) != 1 {
			t.Fatalf("%s offer projection=%#v", actorID, projection.Interaction)
		}
	}
	observer, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	if observer.Interaction == nil ||
		observer.Interaction.PublicKind != "economy_offer" ||
		observer.Interaction.EconomyOffer != nil ||
		len(observer.Interaction.Actions) != 0 {
		t.Fatalf("observer offer leak=%#v", observer.Interaction)
	}

	events, err := Handle(state, Command{
		Type:                CommandRespondEconomyOffer,
		ActorID:             "player-b",
		InteractionID:       "interaction-trade",
		InteractionIntent:   InteractionIntentAccept,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	if !slices.Contains(next.Players[1].Carried, offeredID) ||
		!slices.Contains(next.Players[0].Carried, requestedID) ||
		next.EconomyOffer != nil ||
		next.InteractionWindow.CloseReason != InteractionCloseAccepted {
		t.Fatalf("accepted trade state=%#v", next)
	}
	replayed, err := Apply(state, events[0])
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, next) {
		t.Fatal("economy acceptance replay diverged")
	}
}

func TestEconomyOfferRejectsForeignClausesAndTimeoutMovesNothing(t *testing.T) {
	state, pack := economyState(t, 2)
	offeredID := "folding-umbrella-1"
	foreignID := "red-cap-1"
	moveEconomyInstance(t, &state, 0, offeredID)
	moveEconomyInstance(t, &state, 1, foreignID)
	openedAt := time.Date(2026, 7, 31, 5, 10, 0, 0, time.UTC)
	if _, err := Handle(state, Command{
		Type:           CommandProposeGift,
		ActorID:        "player-a",
		TargetPlayerID: "player-b",
		InstanceIDs:    []string{foreignID},
		InteractionID:  "interaction-forged-gift",
		InteractionAt:  openedAt,
	}, pack); err == nil {
		t.Fatal("foreign gift clause was accepted")
	}
	state = openEconomyOffer(t, state, pack, Command{
		Type:           CommandProposeGift,
		ActorID:        "player-a",
		TargetPlayerID: "player-b",
		InstanceIDs:    []string{offeredID},
		InteractionID:  "interaction-gift-timeout",
		InteractionAt:  openedAt,
	})
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       "interaction-gift-timeout",
		InteractionAt:       state.InteractionWindow.DeadlineAt,
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	if !slices.Contains(next.Players[0].Carried, offeredID) ||
		slices.Contains(next.Players[1].Carried, offeredID) ||
		next.InteractionWindow.CloseReason !=
			InteractionCloseDeadlineExpired {
		t.Fatalf("timed out gift moved cards: %#v", next)
	}
}

func TestEconomyDeclineAndCancelMoveNothing(t *testing.T) {
	for _, intent := range []InteractionIntent{
		InteractionIntentDecline,
		InteractionIntentCancelOffer,
	} {
		t.Run(string(intent), func(t *testing.T) {
			state, pack := economyState(t, 2)
			offeredID := "folding-umbrella-1"
			moveEconomyInstance(t, &state, 0, offeredID)
			openedAt := time.Date(
				2026,
				7,
				31,
				5,
				15,
				0,
				0,
				time.UTC,
			)
			state = openEconomyOffer(t, state, pack, Command{
				Type:           CommandProposeGift,
				ActorID:        "player-a",
				TargetPlayerID: "player-b",
				InstanceIDs:    []string{offeredID},
				InteractionID:  "interaction-gift-terminal",
				InteractionAt:  openedAt,
			})
			command := Command{
				Type:                CommandRespondEconomyOffer,
				ActorID:             "player-b",
				InteractionID:       "interaction-gift-terminal",
				InteractionIntent:   intent,
				InteractionAt:       openedAt.Add(time.Second),
				InteractionRevision: 1,
			}
			expectedReason := InteractionCloseDeclined
			if intent == InteractionIntentCancelOffer {
				command.Type = CommandCancelEconomyOffer
				command.ActorID = "player-a"
				expectedReason = InteractionCloseCancelled
			}
			events, err := Handle(state, command, pack)
			if err != nil {
				t.Fatal(err)
			}
			next, _ := applyForTest(t, state, events)
			if !slices.Contains(
				next.Players[0].Carried,
				offeredID,
			) ||
				slices.Contains(next.Players[1].Carried, offeredID) ||
				next.InteractionWindow.CloseReason != expectedReason {
				t.Fatalf("%s moved gift: %#v", intent, next)
			}
		})
	}
}

func TestEconomyAcceptRevalidatesBigItemCapacityAtomically(t *testing.T) {
	state, pack := economyState(t, 2)
	offeredID := "heavy-kiosk-1"
	recipientBigID := "heavy-kiosk-2"
	moveEconomyInstance(t, &state, 0, offeredID)
	moveEconomyInstance(t, &state, 1, recipientBigID)
	openedAt := time.Date(2026, 7, 31, 5, 17, 0, 0, time.UTC)
	state = openEconomyOffer(t, state, pack, Command{
		Type:           CommandProposeGift,
		ActorID:        "player-a",
		TargetPlayerID: "player-b",
		InstanceIDs:    []string{offeredID},
		InteractionID:  "interaction-big-gift",
		InteractionAt:  openedAt,
	})
	if _, err := Handle(state, Command{
		Type:                CommandRespondEconomyOffer,
		ActorID:             "player-b",
		InteractionID:       "interaction-big-gift",
		InteractionIntent:   InteractionIntentAccept,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: 1,
	}, pack); err == nil {
		t.Fatal("capacity-breaking gift was accepted")
	}
	if !slices.Contains(state.Players[0].Carried, offeredID) ||
		slices.Contains(state.Players[1].Carried, offeredID) ||
		state.EconomyOffer == nil {
		t.Fatalf("rejected transfer mutated source state: %#v", state)
	}
}

func beginCharityForTest(
	t *testing.T,
	state State,
	pack Pack,
	openedAt time.Time,
) State {
	t.Helper()
	setTurnPhase(&state, PhaseCharity)
	events, err := Handle(state, Command{
		Type:          CommandBeginCharityTransfer,
		ActorID:       state.Turn.PlayerID,
		InteractionID: "interaction-charity",
		InteractionAt: openedAt,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Type != EventCharityTransferStarted {
		t.Fatalf("charity start events=%#v", events)
	}
	next, _ := applyForTest(t, state, events)
	return next
}

func TestCharityPersistsExactAllocationAndReplayDoesNotRecompute(t *testing.T) {
	state, pack := economyState(t, 3)
	state.Players[0].Level = 4
	state.Players[1].Level = 1
	state.Players[2].Level = 1
	openedAt := time.Date(2026, 7, 31, 5, 20, 0, 0, time.UTC)
	state = beginCharityForTest(t, state, pack, openedAt)
	transfer := state.CharityTransfer
	if transfer == nil ||
		transfer.Excess == 0 ||
		!reflect.DeepEqual(
			transfer.EligibleRecipientIDs,
			[]string{"player-b", "player-c"},
		) {
		t.Fatalf("charity transfer=%#v", transfer)
	}
	allocations := make([]CharityAllocation, transfer.Excess)
	for index := range allocations {
		recipientID := transfer.EligibleRecipientIDs[index%len(transfer.EligibleRecipientIDs)]
		allocations[index] = CharityAllocation{
			InstanceID:        transfer.StableHandOrder[index],
			RecipientPlayerID: recipientID,
		}
	}
	events, err := Handle(state, Command{
		Type:                CommandResolveCharity,
		ActorID:             "player-a",
		InteractionID:       transfer.InteractionID,
		InteractionAt:       openedAt.Add(time.Second),
		InteractionRevision: 1,
		CharityAllocations:  allocations,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 1 || events[0].Type != EventCharityAllocated {
		t.Fatalf("charity allocation events=%#v", events)
	}
	next, _ := applyForTest(t, state, events)
	if next.Turn.Phase != PhaseEndTurn ||
		next.CharityTransfer == nil ||
		!next.CharityTransfer.Completed ||
		!reflect.DeepEqual(next.CharityTransfer.Allocations, allocations) {
		t.Fatalf("charity allocation state=%#v", next.CharityTransfer)
	}
	state.Players[1].Level = 9
	state.Players[2].Level = 8
	replayed, err := Apply(state, events[0])
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(
		replayed.CharityTransfer.Allocations,
		allocations,
	) {
		t.Fatal("charity replay recomputed recipients")
	}
	raw, err := json.Marshal(events[0])
	if err != nil {
		t.Fatal(err)
	}
	for _, allocation := range allocations {
		if !json.Valid(raw) ||
			!strings.Contains(string(raw), allocation.InstanceID) ||
			!strings.Contains(string(raw), allocation.RecipientPlayerID) {
			t.Fatal("charity event did not preserve exact mapping")
		}
	}
}

func TestCharityTimeoutUsesStableHandAndRoundRobinSeatOrder(t *testing.T) {
	state, pack := economyState(t, 3)
	state.Players[0].Level = 5
	state.Players[1].Level = 1
	state.Players[2].Level = 1
	openedAt := time.Date(2026, 7, 31, 5, 30, 0, 0, time.UTC)
	state = beginCharityForTest(t, state, pack, openedAt)
	transfer := state.CharityTransfer.clone()
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       transfer.InteractionID,
		InteractionAt:       state.InteractionWindow.DeadlineAt,
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	for index, allocation := range next.CharityTransfer.Allocations {
		expectedRecipientID := transfer.EligibleRecipientIDs[index%len(transfer.EligibleRecipientIDs)]
		if allocation.InstanceID != transfer.StableHandOrder[index] ||
			allocation.RecipientPlayerID != expectedRecipientID {
			t.Fatalf("timeout allocation[%d]=%#v", index, allocation)
		}
	}
	if next.InteractionWindow.CloseReason !=
		InteractionCloseDeadlineExpired {
		t.Fatalf("timeout close=%s", next.InteractionWindow.CloseReason)
	}
}

func TestCharityTimeoutWithoutRecipientsDiscardsByDeckKind(t *testing.T) {
	state, pack := economyState(t, 1)
	openedAt := time.Date(2026, 7, 31, 5, 40, 0, 0, time.UTC)
	state = beginCharityForTest(t, state, pack, openedAt)
	transfer := state.CharityTransfer.clone()
	if len(transfer.EligibleRecipientIDs) != 0 {
		t.Fatalf("solo charity recipients=%v", transfer.EligibleRecipientIDs)
	}
	events, err := Handle(state, Command{
		Type:                CommandTimeoutInteraction,
		InteractionID:       transfer.InteractionID,
		InteractionAt:       state.InteractionWindow.DeadlineAt,
		InteractionRevision: 1,
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	next, _ := applyForTest(t, state, events)
	if len(next.CharityTransfer.DiscardedInstanceIDs) != transfer.Excess ||
		len(next.CharityTransfer.Allocations) != 0 {
		t.Fatalf("solo charity=%#v", next.CharityTransfer)
	}
	for _, instanceID := range next.CharityTransfer.DiscardedInstanceIDs {
		card, _, exists := pack.DefinitionForInstance(next, instanceID)
		if !exists {
			t.Fatal("discarded charity instance is unknown")
		}
		expected := next.DoorDiscard
		if card.Deck == DeckTreasure {
			expected = next.TreasureDiscard
		}
		if !slices.Contains(expected, instanceID) {
			t.Fatalf("%s missing from %s discard", instanceID, card.Deck)
		}
	}
}

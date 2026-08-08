package game

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"
)

func TestEquipItemMovesLegalHandItemAtomically(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 1)
	state, _ = finishSetup(t, state, pack)
	itemID := moveDefinition(
		t,
		&state,
		"folding-umbrella",
		&state.Players[0].Hand,
	)

	projection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	projected := false
	for _, action := range projection.Turn.AvailableActions {
		if action.Type == CommandEquipItem && action.SourceInstanceID == itemID {
			projected = true
			break
		}
	}
	if !projected {
		t.Fatalf("hand equip was not projected: %#v", projection.Turn.AvailableActions)
	}

	next, _ := applyCommand(t, state, Command{
		Type:       CommandEquipItem,
		InstanceID: itemID,
	}, pack)
	if slices.Contains(next.Players[0].Hand, itemID) ||
		slices.Contains(next.Players[0].Carried, itemID) ||
		!slices.Contains(next.Players[0].Equipped, itemID) {
		t.Fatalf("hand equip was not atomic: %#v", next.Players[0])
	}

	view, err := ProjectForActor(next, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	card, _, exists := pack.DefinitionForInstance(next, itemID)
	if !exists || card.Item == nil {
		t.Fatal("equipped item definition disappeared")
	}
	breakdown := view.You.StrengthBreakdown
	if breakdown.BaseStrength != next.Players[0].Level ||
		breakdown.EquipmentBonus != card.Item.Bonus ||
		breakdown.TotalStrength != breakdown.BaseStrength+
			breakdown.EquipmentBonus+breakdown.TemporaryBonus ||
		breakdown.HandCount != len(next.Players[0].Hand) {
		t.Fatalf("strength breakdown=%#v", breakdown)
	}
}

func TestCharityRecipientsRespectGlobalMinimumTieAndHandLimit(t *testing.T) {
	state, pack := economyState(t, 3)
	for index := range state.Players {
		limit, err := handLimit(state, index, pack)
		if err != nil {
			t.Fatal(err)
		}
		for len(state.Players[index].Hand) > limit {
			instanceID := state.Players[index].Hand[len(state.Players[index].Hand)-1]
			if err := discardOwnedInstance(&state, index, instanceID, pack); err != nil {
				t.Fatal(err)
			}
		}
	}
	state.Players[0].Level = 1
	state.Players[1].Level = 1
	state.Players[2].Level = 4
	recipients, err := charityRecipientIDs(state, 0, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(recipients) != 0 {
		t.Fatalf("minimum-level allocator received recipients: %v", recipients)
	}

	state.Players[0].Level = 5
	state.Players[1].Level = 1
	state.Players[2].Level = 1
	limit, err := handLimit(state, 1, pack)
	if err != nil {
		t.Fatal(err)
	}
	for len(state.Players[1].Hand) <= limit {
		instanceID := state.DoorDeck[0]
		state.DoorDeck = state.DoorDeck[1:]
		state.Players[1].Hand = append(state.Players[1].Hand, instanceID)
	}
	recipients, err = charityRecipientIDs(state, 0, pack)
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(recipients, []string{"player-c"}) {
		t.Fatalf("over-limit recipient was not excluded: %v", recipients)
	}

	limit, err = handLimit(state, 2, pack)
	if err != nil {
		t.Fatal(err)
	}
	for len(state.Players[2].Hand) <= limit {
		instanceID := state.DoorDeck[0]
		state.DoorDeck = state.DoorDeck[1:]
		state.Players[2].Hand = append(state.Players[2].Hand, instanceID)
	}
	recipients, err = charityRecipientIDs(state, 0, pack)
	if err != nil {
		t.Fatal(err)
	}
	if len(recipients) != 0 {
		t.Fatalf("discard-only charity still has recipients: %v", recipients)
	}
}

func TestCombatResultProjectionKeepsRewardCardsViewerPrivate(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack, 3)
	state, _ = finishSetup(t, state, pack)
	actorRewardID := state.Players[0].Hand[0]
	helperRewardID := state.Players[1].Hand[0]
	state.RecentCombatResult = &CombatResult{
		Outcome: "victory",
		Rewards: []CombatReward{
			{
				PlayerID:            "player-a",
				TreasureInstanceIDs: []string{actorRewardID},
				LevelsGained:        1,
			},
			{
				PlayerID:            "player-b",
				TreasureInstanceIDs: []string{helperRewardID},
			},
		},
	}

	actor, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	if actor.RecentCombatResult == nil ||
		actor.RecentCombatResult.ViewerReward == nil ||
		len(actor.RecentCombatResult.ViewerReward.Treasures) != 1 ||
		actor.RecentCombatResult.ViewerReward.Treasures[0].InstanceID != actorRewardID {
		t.Fatalf("actor reward projection=%#v", actor.RecentCombatResult)
	}
	rawActor, err := json.Marshal(actor)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawActor), helperRewardID) {
		t.Fatal("actor projection leaked helper reward card")
	}

	observer, err := ProjectForActor(state, "player-c", pack)
	if err != nil {
		t.Fatal(err)
	}
	if observer.RecentCombatResult == nil ||
		observer.RecentCombatResult.ViewerReward != nil ||
		len(observer.RecentCombatResult.PublicRewards) != 2 {
		t.Fatalf("observer reward projection=%#v", observer.RecentCombatResult)
	}
	rawObserver, err := json.Marshal(observer)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(rawObserver), actorRewardID) ||
		strings.Contains(string(rawObserver), helperRewardID) {
		t.Fatal("observer projection leaked reward card IDs")
	}
}

package game

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"
)

func testPack(t *testing.T) Pack {
	t.Helper()
	cards := []Card{
		{ID: "tiny-monster", Name: "Tiny Monster", Kind: CardMonster, CombatStrength: 1, TreasureCount: 1, LevelLoss: 1},
		{ID: "large-monster", Name: "Large Monster", Kind: CardMonster, CombatStrength: 9, TreasureCount: 2, LevelLoss: 2},
		{ID: "curse-one", Name: "Curse One", Kind: CardCurse, LevelLoss: 1},
		{ID: "door-one", Name: "Door One", Kind: CardDoor},
	}
	for index := 4; index < 12; index++ {
		cards = append(cards, Card{ID: "door-" + string(rune('a'+index)), Name: "Door", Kind: CardDoor})
	}
	for index := 0; index < 12; index++ {
		cards = append(cards, Card{ID: "treasure-" + string(rune('a'+index)), Name: "Treasure", Kind: CardTreasure})
	}
	pack := Pack{
		SchemaVersion: 1,
		SetID:         "test-original",
		Version:       1,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "test-fixture",
		ContentDigest: CardsDigest(cards),
		Cards:         cards,
	}
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func TestCanonicalCardsDigestMatchesNodeFixture(t *testing.T) {
	cards := []Card{{
		ID:         "unicode-card",
		Name:       "Mage <&> ✨",
		Kind:       CardDoor,
		RulesText:  "Когда & тогда",
		FlavorText: "<шутка>",
		Image:      "assets/cards/mage.webp",
		AltText:    "Маг сияет",
	}}
	const expected = "sha256:a148cdb6997ebac04aa4f3df51ebb7fcd79949d724d51b6af0a1c41b177eb65f"
	if actual := CardsDigest(cards); actual != expected {
		t.Fatalf("canonical digest: got %s want %s", actual, expected)
	}
}

func applyForTest(t *testing.T, state State, events []DomainEvent) (State, []EventEnvelope) {
	t.Helper()
	envelopes := make([]EventEnvelope, 0, len(events))
	for _, event := range events {
		sequence := state.Version + 1
		next, err := Apply(state, event)
		if err != nil {
			t.Fatal(err)
		}
		envelopes = append(envelopes, EventEnvelope{
			GameID:     next.GameID,
			Sequence:   sequence,
			EventID:    "event",
			CommandID:  "command",
			Type:       event.Type,
			Schema:     1,
			OccurredAt: time.Unix(0, int64(sequence)).UTC(),
			Payload:    event.Payload,
		})
		state = next
	}
	return state, envelopes
}

func startedState(t *testing.T, pack Pack) (State, []EventEnvelope) {
	t.Helper()
	created, err := CreateLobby("game", Player{
		ID:             "player-a",
		Name:           "Alice",
		Level:          1,
		CredentialHash: "hash-a",
	}, pack, 42)
	if err != nil {
		t.Fatal(err)
	}
	state, all := applyForTest(t, State{}, []DomainEvent{created})
	joined, err := Handle(state, Command{
		Type:           CommandJoin,
		PlayerID:       "player-b",
		DisplayName:    "Bob",
		CredentialHash: "hash-b",
	}, pack)
	if err != nil {
		t.Fatal(err)
	}
	var envelopes []EventEnvelope
	state, envelopes = applyForTest(t, state, joined)
	all = append(all, envelopes...)
	started, err := Handle(state, Command{Type: CommandStart, ActorID: "player-a"}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, envelopes = applyForTest(t, state, started)
	all = append(all, envelopes...)
	return state, all
}

func TestAcceptedFlowReplaysExactly(t *testing.T) {
	pack := testPack(t)
	state, envelopes := startedState(t, pack)
	state.DoorDeck = append([]string{"tiny-monster"}, state.DoorDeck...)

	commands := []Command{
		{Type: CommandOpenDoor, ActorID: "player-a"},
		{Type: CommandFight, ActorID: "player-a"},
		{Type: CommandLoot, ActorID: "player-a"},
		{Type: CommandEndTurn, ActorID: "player-a"},
	}
	for _, command := range commands {
		events, err := Handle(state, command, pack)
		if err != nil {
			t.Fatalf("%s: %v", command.Type, err)
		}
		var added []EventEnvelope
		state, added = applyForTest(t, state, events)
		envelopes = append(envelopes, added...)
	}

	replayed, err := Replay(envelopes)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(replayed, state) {
		t.Fatalf("replay mismatch\nwant: %#v\ngot: %#v", state, replayed)
	}
	if state.Turn.PlayerID != "player-b" || state.Turn.Phase != PhaseOpenDoor {
		t.Fatalf("unexpected next turn: %#v", state.Turn)
	}
}

func TestReplayFromSnapshotMatchesGenesisAndRejectsMixedGame(t *testing.T) {
	pack := testPack(t)
	expected, events := startedState(t, pack)
	snapshot, err := Replay(events[:2])
	if err != nil {
		t.Fatal(err)
	}
	fromSnapshot, err := ReplayFrom(snapshot, events[2:])
	if err != nil || !reflect.DeepEqual(fromSnapshot, expected) {
		t.Fatalf("snapshot replay: state=%#v err=%v", fromSnapshot, err)
	}
	corrupt := append([]EventEnvelope(nil), events...)
	corrupt[1].GameID = "another-game"
	if _, err := Replay(corrupt); err == nil {
		t.Fatal("mixed game event log unexpectedly replayed")
	}
}

func TestIllegalActorAndPhaseEmitNoEvents(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack)

	for _, command := range []Command{
		{Type: CommandOpenDoor, ActorID: "player-b"},
		{Type: CommandFight, ActorID: "player-a"},
	} {
		events, err := Handle(state, command, pack)
		if err == nil {
			t.Fatalf("%s unexpectedly succeeded", command.Type)
		}
		if len(events) != 0 {
			t.Fatalf("%s emitted events on error", command.Type)
		}
	}
}

func TestRunAwayPersistsRealizedRoll(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack)
	state.DoorDeck = append([]string{"large-monster"}, state.DoorDeck...)
	opened, err := Handle(state, Command{Type: CommandOpenDoor, ActorID: "player-a"}, pack)
	if err != nil {
		t.Fatal(err)
	}
	state, _ = applyForTest(t, state, opened)
	events, err := Handle(state, Command{Type: CommandRunAway, ActorID: "player-a"}, pack)
	if err != nil {
		t.Fatal(err)
	}
	var payload runAwayResolvedPayload
	if err := json.Unmarshal(events[0].Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.Roll < 1 || payload.Roll > 6 || payload.RNGState == state.RNGState {
		t.Fatalf("random outcome was not persisted: %#v", payload)
	}
}

func TestProjectionDoesNotLeakOtherHandOrInternals(t *testing.T) {
	pack := testPack(t)
	state, _ := startedState(t, pack)
	state.Players[0].Hand = []string{"treasure-a"}
	state.Players[1].Hand = []string{"treasure-b"}

	projection, err := ProjectForActor(state, "player-a", pack)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := json.Marshal(projection)
	if err != nil {
		t.Fatal(err)
	}
	serialized := string(raw)
	for _, forbidden := range []string{
		"treasure-b",
		"\"credential_hash\":",
		"\"door_deck\":",
		"\"treasure_deck\":",
		"\"rng_state\":",
		"\"content_digest\":",
	} {
		if contains := jsonContains(serialized, forbidden); contains {
			t.Fatalf("projection leaked %q: %s", forbidden, serialized)
		}
	}
	if _, err := ProjectForActor(state, "outsider", pack); err == nil {
		t.Fatal("outsider unexpectedly received a projection")
	}
}

func jsonContains(value, needle string) bool {
	for index := 0; index+len(needle) <= len(value); index++ {
		if value[index:index+len(needle)] == needle {
			return true
		}
	}
	return false
}

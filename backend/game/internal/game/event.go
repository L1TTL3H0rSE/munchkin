package game

import (
	"encoding/json"
	"fmt"
	"time"
)

const (
	EventLobbyCreated    = "game.v1.lobby_created"
	EventPlayerJoined    = "game.v1.player_joined"
	EventGameStarted     = "game.v1.game_started"
	EventDoorResolved    = "game.v1.door_resolved"
	EventCombatResolved  = "game.v1.combat_resolved"
	EventRunAwayResolved = "game.v1.run_away_resolved"
	EventLooted          = "game.v1.looted"
	EventTurnAdvanced    = "game.v1.turn_advanced"
)

type DomainEvent struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type EventEnvelope struct {
	GameID     string          `json:"game_id"`
	Sequence   uint64          `json:"sequence"`
	EventID    string          `json:"event_id"`
	CommandID  string          `json:"command_id"`
	Type       string          `json:"type"`
	Schema     uint16          `json:"schema"`
	OccurredAt time.Time       `json:"occurred_at"`
	Payload    json.RawMessage `json:"payload"`
}

type lobbyCreatedPayload struct {
	GameID         string `json:"game_id"`
	Owner          Player `json:"owner"`
	Seed           uint64 `json:"seed"`
	ContentSetID   string `json:"content_set_id"`
	ContentVersion int    `json:"content_version"`
	ContentDigest  string `json:"content_digest"`
}

type playerJoinedPayload struct {
	Player Player `json:"player"`
}

type gameStartedPayload struct {
	DoorDeck     []string            `json:"door_deck"`
	TreasureDeck []string            `json:"treasure_deck"`
	Hands        map[string][]string `json:"hands"`
	TurnPlayerID string              `json:"turn_player_id"`
	RNGState     uint64              `json:"rng_state"`
}

type doorResolvedPayload struct {
	PlayerID    string   `json:"player_id"`
	CardID      string   `json:"card_id"`
	DoorDeck    []string `json:"door_deck"`
	DoorDiscard []string `json:"door_discard"`
	Hand        []string `json:"hand"`
	Level       int      `json:"level"`
	Phase       Phase    `json:"phase"`
	EncounterID string   `json:"encounter_id,omitempty"`
}

type combatResolvedPayload struct {
	PlayerID       string   `json:"player_id"`
	MonsterID      string   `json:"monster_id"`
	Won            bool     `json:"won"`
	Level          int      `json:"level"`
	Hand           []string `json:"hand"`
	TreasureDeck   []string `json:"treasure_deck"`
	DoorDiscard    []string `json:"door_discard"`
	Phase          Phase    `json:"phase"`
	Status         Status   `json:"status"`
	WinnerPlayerID string   `json:"winner_player_id,omitempty"`
}

type runAwayResolvedPayload struct {
	PlayerID    string   `json:"player_id"`
	MonsterID   string   `json:"monster_id"`
	Roll        int      `json:"roll"`
	Succeeded   bool     `json:"succeeded"`
	Level       int      `json:"level"`
	RNGState    uint64   `json:"rng_state"`
	DoorDiscard []string `json:"door_discard"`
}

type lootedPayload struct {
	PlayerID     string   `json:"player_id"`
	CardID       string   `json:"card_id"`
	Hand         []string `json:"hand"`
	TreasureDeck []string `json:"treasure_deck"`
}

type turnAdvancedPayload struct {
	PlayerID string `json:"player_id"`
}

func newEvent(eventType string, payload any) (DomainEvent, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return DomainEvent{}, err
	}
	return DomainEvent{Type: eventType, Payload: raw}, nil
}

func decode[T any](event DomainEvent) (T, error) {
	var payload T
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return payload, fmt.Errorf("decode %s: %w", event.Type, err)
	}
	return payload, nil
}

func Apply(state State, event DomainEvent) (State, error) {
	next := state.Clone()
	switch event.Type {
	case EventLobbyCreated:
		payload, err := decode[lobbyCreatedPayload](event)
		if err != nil {
			return State{}, err
		}
		next = State{
			GameID:         payload.GameID,
			Status:         StatusLobby,
			OwnerPlayerID:  payload.Owner.ID,
			Players:        []Player{payload.Owner},
			RNGState:       payload.Seed,
			ContentSetID:   payload.ContentSetID,
			ContentVersion: payload.ContentVersion,
			ContentDigest:  payload.ContentDigest,
		}
	case EventPlayerJoined:
		payload, err := decode[playerJoinedPayload](event)
		if err != nil {
			return State{}, err
		}
		next.Players = append(next.Players, payload.Player)
	case EventGameStarted:
		payload, err := decode[gameStartedPayload](event)
		if err != nil {
			return State{}, err
		}
		next.Status = StatusActive
		next.DoorDeck = append([]string(nil), payload.DoorDeck...)
		next.TreasureDeck = append([]string(nil), payload.TreasureDeck...)
		next.RNGState = payload.RNGState
		for index := range next.Players {
			next.Players[index].Hand = append([]string(nil), payload.Hands[next.Players[index].ID]...)
		}
		next.Turn = Turn{PlayerID: payload.TurnPlayerID, Phase: PhaseOpenDoor}
	case EventDoorResolved:
		payload, err := decode[doorResolvedPayload](event)
		if err != nil {
			return State{}, err
		}
		index := next.PlayerIndex(payload.PlayerID)
		if index < 0 {
			return State{}, fmt.Errorf("%w: event player", ErrIllegalCommand)
		}
		next.Players[index].Hand = append([]string(nil), payload.Hand...)
		next.Players[index].Level = payload.Level
		next.DoorDeck = append([]string(nil), payload.DoorDeck...)
		next.DoorDiscard = append([]string(nil), payload.DoorDiscard...)
		next.Turn.Phase = payload.Phase
		if payload.EncounterID != "" {
			next.Turn.Encounter = &Encounter{CardID: payload.EncounterID}
		} else {
			next.Turn.Encounter = nil
		}
	case EventCombatResolved:
		payload, err := decode[combatResolvedPayload](event)
		if err != nil {
			return State{}, err
		}
		index := next.PlayerIndex(payload.PlayerID)
		if index < 0 {
			return State{}, fmt.Errorf("%w: event player", ErrIllegalCommand)
		}
		next.Players[index].Level = payload.Level
		next.Players[index].Hand = append([]string(nil), payload.Hand...)
		next.TreasureDeck = append([]string(nil), payload.TreasureDeck...)
		next.DoorDiscard = append([]string(nil), payload.DoorDiscard...)
		next.Turn.Encounter = nil
		next.Turn.Phase = payload.Phase
		next.Status = payload.Status
		next.WinnerPlayerID = payload.WinnerPlayerID
	case EventRunAwayResolved:
		payload, err := decode[runAwayResolvedPayload](event)
		if err != nil {
			return State{}, err
		}
		index := next.PlayerIndex(payload.PlayerID)
		if index < 0 {
			return State{}, fmt.Errorf("%w: event player", ErrIllegalCommand)
		}
		next.Players[index].Level = payload.Level
		next.RNGState = payload.RNGState
		next.DoorDiscard = append([]string(nil), payload.DoorDiscard...)
		next.Turn.Encounter = nil
		next.Turn.Phase = PhaseEndTurn
	case EventLooted:
		payload, err := decode[lootedPayload](event)
		if err != nil {
			return State{}, err
		}
		index := next.PlayerIndex(payload.PlayerID)
		if index < 0 {
			return State{}, fmt.Errorf("%w: event player", ErrIllegalCommand)
		}
		next.Players[index].Hand = append([]string(nil), payload.Hand...)
		next.TreasureDeck = append([]string(nil), payload.TreasureDeck...)
		next.Turn.Phase = PhaseEndTurn
	case EventTurnAdvanced:
		payload, err := decode[turnAdvancedPayload](event)
		if err != nil {
			return State{}, err
		}
		next.Turn = Turn{PlayerID: payload.PlayerID, Phase: PhaseOpenDoor}
	default:
		return State{}, fmt.Errorf("%w: unknown event %s", ErrIllegalCommand, event.Type)
	}
	next.Version++
	if err := next.Validate(); err != nil {
		return State{}, err
	}
	return next, nil
}

func Replay(events []EventEnvelope) (State, error) {
	return ReplayFrom(State{}, events)
}

func ReplayFrom(initial State, events []EventEnvelope) (State, error) {
	state := initial.Clone()
	gameID := state.GameID
	for index, envelope := range events {
		expected := initial.Version + uint64(index) + 1
		if envelope.Sequence != expected ||
			envelope.GameID == "" ||
			envelope.EventID == "" ||
			envelope.CommandID == "" ||
			envelope.Type == "" ||
			envelope.Schema != 1 ||
			envelope.OccurredAt.IsZero() {
			return State{}, fmt.Errorf("invalid event envelope at sequence %d", expected)
		}
		if gameID == "" {
			gameID = envelope.GameID
		}
		if envelope.GameID != gameID {
			return State{}, fmt.Errorf("event game: got %s want %s", envelope.GameID, gameID)
		}
		if envelope.Sequence != expected {
			return State{}, fmt.Errorf("event sequence: got %d want %d", envelope.Sequence, expected)
		}
		next, err := Apply(state, DomainEvent{Type: envelope.Type, Payload: envelope.Payload})
		if err != nil {
			return State{}, err
		}
		if next.GameID != gameID {
			return State{}, fmt.Errorf("state game: got %s want %s", next.GameID, gameID)
		}
		if next.Version != expected {
			return State{}, fmt.Errorf("state version: got %d want %d", next.Version, expected)
		}
		state = next
	}
	return state, nil
}

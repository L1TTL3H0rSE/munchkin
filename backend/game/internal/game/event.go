package game

import (
	"encoding/json"
	"fmt"
	"time"
)

const (
	EventLobbyCreated     = "game.v1.lobby_created"
	EventPlayerJoined     = "game.v2.player_joined"
	EventGameStarted      = "game.v2.game_started"
	EventSetupFinished    = "game.v2.setup_finished"
	EventCardPlayed       = "game.v2.card_played"
	EventEquipmentChanged = "game.v2.equipment_changed"
	EventItemsSold        = "game.v2.items_sold"
	EventDoorOpened       = "game.v2.door_opened"
	EventTroubleSought    = "game.v2.trouble_sought"
	EventRoomLooted       = "game.v2.room_looted"
	EventCombatAction     = "game.v2.combat_action"
	EventCombatResolved   = "game.v2.combat_resolved"
	EventRunAwayResolved  = "game.v2.run_away_resolved"
	EventEffectResolved   = "game.v2.effect_resolved"
	EventCharityResolved  = "game.v2.charity_resolved"
	EventTurnAdvanced     = "game.v2.turn_advanced"

	legacyEventPlayerJoined    = "game.v1.player_joined"
	legacyEventGameStarted     = "game.v1.game_started"
	legacyEventDoorResolved    = "game.v1.door_resolved"
	legacyEventCombatResolved  = "game.v1.combat_resolved"
	legacyEventRunAwayResolved = "game.v1.run_away_resolved"
	legacyEventLooted          = "game.v1.looted"
	legacyEventTurnAdvanced    = "game.v1.turn_advanced"
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

type RandomOutcome struct {
	Kind  string   `json:"kind"`
	Deck  DeckKind `json:"deck,omitempty"`
	Roll  int      `json:"roll,omitempty"`
	Order []string `json:"order,omitempty"`
}

type lobbyCreatedPayload struct {
	GameID              string `json:"game_id"`
	Owner               Player `json:"owner"`
	Seed                uint64 `json:"seed"`
	ContentSetID        string `json:"content_set_id"`
	ContentVersion      int    `json:"content_version"`
	ContentDigest       string `json:"content_digest"`
	RulesProfileID      string `json:"rules_profile_id"`
	RulesProfileVersion int    `json:"rules_profile_version"`
}

type stateChangedPayload struct {
	Reason   CommandType     `json:"reason"`
	State    State           `json:"state"`
	Outcomes []RandomOutcome `json:"outcomes,omitempty"`
}

func newEvent(eventType string, payload any) (DomainEvent, error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return DomainEvent{}, err
	}
	return DomainEvent{Type: eventType, Payload: raw}, nil
}

func newStateEvent(
	eventType string,
	reason CommandType,
	next State,
	outcomes []RandomOutcome,
) (DomainEvent, error) {
	return newEvent(eventType, stateChangedPayload{
		Reason:   reason,
		State:    next,
		Outcomes: outcomes,
	})
}

func decode[T any](event DomainEvent) (T, error) {
	var payload T
	if err := json.Unmarshal(event.Payload, &payload); err != nil {
		return payload, fmt.Errorf("decode %s: %w", event.Type, err)
	}
	return payload, nil
}

func Apply(state State, event DomainEvent) (State, error) {
	switch event.Type {
	case EventLobbyCreated:
		payload, err := decode[lobbyCreatedPayload](event)
		if err != nil {
			return State{}, err
		}
		next := State{
			GameID:              payload.GameID,
			Status:              StatusLobby,
			OwnerPlayerID:       payload.Owner.ID,
			Players:             []Player{payload.Owner.clone()},
			RNGState:            payload.Seed,
			ContentSetID:        payload.ContentSetID,
			ContentVersion:      payload.ContentVersion,
			ContentDigest:       payload.ContentDigest,
			RulesProfileID:      payload.RulesProfileID,
			RulesProfileVersion: payload.RulesProfileVersion,
		}
		next.Version = state.Version + 1
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventPlayerJoined,
		EventGameStarted,
		EventSetupFinished,
		EventCardPlayed,
		EventEquipmentChanged,
		EventItemsSold,
		EventDoorOpened,
		EventTroubleSought,
		EventRoomLooted,
		EventCombatAction,
		EventCombatResolved,
		EventRunAwayResolved,
		EventEffectResolved,
		EventCharityResolved,
		EventTurnAdvanced:
		payload, err := decode[stateChangedPayload](event)
		if err != nil {
			return State{}, err
		}
		next := payload.State.Clone()
		if next.GameID != state.GameID ||
			next.Version != state.Version ||
			next.ContentSetID != state.ContentSetID ||
			next.ContentVersion != state.ContentVersion ||
			next.ContentDigest != state.ContentDigest ||
			next.RulesProfileID != state.RulesProfileID ||
			next.RulesProfileVersion != state.RulesProfileVersion {
			return State{}, fmt.Errorf(
				"%w: transition identity or base version differs",
				ErrIllegalCommand,
			)
		}
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case legacyEventPlayerJoined,
		legacyEventGameStarted,
		legacyEventDoorResolved,
		legacyEventCombatResolved,
		legacyEventRunAwayResolved,
		legacyEventLooted,
		legacyEventTurnAdvanced:
		return State{}, fmt.Errorf(
			"%w: bootstrap event %s predates %s",
			ErrIncompatibleState,
			event.Type,
			FirstEditionCoreProfileID,
		)
	default:
		return State{}, fmt.Errorf("%w: unknown event %s", ErrIllegalCommand, event.Type)
	}
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
		next, err := Apply(
			state,
			DomainEvent{Type: envelope.Type, Payload: envelope.Payload},
		)
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

package game

import (
	"errors"
	"fmt"
)

const (
	MinPlayers   = 2
	MaxPlayers   = 4
	WinningLevel = 5
)

var (
	ErrIllegalCommand = errors.New("illegal command")
	ErrUnknownCard    = errors.New("unknown card")
	ErrInvalidContent = errors.New("invalid content")
)

type Status string

const (
	StatusLobby    Status = "lobby"
	StatusActive   Status = "active"
	StatusFinished Status = "finished"
)

type Phase string

const (
	PhaseOpenDoor       Phase = "open_door"
	PhaseCombatDecision Phase = "combat_decision"
	PhaseLootDecision   Phase = "loot_decision"
	PhaseEndTurn        Phase = "end_turn"
)

type CardKind string

const (
	CardMonster  CardKind = "monster"
	CardCurse    CardKind = "curse"
	CardDoor     CardKind = "door"
	CardTreasure CardKind = "treasure"
)

type Player struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Level          int      `json:"level"`
	CombatBonus    int      `json:"combat_bonus"`
	Hand           []string `json:"hand"`
	CredentialHash string   `json:"credential_hash"`
}

type Encounter struct {
	CardID string `json:"card_id"`
}

type Turn struct {
	PlayerID  string     `json:"player_id"`
	Phase     Phase      `json:"phase"`
	Encounter *Encounter `json:"encounter,omitempty"`
}

type State struct {
	GameID          string   `json:"game_id"`
	Version         uint64   `json:"version"`
	Status          Status   `json:"status"`
	OwnerPlayerID   string   `json:"owner_player_id"`
	Players         []Player `json:"players"`
	Turn            Turn     `json:"turn"`
	DoorDeck        []string `json:"door_deck"`
	TreasureDeck    []string `json:"treasure_deck"`
	DoorDiscard     []string `json:"door_discard"`
	TreasureDiscard []string `json:"treasure_discard"`
	RNGState        uint64   `json:"rng_state"`
	ContentSetID    string   `json:"content_set_id"`
	ContentVersion  int      `json:"content_version"`
	ContentDigest   string   `json:"content_digest"`
	WinnerPlayerID  string   `json:"winner_player_id,omitempty"`
}

func (s State) Clone() State {
	clone := s
	clone.Players = make([]Player, len(s.Players))
	for index, player := range s.Players {
		clone.Players[index] = player
		clone.Players[index].Hand = append([]string(nil), player.Hand...)
	}
	clone.DoorDeck = append([]string(nil), s.DoorDeck...)
	clone.TreasureDeck = append([]string(nil), s.TreasureDeck...)
	clone.DoorDiscard = append([]string(nil), s.DoorDiscard...)
	clone.TreasureDiscard = append([]string(nil), s.TreasureDiscard...)
	if s.Turn.Encounter != nil {
		encounter := *s.Turn.Encounter
		clone.Turn.Encounter = &encounter
	}
	return clone
}

func (s State) PlayerIndex(playerID string) int {
	for index := range s.Players {
		if s.Players[index].ID == playerID {
			return index
		}
	}
	return -1
}

func (s State) ActorByCredentialHash(hash string) (string, bool) {
	if hash == "" {
		return "", false
	}
	for _, player := range s.Players {
		if player.CredentialHash == hash {
			return player.ID, true
		}
	}
	return "", false
}

func (s State) Validate() error {
	if s.GameID == "" || s.OwnerPlayerID == "" {
		return fmt.Errorf("%w: game and owner IDs are required", ErrIllegalCommand)
	}
	if len(s.Players) == 0 || len(s.Players) > MaxPlayers {
		return fmt.Errorf("%w: invalid player count", ErrIllegalCommand)
	}
	seenPlayers := map[string]struct{}{}
	seenCredentials := map[string]struct{}{}
	for _, player := range s.Players {
		if player.ID == "" || player.Name == "" || player.Level < 1 || player.CredentialHash == "" {
			return fmt.Errorf("%w: invalid player", ErrIllegalCommand)
		}
		if _, exists := seenPlayers[player.ID]; exists {
			return fmt.Errorf("%w: duplicate player", ErrIllegalCommand)
		}
		if _, exists := seenCredentials[player.CredentialHash]; exists {
			return fmt.Errorf("%w: duplicate credential", ErrIllegalCommand)
		}
		seenPlayers[player.ID] = struct{}{}
		seenCredentials[player.CredentialHash] = struct{}{}
	}
	if s.Status == StatusActive {
		if s.PlayerIndex(s.Turn.PlayerID) < 0 || s.Turn.Phase == "" {
			return fmt.Errorf("%w: invalid active turn", ErrIllegalCommand)
		}
	}
	if s.Status == StatusFinished && s.PlayerIndex(s.WinnerPlayerID) < 0 {
		return fmt.Errorf("%w: invalid winner", ErrIllegalCommand)
	}
	return nil
}

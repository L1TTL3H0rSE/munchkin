package game

import (
	"errors"
	"fmt"
	"slices"
)

const (
	FirstEditionCoreProfileID      = "first-edition-core-v1"
	FirstEditionCoreProfileVersion = 1
	MinPlayers                     = 1
	MaxPlayers                     = 6
	WinningLevel                   = 10
	DefaultHandLimit               = 5
	SaleLevelCost                  = 1000
)

var (
	ErrIllegalCommand    = errors.New("illegal command")
	ErrUnknownCard       = errors.New("unknown card")
	ErrInvalidContent    = errors.New("invalid content")
	ErrIncompatibleState = errors.New("incompatible game state")
)

type RulesProfile struct {
	ID                   string `json:"id"`
	Version              int    `json:"version"`
	MinPlayers           int    `json:"min_players"`
	MaxPlayers           int    `json:"max_players"`
	InitialDoorCards     int    `json:"initial_door_cards"`
	InitialTreasureCards int    `json:"initial_treasure_cards"`
	WinningLevel         int    `json:"winning_level"`
	HandLimit            int    `json:"hand_limit"`
	RunAwayTarget        int    `json:"run_away_target"`
}

func FirstEditionCoreProfile() RulesProfile {
	return RulesProfile{
		ID:                   FirstEditionCoreProfileID,
		Version:              FirstEditionCoreProfileVersion,
		MinPlayers:           MinPlayers,
		MaxPlayers:           MaxPlayers,
		InitialDoorCards:     4,
		InitialTreasureCards: 4,
		WinningLevel:         WinningLevel,
		HandLimit:            DefaultHandLimit,
		RunAwayTarget:        5,
	}
}

func (profile RulesProfile) Validate() error {
	if profile.ID != FirstEditionCoreProfileID ||
		profile.Version != FirstEditionCoreProfileVersion ||
		profile.MinPlayers != MinPlayers ||
		profile.MaxPlayers != MaxPlayers ||
		profile.InitialDoorCards != 4 ||
		profile.InitialTreasureCards != 4 ||
		profile.WinningLevel != WinningLevel ||
		profile.HandLimit != DefaultHandLimit ||
		profile.RunAwayTarget != 5 {
		return fmt.Errorf("%w: unsupported rules profile", ErrIncompatibleState)
	}
	return nil
}

type Status string

const (
	StatusLobby    Status = "lobby"
	StatusActive   Status = "active"
	StatusFinished Status = "finished"
)

type Phase string

const (
	PhaseSetup         Phase = "setup"
	PhasePreparation   Phase = "preparation"
	PhaseDoorChoice    Phase = "door_choice"
	PhaseCombat        Phase = "combat"
	PhaseRunAway       Phase = "run_away"
	PhaseResolveEffect Phase = "resolve_effect"
	PhaseCharity       Phase = "charity"
	PhaseEndTurn       Phase = "end_turn"
)

type CardInstance struct {
	ID           string `json:"id"`
	DefinitionID string `json:"definition_id"`
}

type Player struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Level            int               `json:"level"`
	CharacterTags    []string          `json:"character_tags,omitempty"`
	SuppressedTags   []string          `json:"suppressed_tags,omitempty"`
	Hand             []string          `json:"hand,omitempty"`
	Carried          []string          `json:"carried,omitempty"`
	Equipped         []string          `json:"equipped,omitempty"`
	Traits           []string          `json:"traits,omitempty"`
	Attachments      []string          `json:"attachments,omitempty"`
	PersistentCurses []string          `json:"persistent_curses,omitempty"`
	CheatTargets     map[string]string `json:"cheat_targets,omitempty"`
	SetupDone        bool              `json:"setup_done"`
	Dead             bool              `json:"dead"`
	NeedsRedraw      bool              `json:"needs_redraw"`
	CredentialHash   string            `json:"credential_hash"`
}

func (player Player) clone() Player {
	clone := player
	clone.CharacterTags = append([]string(nil), player.CharacterTags...)
	clone.SuppressedTags = append([]string(nil), player.SuppressedTags...)
	clone.Hand = append([]string(nil), player.Hand...)
	clone.Carried = append([]string(nil), player.Carried...)
	clone.Equipped = append([]string(nil), player.Equipped...)
	clone.Traits = append([]string(nil), player.Traits...)
	clone.Attachments = append([]string(nil), player.Attachments...)
	clone.PersistentCurses = append([]string(nil), player.PersistentCurses...)
	if player.CheatTargets != nil {
		clone.CheatTargets = make(map[string]string, len(player.CheatTargets))
		for attachmentID, targetID := range player.CheatTargets {
			clone.CheatTargets[attachmentID] = targetID
		}
	}
	return clone
}

func (player Player) allOwnedZones() [][]string {
	return [][]string{
		player.Hand,
		player.Carried,
		player.Equipped,
		player.Traits,
		player.Attachments,
		player.PersistentCurses,
	}
}

type Encounter struct {
	MonsterInstanceID      string `json:"monster_instance_id"`
	PlayerCombatModifier   int    `json:"player_combat_modifier"`
	MonsterCombatModifier  int    `json:"monster_combat_modifier"`
	EscapeModifier         int    `json:"escape_modifier"`
	TreasureRewardModifier int    `json:"treasure_reward_modifier"`
	CombatClosed           bool   `json:"combat_closed"`
}

type ActionWindow struct {
	Kind             string   `json:"kind"`
	EligibleActorIDs []string `json:"eligible_actor_ids"`
}

type PendingFinalize struct {
	Phase            Phase  `json:"phase"`
	DiscardSource    bool   `json:"discard_source"`
	ClearEncounter   bool   `json:"clear_encounter"`
	SourceInstanceID string `json:"source_instance_id,omitempty"`
}

type PendingDecision struct {
	Type             string          `json:"type"`
	ActorID          string          `json:"actor_id"`
	SourceInstanceID string          `json:"source_instance_id,omitempty"`
	Options          []string        `json:"options"`
	Minimum          int             `json:"minimum"`
	Maximum          int             `json:"maximum"`
	Effect           Effect          `json:"effect"`
	RemainingEffects []Effect        `json:"remaining_effects,omitempty"`
	Finalize         PendingFinalize `json:"finalize"`
}

func (decision *PendingDecision) clone() *PendingDecision {
	if decision == nil {
		return nil
	}
	clone := *decision
	clone.Options = append([]string(nil), decision.Options...)
	clone.RemainingEffects = append([]Effect(nil), decision.RemainingEffects...)
	return &clone
}

type Turn struct {
	PlayerID     string           `json:"player_id"`
	Phase        Phase            `json:"phase"`
	Encounter    *Encounter       `json:"encounter,omitempty"`
	Resolving    []string         `json:"resolving,omitempty"`
	ActionWindow ActionWindow     `json:"action_window"`
	Pending      *PendingDecision `json:"pending,omitempty"`
}

type State struct {
	GameID              string                  `json:"game_id"`
	Version             uint64                  `json:"version"`
	Status              Status                  `json:"status"`
	OwnerPlayerID       string                  `json:"owner_player_id"`
	Players             []Player                `json:"players"`
	Turn                Turn                    `json:"turn"`
	Instances           map[string]CardInstance `json:"instances,omitempty"`
	DoorDeck            []string                `json:"door_deck,omitempty"`
	TreasureDeck        []string                `json:"treasure_deck,omitempty"`
	DoorDiscard         []string                `json:"door_discard,omitempty"`
	TreasureDiscard     []string                `json:"treasure_discard,omitempty"`
	RNGState            uint64                  `json:"rng_state"`
	ContentSetID        string                  `json:"content_set_id"`
	ContentVersion      int                     `json:"content_version"`
	ContentDigest       string                  `json:"content_digest"`
	RulesProfileID      string                  `json:"rules_profile_id"`
	RulesProfileVersion int                     `json:"rules_profile_version"`
	WinnerPlayerID      string                  `json:"winner_player_id,omitempty"`
}

func (state State) Clone() State {
	clone := state
	clone.Players = make([]Player, len(state.Players))
	for index, player := range state.Players {
		clone.Players[index] = player.clone()
	}
	if state.Instances != nil {
		clone.Instances = make(map[string]CardInstance, len(state.Instances))
		for instanceID, instance := range state.Instances {
			clone.Instances[instanceID] = instance
		}
	}
	clone.DoorDeck = append([]string(nil), state.DoorDeck...)
	clone.TreasureDeck = append([]string(nil), state.TreasureDeck...)
	clone.DoorDiscard = append([]string(nil), state.DoorDiscard...)
	clone.TreasureDiscard = append([]string(nil), state.TreasureDiscard...)
	clone.Turn.Resolving = append([]string(nil), state.Turn.Resolving...)
	clone.Turn.ActionWindow.EligibleActorIDs = append(
		[]string(nil),
		state.Turn.ActionWindow.EligibleActorIDs...,
	)
	clone.Turn.Pending = state.Turn.Pending.clone()
	if state.Turn.Encounter != nil {
		encounter := *state.Turn.Encounter
		clone.Turn.Encounter = &encounter
	}
	return clone
}

func (state State) PlayerIndex(playerID string) int {
	for index := range state.Players {
		if state.Players[index].ID == playerID {
			return index
		}
	}
	return -1
}

func (state State) ActorByCredentialHash(hash string) (string, bool) {
	if hash == "" {
		return "", false
	}
	for _, player := range state.Players {
		if player.CredentialHash == hash {
			return player.ID, true
		}
	}
	return "", false
}

func (state State) Profile() (RulesProfile, error) {
	profile := FirstEditionCoreProfile()
	if state.RulesProfileID != profile.ID ||
		state.RulesProfileVersion != profile.Version {
		return RulesProfile{}, fmt.Errorf(
			"%w: rules profile %q v%d",
			ErrIncompatibleState,
			state.RulesProfileID,
			state.RulesProfileVersion,
		)
	}
	return profile, nil
}

func (state State) Validate() error {
	if state.GameID == "" || state.OwnerPlayerID == "" {
		return fmt.Errorf("%w: game and owner IDs are required", ErrIllegalCommand)
	}
	profile, err := state.Profile()
	if err != nil {
		return err
	}
	if len(state.Players) < 1 || len(state.Players) > profile.MaxPlayers {
		return fmt.Errorf("%w: invalid player count", ErrIllegalCommand)
	}
	seenPlayers := map[string]struct{}{}
	seenCredentials := map[string]struct{}{}
	for _, player := range state.Players {
		if player.ID == "" ||
			player.Name == "" ||
			player.Level < 1 ||
			player.Level > profile.WinningLevel ||
			player.CredentialHash == "" {
			return fmt.Errorf("%w: invalid player", ErrIllegalCommand)
		}
		if _, exists := seenPlayers[player.ID]; exists {
			return fmt.Errorf("%w: duplicate player", ErrIllegalCommand)
		}
		if _, exists := seenCredentials[player.CredentialHash]; exists {
			return fmt.Errorf("%w: duplicate credential", ErrIllegalCommand)
		}
		if player.Dead && !player.NeedsRedraw {
			return fmt.Errorf("%w: dead player must await redraw", ErrIllegalCommand)
		}
		for attachmentID, targetID := range player.CheatTargets {
			if !slices.Contains(player.Attachments, attachmentID) ||
				(!slices.Contains(player.Carried, targetID) &&
					!slices.Contains(player.Equipped, targetID)) {
				return fmt.Errorf("%w: invalid cheat attachment", ErrIllegalCommand)
			}
		}
		seenPlayers[player.ID] = struct{}{}
		seenCredentials[player.CredentialHash] = struct{}{}
	}
	if state.PlayerIndex(state.OwnerPlayerID) < 0 {
		return fmt.Errorf("%w: owner is not a player", ErrIllegalCommand)
	}
	switch state.Status {
	case StatusLobby:
		if state.Turn.PlayerID != "" || state.Turn.Phase != "" {
			return fmt.Errorf("%w: lobby has active turn", ErrIllegalCommand)
		}
	case StatusActive:
		if state.PlayerIndex(state.Turn.PlayerID) < 0 ||
			!validPhase(state.Turn.Phase) ||
			len(state.Turn.ActionWindow.EligibleActorIDs) != 1 ||
			state.Turn.ActionWindow.EligibleActorIDs[0] != state.Turn.PlayerID {
			return fmt.Errorf("%w: invalid active turn", ErrIllegalCommand)
		}
		if state.Turn.Pending != nil &&
			state.Turn.Pending.ActorID != state.Turn.PlayerID {
			return fmt.Errorf("%w: pending actor differs from active actor", ErrIllegalCommand)
		}
	case StatusFinished:
		if state.PlayerIndex(state.WinnerPlayerID) < 0 {
			return fmt.Errorf("%w: invalid winner", ErrIllegalCommand)
		}
	default:
		return fmt.Errorf("%w: invalid status", ErrIllegalCommand)
	}
	if state.Status != StatusLobby {
		if err := state.validateInstanceZones(); err != nil {
			return err
		}
	}
	return nil
}

func validPhase(phase Phase) bool {
	switch phase {
	case PhaseSetup,
		PhasePreparation,
		PhaseDoorChoice,
		PhaseCombat,
		PhaseRunAway,
		PhaseResolveEffect,
		PhaseCharity,
		PhaseEndTurn:
		return true
	default:
		return false
	}
}

func (state State) validateInstanceZones() error {
	if len(state.Instances) == 0 {
		return fmt.Errorf("%w: active game has no card instances", ErrIllegalCommand)
	}
	owners := make(map[string]string, len(state.Instances))
	add := func(zone string, instanceIDs []string) error {
		for _, instanceID := range instanceIDs {
			if _, exists := state.Instances[instanceID]; !exists {
				return fmt.Errorf("%w: unknown instance %s in %s", ErrIllegalCommand, instanceID, zone)
			}
			if previous, exists := owners[instanceID]; exists {
				return fmt.Errorf(
					"%w: instance %s belongs to %s and %s",
					ErrIllegalCommand,
					instanceID,
					previous,
					zone,
				)
			}
			owners[instanceID] = zone
		}
		return nil
	}
	if err := add("door_deck", state.DoorDeck); err != nil {
		return err
	}
	if err := add("treasure_deck", state.TreasureDeck); err != nil {
		return err
	}
	if err := add("door_discard", state.DoorDiscard); err != nil {
		return err
	}
	if err := add("treasure_discard", state.TreasureDiscard); err != nil {
		return err
	}
	if err := add("turn_resolving", state.Turn.Resolving); err != nil {
		return err
	}
	if state.Turn.Encounter != nil {
		if err := add(
			"encounter",
			[]string{state.Turn.Encounter.MonsterInstanceID},
		); err != nil {
			return err
		}
	}
	for _, player := range state.Players {
		names := []string{
			"hand",
			"carried",
			"equipped",
			"traits",
			"attachments",
			"persistent_curses",
		}
		for index, zone := range player.allOwnedZones() {
			if err := add(player.ID+":"+names[index], zone); err != nil {
				return err
			}
		}
	}
	if len(owners) != len(state.Instances) {
		for instanceID := range state.Instances {
			if _, exists := owners[instanceID]; !exists {
				return fmt.Errorf(
					"%w: instance %s has no zone",
					ErrIllegalCommand,
					instanceID,
				)
			}
		}
	}
	return nil
}

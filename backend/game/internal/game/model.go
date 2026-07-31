package game

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

const (
	FirstEditionCoreProfileID      = "first-edition-core-v1"
	FirstEditionCoreProfileVersion = 1
	LobbyMultiplayerProfileID      = "lobby-multiplayer-v1"
	LobbyMultiplayerProfileVersion = 1
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
	CombatResponses      bool   `json:"combat_responses"`
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

func LobbyMultiplayerProfile() RulesProfile {
	profile := FirstEditionCoreProfile()
	profile.ID = LobbyMultiplayerProfileID
	profile.Version = LobbyMultiplayerProfileVersion
	profile.CombatResponses = true
	return profile
}

func (profile RulesProfile) Validate() error {
	expected, ok := rulesProfile(profile.ID, profile.Version)
	if !ok || profile != expected {
		return fmt.Errorf("%w: unsupported rules profile", ErrIncompatibleState)
	}
	return nil
}

func rulesProfile(id string, version int) (RulesProfile, bool) {
	switch {
	case id == FirstEditionCoreProfileID &&
		version == FirstEditionCoreProfileVersion:
		return FirstEditionCoreProfile(), true
	case id == LobbyMultiplayerProfileID &&
		version == LobbyMultiplayerProfileVersion:
		return LobbyMultiplayerProfile(), true
	default:
		return RulesProfile{}, false
	}
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

type InteractionKind string

const (
	InteractionKindCombatResponse    InteractionKind = "combat_response"
	InteractionKindAddressedResponse InteractionKind = "addressed_response"
	InteractionKindPrivateChoice     InteractionKind = "private_choice"
)

type InteractionSubjectKind string

const (
	InteractionSubjectTurn        InteractionSubjectKind = "turn"
	InteractionSubjectEncounter   InteractionSubjectKind = "encounter"
	InteractionSubjectEffect      InteractionSubjectKind = "effect"
	InteractionSubjectInteraction InteractionSubjectKind = "interaction"
)

type InteractionEligibilityPolicy string

const (
	InteractionEligibilityPublicPredicate InteractionEligibilityPolicy = "public_predicate"
	InteractionEligibilityActorPrivate    InteractionEligibilityPolicy = "actor_private"
	InteractionEligibilityOpaquePublicSet InteractionEligibilityPolicy = "opaque_public_set"
)

type InteractionIntent string

const (
	InteractionIntentPass        InteractionIntent = "pass"
	InteractionIntentRespond     InteractionIntent = "respond"
	InteractionIntentAccept      InteractionIntent = "accept"
	InteractionIntentDecline     InteractionIntent = "decline"
	InteractionIntentAutoResolve InteractionIntent = "auto_resolve"
)

type InteractionResponseRequirement string

const (
	InteractionResponseOptional  InteractionResponseRequirement = "optional"
	InteractionResponseMandatory InteractionResponseRequirement = "mandatory"
)

type InteractionResponseState string

const (
	InteractionResponsePending      InteractionResponseState = "pending"
	InteractionResponsePassed       InteractionResponseState = "passed"
	InteractionResponseActed        InteractionResponseState = "acted"
	InteractionResponseAccepted     InteractionResponseState = "accepted"
	InteractionResponseDeclined     InteractionResponseState = "declined"
	InteractionResponseTimedOut     InteractionResponseState = "timed_out"
	InteractionResponseAutoResolved InteractionResponseState = "auto_resolved"
)

type InteractionWindowStatus string

const (
	InteractionWindowOpen   InteractionWindowStatus = "open"
	InteractionWindowClosed InteractionWindowStatus = "closed"
)

type InteractionCloseReason string

const (
	InteractionCloseAllResponded       InteractionCloseReason = "all_responded"
	InteractionCloseAccepted           InteractionCloseReason = "accepted"
	InteractionCloseDeclined           InteractionCloseReason = "declined"
	InteractionCloseCancelled          InteractionCloseReason = "cancelled"
	InteractionCloseSuperseded         InteractionCloseReason = "superseded"
	InteractionCloseDeadlineExpired    InteractionCloseReason = "deadline_expired"
	InteractionCloseAutoSkipped        InteractionCloseReason = "auto_skipped_no_public_action"
	InteractionCloseSubjectInvalidated InteractionCloseReason = "subject_invalidated"
	InteractionCloseParentClosed       InteractionCloseReason = "parent_closed"
	InteractionCloseGameFinished       InteractionCloseReason = "game_finished"
)

type InteractionParent struct {
	Phase               Phase                  `json:"phase"`
	SubjectKind         InteractionSubjectKind `json:"subject_kind"`
	SubjectID           string                 `json:"subject_id"`
	ParentInteractionID string                 `json:"parent_interaction_id,omitempty"`
}

type InteractionDeadlinePolicy struct {
	BaseSeconds          int `json:"base_seconds"`
	LateThresholdSeconds int `json:"late_threshold_seconds,omitempty"`
	ExtensionStepSeconds int `json:"extension_step_seconds,omitempty"`
	MaxSeconds           int `json:"max_seconds"`
}

type InteractionResponse struct {
	Requirement   InteractionResponseRequirement `json:"requirement"`
	TimeoutIntent InteractionIntent              `json:"timeout_intent"`
	State         InteractionResponseState       `json:"state"`
	Intent        InteractionIntent              `json:"intent,omitempty"`
	AcceptedAt    time.Time                      `json:"accepted_at,omitempty"`
}

type InteractionWindow struct {
	ID                     string                         `json:"interaction_id"`
	Kind                   InteractionKind                `json:"kind"`
	Parent                 InteractionParent              `json:"parent"`
	InitiatorActorID       string                         `json:"initiator_actor_id"`
	EligibilityPolicy      InteractionEligibilityPolicy   `json:"eligibility_policy"`
	AllowedIntents         []InteractionIntent            `json:"allowed_intents"`
	EligibleActorIDs       []string                       `json:"eligible_actor_ids"`
	OpenedAt               time.Time                      `json:"opened_at"`
	DeadlineAt             time.Time                      `json:"deadline_at"`
	DeadlineRevision       uint32                         `json:"deadline_revision"`
	DeadlinePolicy         InteractionDeadlinePolicy      `json:"deadline_policy"`
	ExtensionBudgetSeconds int                            `json:"extension_budget_seconds"`
	Responses              map[string]InteractionResponse `json:"responses"`
	Status                 InteractionWindowStatus        `json:"status"`
	CloseReason            InteractionCloseReason         `json:"close_reason,omitempty"`
	ClosedAt               time.Time                      `json:"closed_at,omitempty"`
}

func (window InteractionWindow) clone() *InteractionWindow {
	clone := window
	clone.AllowedIntents = append([]InteractionIntent(nil), window.AllowedIntents...)
	clone.EligibleActorIDs = append([]string(nil), window.EligibleActorIDs...)
	if window.Responses != nil {
		clone.Responses = make(map[string]InteractionResponse, len(window.Responses))
		for actorID, response := range window.Responses {
			clone.Responses[actorID] = response
		}
	}
	return &clone
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
	InteractionWindow   *InteractionWindow      `json:"interaction_window,omitempty"`
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
	if state.InteractionWindow != nil {
		clone.InteractionWindow = state.InteractionWindow.clone()
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
	profile, ok := rulesProfile(
		state.RulesProfileID,
		state.RulesProfileVersion,
	)
	if !ok {
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
	if err := state.validateInteractionWindow(); err != nil {
		return err
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

func (state State) validateInteractionWindow() error {
	window := state.InteractionWindow
	if window == nil {
		return nil
	}
	if state.Status != StatusActive && window.Status == InteractionWindowOpen {
		return fmt.Errorf("%w: open interaction requires active game", ErrIllegalCommand)
	}
	if window.Status == InteractionWindowOpen &&
		window.Parent.Phase != state.Turn.Phase {
		return fmt.Errorf("%w: open interaction parent is stale", ErrIllegalCommand)
	}
	if window.Status == InteractionWindowOpen &&
		!state.interactionParentMatches(window.Parent) {
		return fmt.Errorf("%w: interaction parent subject is stale", ErrIllegalCommand)
	}
	if strings.TrimSpace(window.ID) == "" || len(window.ID) > 128 {
		return fmt.Errorf("%w: invalid interaction ID", ErrIllegalCommand)
	}
	if !validInteractionKind(window.Kind) {
		return fmt.Errorf("%w: invalid interaction kind", ErrIllegalCommand)
	}
	if !validPhase(window.Parent.Phase) ||
		!validInteractionSubjectKind(window.Parent.SubjectKind) ||
		strings.TrimSpace(window.Parent.SubjectID) == "" ||
		window.Parent.ParentInteractionID == window.ID {
		return fmt.Errorf("%w: invalid interaction parent", ErrIllegalCommand)
	}
	if state.PlayerIndex(window.InitiatorActorID) < 0 {
		return fmt.Errorf("%w: invalid interaction initiator", ErrIllegalCommand)
	}
	if !validInteractionEligibilityPolicy(window.EligibilityPolicy) {
		return fmt.Errorf("%w: invalid interaction eligibility policy", ErrIllegalCommand)
	}
	if len(window.AllowedIntents) == 0 || len(window.EligibleActorIDs) == 0 {
		return fmt.Errorf("%w: interaction actors and intents are required", ErrIllegalCommand)
	}
	seenIntents := make(map[InteractionIntent]struct{}, len(window.AllowedIntents))
	for _, intent := range window.AllowedIntents {
		if !validInteractionIntent(intent) {
			return fmt.Errorf("%w: invalid interaction intent", ErrIllegalCommand)
		}
		if _, exists := seenIntents[intent]; exists {
			return fmt.Errorf("%w: duplicate interaction intent", ErrIllegalCommand)
		}
		seenIntents[intent] = struct{}{}
	}
	seenActors := make(map[string]struct{}, len(window.EligibleActorIDs))
	for _, actorID := range window.EligibleActorIDs {
		if state.PlayerIndex(actorID) < 0 {
			return fmt.Errorf("%w: invalid eligible interaction actor", ErrIllegalCommand)
		}
		if _, exists := seenActors[actorID]; exists {
			return fmt.Errorf("%w: duplicate eligible interaction actor", ErrIllegalCommand)
		}
		seenActors[actorID] = struct{}{}
		response, exists := window.Responses[actorID]
		if !exists {
			return fmt.Errorf("%w: missing interaction response state", ErrIllegalCommand)
		}
		if err := validateInteractionResponse(response, seenIntents); err != nil {
			return err
		}
		if response.State != InteractionResponsePending {
			if response.AcceptedAt.Before(window.OpenedAt) {
				return fmt.Errorf(
					"%w: interaction response predates window",
					ErrIllegalCommand,
				)
			}
			switch response.State {
			case InteractionResponseTimedOut,
				InteractionResponseAutoResolved:
				if response.AcceptedAt.Before(window.DeadlineAt) {
					return fmt.Errorf(
						"%w: timeout response predates deadline",
						ErrIllegalCommand,
					)
				}
			default:
				if !response.AcceptedAt.Before(window.DeadlineAt) {
					return fmt.Errorf(
						"%w: interaction response missed deadline",
						ErrIllegalCommand,
					)
				}
			}
		}
	}
	if len(window.Responses) != len(seenActors) {
		return fmt.Errorf("%w: response exists for ineligible actor", ErrIllegalCommand)
	}
	if err := validateInteractionDeadline(*window); err != nil {
		return err
	}
	switch window.Status {
	case InteractionWindowOpen:
		if window.CloseReason != "" || !window.ClosedAt.IsZero() {
			return fmt.Errorf("%w: open interaction has close state", ErrIllegalCommand)
		}
	case InteractionWindowClosed:
		if !validInteractionCloseReason(window.CloseReason) ||
			window.ClosedAt.IsZero() ||
			window.ClosedAt.Before(window.OpenedAt) {
			return fmt.Errorf("%w: closed interaction lacks terminal state", ErrIllegalCommand)
		}
		switch window.CloseReason {
		case InteractionCloseAllResponded:
			if !interactionAllResponded(*window) {
				return fmt.Errorf("%w: all-responded interaction is pending", ErrIllegalCommand)
			}
		case InteractionCloseAccepted:
			if !interactionHasResponseState(*window, InteractionResponseAccepted) {
				return fmt.Errorf("%w: accepted interaction has no acceptance", ErrIllegalCommand)
			}
		case InteractionCloseDeclined:
			if !interactionHasResponseState(*window, InteractionResponseDeclined) {
				return fmt.Errorf("%w: declined interaction has no decline", ErrIllegalCommand)
			}
		case InteractionCloseDeadlineExpired:
			if window.ClosedAt.Before(window.DeadlineAt) ||
				!interactionAllResponded(*window) {
				return fmt.Errorf("%w: invalid expired interaction", ErrIllegalCommand)
			}
		}
	default:
		return fmt.Errorf("%w: invalid interaction status", ErrIllegalCommand)
	}
	return nil
}

func (state State) interactionParentMatches(parent InteractionParent) bool {
	switch parent.SubjectKind {
	case InteractionSubjectTurn:
		return parent.SubjectID == state.Turn.PlayerID
	case InteractionSubjectEncounter:
		return state.Turn.Encounter != nil &&
			parent.SubjectID == state.Turn.Encounter.MonsterInstanceID
	case InteractionSubjectEffect:
		return slices.Contains(state.Turn.Resolving, parent.SubjectID)
	case InteractionSubjectInteraction:
		return parent.ParentInteractionID != "" &&
			parent.SubjectID == parent.ParentInteractionID
	default:
		return false
	}
}

func validateInteractionResponse(
	response InteractionResponse,
	allowed map[InteractionIntent]struct{},
) error {
	switch response.Requirement {
	case InteractionResponseOptional:
		if response.TimeoutIntent != InteractionIntentPass {
			return fmt.Errorf("%w: optional response must timeout as pass", ErrIllegalCommand)
		}
	case InteractionResponseMandatory:
		if response.TimeoutIntent != InteractionIntentAutoResolve {
			return fmt.Errorf("%w: mandatory response lacks typed default", ErrIllegalCommand)
		}
	default:
		return fmt.Errorf("%w: invalid response requirement", ErrIllegalCommand)
	}
	if _, exists := allowed[response.TimeoutIntent]; !exists {
		return fmt.Errorf("%w: timeout intent is not allowed", ErrIllegalCommand)
	}
	switch response.State {
	case InteractionResponsePending:
		if response.Intent != "" || !response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: pending response has outcome", ErrIllegalCommand)
		}
	case InteractionResponsePassed:
		if response.Intent != InteractionIntentPass || response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: malformed pass response", ErrIllegalCommand)
		}
	case InteractionResponseActed:
		if response.Intent != InteractionIntentRespond || response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: malformed acted response", ErrIllegalCommand)
		}
	case InteractionResponseAccepted:
		if response.Intent != InteractionIntentAccept || response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: malformed accepted response", ErrIllegalCommand)
		}
	case InteractionResponseDeclined:
		if response.Intent != InteractionIntentDecline || response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: malformed declined response", ErrIllegalCommand)
		}
	case InteractionResponseTimedOut:
		if response.Requirement != InteractionResponseOptional ||
			response.Intent != InteractionIntentPass ||
			response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: malformed timed-out response", ErrIllegalCommand)
		}
	case InteractionResponseAutoResolved:
		if response.Requirement != InteractionResponseMandatory ||
			response.Intent != response.TimeoutIntent ||
			response.AcceptedAt.IsZero() {
			return fmt.Errorf("%w: malformed auto-resolved response", ErrIllegalCommand)
		}
	default:
		return fmt.Errorf("%w: invalid interaction response state", ErrIllegalCommand)
	}
	if response.Intent != "" {
		if _, exists := allowed[response.Intent]; !exists {
			return fmt.Errorf("%w: response intent is not allowed", ErrIllegalCommand)
		}
	}
	return nil
}

func validateInteractionDeadline(window InteractionWindow) error {
	policy := window.DeadlinePolicy
	if window.OpenedAt.IsZero() ||
		window.DeadlineAt.IsZero() ||
		!window.DeadlineAt.After(window.OpenedAt) ||
		window.DeadlineRevision == 0 ||
		policy.BaseSeconds <= 0 ||
		policy.MaxSeconds < policy.BaseSeconds ||
		policy.LateThresholdSeconds < 0 ||
		policy.ExtensionStepSeconds < 0 ||
		window.ExtensionBudgetSeconds < 0 {
		return fmt.Errorf("%w: malformed interaction deadline", ErrIllegalCommand)
	}
	if policy.ExtensionStepSeconds == 0 {
		if policy.LateThresholdSeconds != 0 ||
			window.ExtensionBudgetSeconds != 0 ||
			policy.MaxSeconds != policy.BaseSeconds {
			return fmt.Errorf("%w: malformed non-extendable deadline", ErrIllegalCommand)
		}
	} else if policy.LateThresholdSeconds == 0 ||
		policy.LateThresholdSeconds > policy.MaxSeconds ||
		window.ExtensionBudgetSeconds > policy.MaxSeconds-policy.BaseSeconds {
		return fmt.Errorf("%w: malformed extendable deadline", ErrIllegalCommand)
	}
	hardDeadline := window.OpenedAt.Add(time.Duration(policy.MaxSeconds) * time.Second)
	if window.DeadlineAt.After(hardDeadline) ||
		window.DeadlineAt.Add(
			time.Duration(window.ExtensionBudgetSeconds)*time.Second,
		).After(hardDeadline) {
		return fmt.Errorf("%w: interaction deadline exceeds hard cap", ErrIllegalCommand)
	}
	return nil
}

func validInteractionKind(kind InteractionKind) bool {
	switch kind {
	case InteractionKindCombatResponse,
		InteractionKindAddressedResponse,
		InteractionKindPrivateChoice:
		return true
	default:
		return false
	}
}

func validInteractionSubjectKind(kind InteractionSubjectKind) bool {
	switch kind {
	case InteractionSubjectTurn,
		InteractionSubjectEncounter,
		InteractionSubjectEffect,
		InteractionSubjectInteraction:
		return true
	default:
		return false
	}
}

func validInteractionEligibilityPolicy(policy InteractionEligibilityPolicy) bool {
	switch policy {
	case InteractionEligibilityPublicPredicate,
		InteractionEligibilityActorPrivate,
		InteractionEligibilityOpaquePublicSet:
		return true
	default:
		return false
	}
}

func validInteractionIntent(intent InteractionIntent) bool {
	switch intent {
	case InteractionIntentPass,
		InteractionIntentRespond,
		InteractionIntentAccept,
		InteractionIntentDecline,
		InteractionIntentAutoResolve:
		return true
	default:
		return false
	}
}

func validInteractionCloseReason(reason InteractionCloseReason) bool {
	switch reason {
	case InteractionCloseAllResponded,
		InteractionCloseAccepted,
		InteractionCloseDeclined,
		InteractionCloseCancelled,
		InteractionCloseSuperseded,
		InteractionCloseDeadlineExpired,
		InteractionCloseAutoSkipped,
		InteractionCloseSubjectInvalidated,
		InteractionCloseParentClosed,
		InteractionCloseGameFinished:
		return true
	default:
		return false
	}
}

func interactionAllResponded(window InteractionWindow) bool {
	for _, actorID := range window.EligibleActorIDs {
		if window.Responses[actorID].State == InteractionResponsePending {
			return false
		}
	}
	return true
}

func interactionHasResponseState(
	window InteractionWindow,
	state InteractionResponseState,
) bool {
	for _, actorID := range window.EligibleActorIDs {
		if window.Responses[actorID].State == state {
			return true
		}
	}
	return false
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

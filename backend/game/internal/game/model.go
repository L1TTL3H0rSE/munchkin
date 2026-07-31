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
	AdvancedCombatProfileID        = "lobby-multiplayer-v2"
	AdvancedCombatProfileVersion   = 1
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
	AdvancedCombat       bool   `json:"advanced_combat"`
	TargetAndRunAway     bool   `json:"target_and_run_away"`
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

func AdvancedCombatProfile() RulesProfile {
	profile := LobbyMultiplayerProfile()
	profile.ID = AdvancedCombatProfileID
	profile.Version = AdvancedCombatProfileVersion
	profile.AdvancedCombat = true
	profile.TargetAndRunAway = true
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
	case id == AdvancedCombatProfileID &&
		version == AdvancedCombatProfileVersion:
		return AdvancedCombatProfile(), true
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
	MonsterInstanceID            string               `json:"monster_instance_id"`
	AdditionalMonsterInstanceIDs []string             `json:"additional_monster_instance_ids,omitempty"`
	CombatEffects                []CombatEffect       `json:"combat_effects,omitempty"`
	PlayerCombatModifier         int                  `json:"player_combat_modifier"`
	MonsterCombatModifier        int                  `json:"monster_combat_modifier"`
	EscapeModifier               int                  `json:"escape_modifier"`
	TreasureRewardModifier       int                  `json:"treasure_reward_modifier"`
	CombatClosed                 bool                 `json:"combat_closed"`
	CombatHelp                   *CombatHelpAgreement `json:"combat_help,omitempty"`
}

type CombatEffect struct {
	ID                      string               `json:"id"`
	Kind                    CombatCapabilityKind `json:"kind"`
	TargetMonsterInstanceID string               `json:"target_monster_instance_id,omitempty"`
	TargetEffectID          string               `json:"target_effect_id,omitempty"`
	Amount                  int                  `json:"amount,omitempty"`
	Active                  bool                 `json:"active"`
}

type CombatHelpRewardStatus string

const (
	CombatHelpRewardAccepted CombatHelpRewardStatus = "accepted"
	CombatHelpRewardSettled  CombatHelpRewardStatus = "settled"
	CombatHelpRewardVoided   CombatHelpRewardStatus = "voided"
)

type CombatHelpAgreement struct {
	HelperPlayerID  string                 `json:"helper_player_id"`
	RewardTreasures int                    `json:"reward_treasures"`
	RewardStatus    CombatHelpRewardStatus `json:"reward_status"`
	Forced          bool                   `json:"forced,omitempty"`
}

type CombatHelpOffer struct {
	ID                  string `json:"offer_id"`
	ParentInteractionID string `json:"parent_interaction_id"`
	CombatantPlayerID   string `json:"combatant_player_id"`
	HelperPlayerID      string `json:"helper_player_id"`
	RewardTreasures     int    `json:"reward_treasures"`
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
	InteractionKindTargetResponse    InteractionKind = "target_response"
	InteractionKindRunAwayResponse   InteractionKind = "run_away_response"
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
	InteractionIntentOfferHelp   InteractionIntent = "offer_help"
	InteractionIntentCancelHelp  InteractionIntent = "cancel_help"
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
	Phase             Phase  `json:"phase"`
	DiscardSource     bool   `json:"discard_source"`
	ClearEncounter    bool   `json:"clear_encounter"`
	ClearTargetEffect bool   `json:"clear_target_effect"`
	ContinueRunAway   bool   `json:"continue_run_away"`
	SourceInstanceID  string `json:"source_instance_id,omitempty"`
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
	PlayerID     string             `json:"player_id"`
	Phase        Phase              `json:"phase"`
	Encounter    *Encounter         `json:"encounter,omitempty"`
	Resolving    []string           `json:"resolving,omitempty"`
	ActionWindow ActionWindow       `json:"action_window"`
	Pending      *PendingDecision   `json:"pending,omitempty"`
	TargetEffect *TargetEffectState `json:"target_effect,omitempty"`
	RunAway      *RunAwaySequence   `json:"run_away,omitempty"`
}

type TargetEffectState struct {
	ID                string `json:"effect_id"`
	InitiatorPlayerID string `json:"initiator_player_id"`
	TargetPlayerID    string `json:"target_player_id"`
	SourceInstanceID  string `json:"source_instance_id"`
	ParentPhase       Phase  `json:"parent_phase"`
	Countered         bool   `json:"countered"`
}

func (effect *TargetEffectState) clone() *TargetEffectState {
	if effect == nil {
		return nil
	}
	clone := *effect
	return &clone
}

type RunAwayEffectKind string

const (
	RunAwayEffectModifier RunAwayEffectKind = "modifier"
	RunAwayEffectCounter  RunAwayEffectKind = "counter"
)

type RunAwayEffect struct {
	ID               string            `json:"id"`
	Kind             RunAwayEffectKind `json:"kind"`
	ActorPlayerID    string            `json:"actor_player_id"`
	SourceInstanceID string            `json:"source_instance_id"`
	TargetEffectID   string            `json:"target_effect_id,omitempty"`
	Amount           int               `json:"amount,omitempty"`
	Active           bool              `json:"active"`
}

type RunAwayAttempt struct {
	PlayerID          string `json:"player_id"`
	MonsterInstanceID string `json:"monster_instance_id"`
	Roll              int    `json:"roll,omitempty"`
	Modifier          int    `json:"modifier"`
	Total             int    `json:"total,omitempty"`
	Escaped           bool   `json:"escaped"`
	Automatic         bool   `json:"automatic,omitempty"`
	BadStuffApplied   bool   `json:"bad_stuff_applied,omitempty"`
}

type RunAwaySequence struct {
	ParticipantPlayerIDs []string         `json:"participant_player_ids"`
	MonsterInstanceIDs   []string         `json:"monster_instance_ids"`
	ParticipantIndex     int              `json:"participant_index"`
	MonsterIndex         int              `json:"monster_index"`
	Effects              []RunAwayEffect  `json:"effects,omitempty"`
	Attempts             []RunAwayAttempt `json:"attempts,omitempty"`
	Completed            bool             `json:"completed"`
}

func (sequence *RunAwaySequence) clone() *RunAwaySequence {
	if sequence == nil {
		return nil
	}
	clone := *sequence
	clone.ParticipantPlayerIDs = append(
		[]string(nil),
		sequence.ParticipantPlayerIDs...,
	)
	clone.MonsterInstanceIDs = append(
		[]string(nil),
		sequence.MonsterInstanceIDs...,
	)
	clone.Effects = append([]RunAwayEffect(nil), sequence.Effects...)
	clone.Attempts = append([]RunAwayAttempt(nil), sequence.Attempts...)
	return &clone
}

type State struct {
	GameID                     string                  `json:"game_id"`
	Version                    uint64                  `json:"version"`
	Status                     Status                  `json:"status"`
	OwnerPlayerID              string                  `json:"owner_player_id"`
	Players                    []Player                `json:"players"`
	Turn                       Turn                    `json:"turn"`
	Instances                  map[string]CardInstance `json:"instances,omitempty"`
	DoorDeck                   []string                `json:"door_deck,omitempty"`
	TreasureDeck               []string                `json:"treasure_deck,omitempty"`
	DoorDiscard                []string                `json:"door_discard,omitempty"`
	TreasureDiscard            []string                `json:"treasure_discard,omitempty"`
	RNGState                   uint64                  `json:"rng_state"`
	ContentSetID               string                  `json:"content_set_id"`
	ContentVersion             int                     `json:"content_version"`
	ContentDigest              string                  `json:"content_digest"`
	RulesProfileID             string                  `json:"rules_profile_id"`
	RulesProfileVersion        int                     `json:"rules_profile_version"`
	WinnerPlayerID             string                  `json:"winner_player_id,omitempty"`
	InteractionWindow          *InteractionWindow      `json:"interaction_window,omitempty"`
	SuspendedInteractionWindow *InteractionWindow      `json:"suspended_interaction_window,omitempty"`
	CombatHelpOffer            *CombatHelpOffer        `json:"combat_help_offer,omitempty"`
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
	clone.Turn.TargetEffect = state.Turn.TargetEffect.clone()
	clone.Turn.RunAway = state.Turn.RunAway.clone()
	if state.Turn.Encounter != nil {
		encounter := *state.Turn.Encounter
		encounter.AdditionalMonsterInstanceIDs = append(
			[]string(nil),
			state.Turn.Encounter.AdditionalMonsterInstanceIDs...,
		)
		encounter.CombatEffects = append(
			[]CombatEffect(nil),
			state.Turn.Encounter.CombatEffects...,
		)
		if state.Turn.Encounter.CombatHelp != nil {
			agreement := *state.Turn.Encounter.CombatHelp
			encounter.CombatHelp = &agreement
		}
		clone.Turn.Encounter = &encounter
	}
	if state.InteractionWindow != nil {
		clone.InteractionWindow = state.InteractionWindow.clone()
	}
	if state.SuspendedInteractionWindow != nil {
		clone.SuspendedInteractionWindow =
			state.SuspendedInteractionWindow.clone()
	}
	if state.CombatHelpOffer != nil {
		offer := *state.CombatHelpOffer
		clone.CombatHelpOffer = &offer
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
			(state.PlayerIndex(state.Turn.Pending.ActorID) < 0 ||
				state.Turn.Pending.ActorID != state.Turn.PlayerID &&
					!profile.TargetAndRunAway) {
			return fmt.Errorf("%w: invalid pending actor", ErrIllegalCommand)
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
	if err := state.validateCombatHelp(); err != nil {
		return err
	}
	if err := state.validateAdvancedEncounter(); err != nil {
		return err
	}
	if err := state.validateTargetAndRunAway(); err != nil {
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

func (state State) validateCombatHelp() error {
	window := state.InteractionWindow
	parent := state.SuspendedInteractionWindow
	offer := state.CombatHelpOffer
	if parent == nil && offer == nil {
		if window != nil &&
			window.Status == InteractionWindowOpen &&
			window.Kind == InteractionKindAddressedResponse &&
			window.Parent.SubjectKind == InteractionSubjectInteraction {
			return fmt.Errorf(
				"%w: addressed combat-help window lacks parent state",
				ErrIllegalCommand,
			)
		}
		return state.validateCombatHelpAgreement()
	}
	if parent == nil || offer == nil || window == nil {
		return fmt.Errorf(
			"%w: incomplete combat-help offer state",
			ErrIllegalCommand,
		)
	}
	if state.Status != StatusActive ||
		state.Turn.Phase != PhaseCombat ||
		state.Turn.Encounter == nil ||
		state.Turn.Encounter.CombatClosed ||
		state.Turn.Encounter.CombatHelp != nil ||
		parent.Status != InteractionWindowOpen ||
		parent.Kind != InteractionKindCombatResponse ||
		parent.Parent.SubjectKind != InteractionSubjectEncounter ||
		parent.Parent.Phase != PhaseCombat ||
		parent.Parent.SubjectID != state.Turn.Encounter.MonsterInstanceID ||
		parent.InitiatorActorID != state.Turn.PlayerID ||
		window.Status != InteractionWindowOpen ||
		window.Kind != InteractionKindAddressedResponse ||
		window.Parent.SubjectKind != InteractionSubjectInteraction ||
		window.Parent.ParentInteractionID != parent.ID ||
		window.Parent.SubjectID != parent.ID ||
		window.InitiatorActorID != state.Turn.PlayerID ||
		window.ID != offer.ID ||
		offer.ParentInteractionID != parent.ID ||
		offer.CombatantPlayerID != state.Turn.PlayerID ||
		offer.RewardTreasures < 1 ||
		len(window.EligibleActorIDs) != 1 ||
		window.EligibleActorIDs[0] != offer.HelperPlayerID ||
		window.DeadlineAt.After(parent.DeadlineAt) {
		return fmt.Errorf(
			"%w: malformed combat-help offer state",
			ErrIllegalCommand,
		)
	}
	helperIndex := state.PlayerIndex(offer.HelperPlayerID)
	if helperIndex < 0 ||
		offer.HelperPlayerID == state.Turn.PlayerID ||
		state.Players[helperIndex].Dead {
		return fmt.Errorf(
			"%w: invalid combat-help invitee",
			ErrIllegalCommand,
		)
	}
	return nil
}

func (state State) validateCombatHelpAgreement() error {
	if state.Turn.Encounter == nil ||
		state.Turn.Encounter.CombatHelp == nil {
		return nil
	}
	agreement := state.Turn.Encounter.CombatHelp
	helperIndex := state.PlayerIndex(agreement.HelperPlayerID)
	if helperIndex < 0 ||
		agreement.HelperPlayerID == state.Turn.PlayerID ||
		agreement.RewardTreasures < 0 ||
		(!agreement.Forced && agreement.RewardTreasures < 1) ||
		(agreement.Forced && agreement.RewardTreasures != 0) {
		return fmt.Errorf(
			"%w: malformed combat-help agreement",
			ErrIllegalCommand,
		)
	}
	switch agreement.RewardStatus {
	case CombatHelpRewardAccepted:
		if state.Turn.Phase != PhaseCombat ||
			state.Turn.Encounter.CombatClosed ||
			state.Players[helperIndex].Dead {
			return fmt.Errorf(
				"%w: accepted combat help is no longer legal",
				ErrIllegalCommand,
			)
		}
	case CombatHelpRewardSettled:
		if state.Turn.Phase != PhaseCombat {
			return fmt.Errorf(
				"%w: settled combat reward must finish atomically",
				ErrIllegalCommand,
			)
		}
	case CombatHelpRewardVoided:
		if state.Turn.Phase != PhaseCombat &&
			state.Turn.Phase != PhaseRunAway {
			return fmt.Errorf(
				"%w: voided combat reward has invalid phase",
				ErrIllegalCommand,
			)
		}
	default:
		return fmt.Errorf(
			"%w: invalid combat-help reward status",
			ErrIllegalCommand,
		)
	}
	return nil
}

func (state State) validateAdvancedEncounter() error {
	encounter := state.Turn.Encounter
	if encounter == nil {
		return nil
	}
	profile, err := state.Profile()
	if err != nil {
		return err
	}
	if !profile.AdvancedCombat &&
		(len(encounter.AdditionalMonsterInstanceIDs) > 0 ||
			len(encounter.CombatEffects) > 0 ||
			(encounter.CombatHelp != nil && encounter.CombatHelp.Forced)) {
		return fmt.Errorf(
			"%w: advanced encounter state under old profile",
			ErrIncompatibleState,
		)
	}
	encounterIDs := map[string]struct{}{
		encounter.MonsterInstanceID: {},
	}
	for _, instanceID := range encounter.AdditionalMonsterInstanceIDs {
		if instanceID == "" {
			return fmt.Errorf(
				"%w: empty additional monster instance",
				ErrIllegalCommand,
			)
		}
		if _, duplicate := encounterIDs[instanceID]; duplicate {
			return fmt.Errorf(
				"%w: duplicate encounter monster %s",
				ErrIllegalCommand,
				instanceID,
			)
		}
		encounterIDs[instanceID] = struct{}{}
	}
	effectIDs := make(map[string]struct{}, len(encounter.CombatEffects))
	for _, effect := range encounter.CombatEffects {
		if effect.ID == "" {
			return fmt.Errorf("%w: empty combat effect ID", ErrIllegalCommand)
		}
		if _, duplicate := effectIDs[effect.ID]; duplicate {
			return fmt.Errorf(
				"%w: duplicate combat effect %s",
				ErrIllegalCommand,
				effect.ID,
			)
		}
		effectIDs[effect.ID] = struct{}{}
		switch effect.Kind {
		case CombatCapabilityEnhance:
			if effect.Amount < 1 || effect.Amount > 10 ||
				effect.TargetEffectID != "" {
				return fmt.Errorf(
					"%w: malformed monster enhancement",
					ErrIllegalCommand,
				)
			}
			if _, exists := encounterIDs[effect.TargetMonsterInstanceID]; !exists {
				return fmt.Errorf(
					"%w: enhancement target is not in encounter",
					ErrIllegalCommand,
				)
			}
		case CombatCapabilityCounter:
			if effect.Amount != 0 ||
				effect.TargetMonsterInstanceID != "" ||
				effect.TargetEffectID == "" ||
				!effect.Active {
				return fmt.Errorf(
					"%w: malformed combat counter",
					ErrIllegalCommand,
				)
			}
		default:
			return fmt.Errorf(
				"%w: unsupported realized combat effect %s",
				ErrIllegalCommand,
				effect.Kind,
			)
		}
	}
	counterTargets := make(map[string]int)
	for _, effect := range encounter.CombatEffects {
		if effect.Kind != CombatCapabilityCounter {
			continue
		}
		counterTargets[effect.TargetEffectID]++
		targetIndex := slices.IndexFunc(
			encounter.CombatEffects,
			func(candidate CombatEffect) bool {
				return candidate.ID == effect.TargetEffectID
			},
		)
		if targetIndex < 0 ||
			encounter.CombatEffects[targetIndex].Kind != CombatCapabilityEnhance ||
			encounter.CombatEffects[targetIndex].Active {
			return fmt.Errorf(
				"%w: counter target outcome differs",
				ErrIllegalCommand,
			)
		}
	}
	for _, effect := range encounter.CombatEffects {
		if effect.Kind != CombatCapabilityEnhance {
			continue
		}
		expectedCounters := 0
		if !effect.Active {
			expectedCounters = 1
		}
		if counterTargets[effect.ID] != expectedCounters {
			return fmt.Errorf(
				"%w: enhancement counter cardinality differs",
				ErrIllegalCommand,
			)
		}
	}
	return nil
}

func (state State) validateTargetAndRunAway() error {
	profile, err := state.Profile()
	if err != nil {
		return err
	}
	target := state.Turn.TargetEffect
	sequence := state.Turn.RunAway
	if !profile.TargetAndRunAway && (target != nil || sequence != nil) {
		return fmt.Errorf(
			"%w: target or Run Away state under old profile",
			ErrIncompatibleState,
		)
	}
	if target != nil {
		if target.ID == "" ||
			target.InitiatorPlayerID == target.TargetPlayerID ||
			state.PlayerIndex(target.InitiatorPlayerID) < 0 ||
			state.PlayerIndex(target.TargetPlayerID) < 0 ||
			target.SourceInstanceID == "" ||
			!slices.Contains(state.Turn.Resolving, target.SourceInstanceID) ||
			!validPhase(target.ParentPhase) {
			return fmt.Errorf(
				"%w: malformed target effect state",
				ErrIllegalCommand,
			)
		}
		if state.Turn.Pending != nil &&
			state.Turn.Pending.ActorID != target.TargetPlayerID {
			return fmt.Errorf(
				"%w: target effect choice belongs to another actor",
				ErrIllegalCommand,
			)
		}
	}
	if sequence != nil {
		if len(sequence.ParticipantPlayerIDs) == 0 ||
			len(sequence.MonsterInstanceIDs) == 0 ||
			sequence.ParticipantIndex < 0 ||
			sequence.MonsterIndex < 0 {
			return fmt.Errorf(
				"%w: malformed Run Away sequence",
				ErrIllegalCommand,
			)
		}
		seenParticipants := make(map[string]struct{}, len(sequence.ParticipantPlayerIDs))
		for _, playerID := range sequence.ParticipantPlayerIDs {
			if state.PlayerIndex(playerID) < 0 {
				return fmt.Errorf(
					"%w: unknown Run Away participant",
					ErrIllegalCommand,
				)
			}
			if _, duplicate := seenParticipants[playerID]; duplicate {
				return fmt.Errorf(
					"%w: duplicate Run Away participant",
					ErrIllegalCommand,
				)
			}
			seenParticipants[playerID] = struct{}{}
		}
		seenMonsters := make(map[string]struct{}, len(sequence.MonsterInstanceIDs))
		for _, instanceID := range sequence.MonsterInstanceIDs {
			if _, exists := state.Instances[instanceID]; !exists {
				return fmt.Errorf(
					"%w: unknown Run Away monster",
					ErrIllegalCommand,
				)
			}
			if _, duplicate := seenMonsters[instanceID]; duplicate {
				return fmt.Errorf(
					"%w: duplicate Run Away monster",
					ErrIllegalCommand,
				)
			}
			seenMonsters[instanceID] = struct{}{}
		}
		if sequence.Completed {
			if state.Turn.Encounter != nil ||
				sequence.ParticipantIndex != len(sequence.ParticipantPlayerIDs) ||
				state.Turn.Phase != PhaseCharity &&
					state.Turn.Phase != PhaseEndTurn {
				return fmt.Errorf(
					"%w: completed Run Away sequence is not terminal",
					ErrIllegalCommand,
				)
			}
		} else {
			if state.Turn.Encounter == nil ||
				sequence.ParticipantIndex >= len(sequence.ParticipantPlayerIDs) ||
				sequence.MonsterIndex >= len(sequence.MonsterInstanceIDs) ||
				(state.Turn.Phase != PhaseRunAway &&
					state.Turn.Phase != PhaseResolveEffect) ||
				!slices.Equal(
					sequence.MonsterInstanceIDs,
					encounterMonsterInstanceIDs(*state.Turn.Encounter),
				) {
				return fmt.Errorf(
					"%w: active Run Away sequence differs from encounter",
					ErrIllegalCommand,
				)
			}
			if state.Turn.Pending != nil &&
				state.Turn.Pending.ActorID !=
					sequence.ParticipantPlayerIDs[sequence.ParticipantIndex] {
				return fmt.Errorf(
					"%w: Run Away choice belongs to another actor",
					ErrIllegalCommand,
				)
			}
		}
		if err := validateRunAwayEffects(sequence.Effects); err != nil {
			return err
		}
		if len(sequence.Attempts) >
			len(sequence.ParticipantPlayerIDs)*len(sequence.MonsterInstanceIDs) {
			return fmt.Errorf(
				"%w: too many Run Away attempts",
				ErrIllegalCommand,
			)
		}
		previousPosition := -1
		for _, attempt := range sequence.Attempts {
			participantIndex := slices.Index(
				sequence.ParticipantPlayerIDs,
				attempt.PlayerID,
			)
			monsterIndex := slices.Index(
				sequence.MonsterInstanceIDs,
				attempt.MonsterInstanceID,
			)
			position := participantIndex*len(sequence.MonsterInstanceIDs) +
				monsterIndex
			if participantIndex < 0 ||
				monsterIndex < 0 ||
				position <= previousPosition ||
				attempt.Roll < 0 ||
				attempt.Roll > 6 ||
				(!attempt.Automatic && attempt.Roll == 0) ||
				(attempt.Automatic && attempt.Roll != 0) ||
				attempt.Escaped && attempt.BadStuffApplied ||
				!attempt.Escaped && !attempt.BadStuffApplied {
				return fmt.Errorf(
					"%w: malformed Run Away attempt",
					ErrIllegalCommand,
				)
			}
			previousPosition = position
		}
	}
	window := state.InteractionWindow
	if window == nil || window.Status != InteractionWindowOpen {
		return nil
	}
	switch window.Kind {
	case InteractionKindTargetResponse:
		if target == nil ||
			window.Parent.SubjectKind != InteractionSubjectEffect ||
			window.Parent.SubjectID != target.SourceInstanceID ||
			window.InitiatorActorID != target.InitiatorPlayerID ||
			window.EligibilityPolicy != InteractionEligibilityOpaquePublicSet {
			return fmt.Errorf(
				"%w: target response window differs from effect",
				ErrIllegalCommand,
			)
		}
	case InteractionKindRunAwayResponse:
		if sequence == nil ||
			sequence.Completed ||
			state.Turn.Phase != PhaseRunAway ||
			window.Parent.SubjectKind != InteractionSubjectEncounter ||
			window.Parent.SubjectID !=
				sequence.MonsterInstanceIDs[sequence.MonsterIndex] ||
			window.InitiatorActorID !=
				sequence.ParticipantPlayerIDs[sequence.ParticipantIndex] ||
			window.EligibilityPolicy != InteractionEligibilityOpaquePublicSet {
			return fmt.Errorf(
				"%w: Run Away response window differs from current step",
				ErrIllegalCommand,
			)
		}
	case InteractionKindPrivateChoice:
		if state.Turn.Pending == nil ||
			len(window.EligibleActorIDs) != 1 ||
			window.EligibleActorIDs[0] != state.Turn.Pending.ActorID ||
			window.EligibilityPolicy != InteractionEligibilityActorPrivate ||
			window.Responses[state.Turn.Pending.ActorID].Requirement !=
				InteractionResponseMandatory {
			return fmt.Errorf(
				"%w: private choice window differs from pending decision",
				ErrIllegalCommand,
			)
		}
	}
	return nil
}

func validateRunAwayEffects(effects []RunAwayEffect) error {
	ids := make(map[string]struct{}, len(effects))
	for _, effect := range effects {
		if effect.ID == "" ||
			effect.ActorPlayerID == "" ||
			effect.SourceInstanceID == "" {
			return fmt.Errorf(
				"%w: malformed Run Away response effect",
				ErrIllegalCommand,
			)
		}
		if _, duplicate := ids[effect.ID]; duplicate {
			return fmt.Errorf(
				"%w: duplicate Run Away effect",
				ErrIllegalCommand,
			)
		}
		ids[effect.ID] = struct{}{}
		switch effect.Kind {
		case RunAwayEffectModifier:
			if effect.Amount == 0 || effect.TargetEffectID != "" {
				return fmt.Errorf(
					"%w: malformed Run Away modifier",
					ErrIllegalCommand,
				)
			}
		case RunAwayEffectCounter:
			if effect.Amount != 0 ||
				effect.TargetEffectID == "" ||
				!effect.Active {
				return fmt.Errorf(
					"%w: malformed Run Away counter",
					ErrIllegalCommand,
				)
			}
		default:
			return fmt.Errorf(
				"%w: unsupported Run Away effect kind",
				ErrIllegalCommand,
			)
		}
	}
	for _, effect := range effects {
		if effect.Kind != RunAwayEffectCounter {
			continue
		}
		targetIndex := slices.IndexFunc(
			effects,
			func(candidate RunAwayEffect) bool {
				return candidate.ID == effect.TargetEffectID &&
					candidate.Kind == RunAwayEffectModifier
			},
		)
		if targetIndex < 0 {
			return fmt.Errorf(
				"%w: Run Away counter target is missing",
				ErrIllegalCommand,
			)
		}
	}
	counterTargets := make(map[string]int)
	for _, effect := range effects {
		if effect.Kind == RunAwayEffectCounter {
			counterTargets[effect.TargetEffectID]++
		}
	}
	for _, effect := range effects {
		if effect.Kind != RunAwayEffectModifier {
			continue
		}
		expected := 0
		if !effect.Active {
			expected = 1
		}
		if counterTargets[effect.ID] != expected {
			return fmt.Errorf(
				"%w: Run Away counter cardinality differs",
				ErrIllegalCommand,
			)
		}
	}
	return nil
}

func (state State) interactionParentMatches(parent InteractionParent) bool {
	switch parent.SubjectKind {
	case InteractionSubjectTurn:
		return parent.SubjectID == state.Turn.PlayerID
	case InteractionSubjectEncounter:
		return state.Turn.Encounter != nil &&
			slices.Contains(
				encounterMonsterInstanceIDs(*state.Turn.Encounter),
				parent.SubjectID,
			)
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
		if response.TimeoutIntent != InteractionIntentAutoResolve &&
			response.TimeoutIntent != InteractionIntentDecline {
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
		InteractionKindPrivateChoice,
		InteractionKindTargetResponse,
		InteractionKindRunAwayResponse:
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
		encounterInstances := append(
			[]string{state.Turn.Encounter.MonsterInstanceID},
			state.Turn.Encounter.AdditionalMonsterInstanceIDs...,
		)
		if err := add(
			"encounter",
			encounterInstances,
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

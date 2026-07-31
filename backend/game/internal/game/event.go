package game

import (
	"encoding/json"
	"fmt"
	"reflect"
	"slices"
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

	EventInteractionWindowOpened     = "game.v1.interaction_window_opened"
	EventInteractionResponseRecorded = "game.v1.interaction_response_recorded"
	EventInteractionWindowClosed     = "game.v1.interaction_window_closed"
	EventCombatInterventionApplied   = "game.v1.combat_intervention_applied"
	EventAdvancedCombatEffectApplied = "game.v1.advanced_combat_effect_applied"
	EventCombatHelpOffered           = "game.v1.combat_help_offered"
	EventCombatHelpOfferResolved     = "game.v1.combat_help_offer_resolved"
	EventCombatHelpRewardSettled     = "game.v1.combat_help_reward_settled"
	EventCombatHelpRewardVoided      = "game.v1.combat_help_reward_voided"
	EventTargetEffectStarted         = "game.v1.target_effect_started"
	EventTargetEffectCountered       = "game.v1.target_effect_countered"
	EventTargetEffectResolved        = "game.v1.target_effect_resolved"
	EventRunAwayResponseApplied      = "game.v1.run_away_response_applied"
	EventRunAwayStepResolved         = "game.v1.run_away_step_resolved"
	EventEconomyOfferOpened          = "game.v1.economy_offer_opened"
	EventEconomyOfferResolved        = "game.v1.economy_offer_resolved"
	EventCharityTransferStarted      = "game.v1.charity_transfer_started"
	EventCharityAllocated            = "game.v1.charity_allocated"
	EventTheftAttemptStarted         = "game.v1.theft_attempt_started"
	EventTheftResolved               = "game.v1.theft_resolved"

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

type interactionWindowOpenedPayload struct {
	Window InteractionWindow `json:"window"`
}

type interactionResponseRecordedPayload struct {
	InteractionID          string              `json:"interaction_id"`
	ActorID                string              `json:"actor_id"`
	Response               InteractionResponse `json:"response"`
	DeadlineAt             time.Time           `json:"deadline_at"`
	DeadlineRevision       uint32              `json:"deadline_revision"`
	ExtensionBudgetSeconds int                 `json:"extension_budget_seconds"`
}

type interactionWindowClosedPayload struct {
	InteractionID string                 `json:"interaction_id"`
	Reason        InteractionCloseReason `json:"reason"`
	ClosedAt      time.Time              `json:"closed_at"`
}

type combatInterventionAppliedPayload struct {
	InteractionID          string       `json:"interaction_id"`
	PreviousRevision       uint32       `json:"previous_revision"`
	ActorID                string       `json:"actor_id"`
	SourceInstanceID       string       `json:"source_instance_id"`
	SourceDeck             DeckKind     `json:"source_deck"`
	Target                 EffectTarget `json:"target"`
	Amount                 int          `json:"amount"`
	AcceptedAt             time.Time    `json:"accepted_at"`
	DeadlineAt             time.Time    `json:"deadline_at"`
	DeadlineRevision       uint32       `json:"deadline_revision"`
	ExtensionBudgetSeconds int          `json:"extension_budget_seconds"`
}

type advancedCombatEffectAppliedPayload struct {
	InteractionID           string               `json:"interaction_id"`
	PreviousRevision        uint32               `json:"previous_revision"`
	ActorID                 string               `json:"actor_id"`
	SourceInstanceID        string               `json:"source_instance_id"`
	SourceDeck              DeckKind             `json:"source_deck"`
	Capability              CombatCapabilityKind `json:"capability"`
	EffectID                string               `json:"effect_id,omitempty"`
	TargetMonsterInstanceID string               `json:"target_monster_instance_id,omitempty"`
	TargetEffectID          string               `json:"target_effect_id,omitempty"`
	HelperPlayerID          string               `json:"helper_player_id,omitempty"`
	Amount                  int                  `json:"amount,omitempty"`
	MonsterStrength         int                  `json:"monster_strength,omitempty"`
	EncounterOrder          []string             `json:"encounter_order,omitempty"`
	AcceptedAt              time.Time            `json:"accepted_at"`
	DeadlineAt              time.Time            `json:"deadline_at"`
	DeadlineRevision        uint32               `json:"deadline_revision"`
	ExtensionBudgetSeconds  int                  `json:"extension_budget_seconds"`
}

type combatHelpOfferedPayload struct {
	Offer           CombatHelpOffer   `json:"offer"`
	Window          InteractionWindow `json:"window"`
	ReplacedOfferID string            `json:"replaced_offer_id,omitempty"`
}

type combatHelpOfferResolvedPayload struct {
	OfferID                      string                 `json:"offer_id"`
	ParentInteractionID          string                 `json:"parent_interaction_id"`
	ActorID                      string                 `json:"actor_id"`
	Intent                       InteractionIntent      `json:"intent,omitempty"`
	Reason                       InteractionCloseReason `json:"reason"`
	ResolvedAt                   time.Time              `json:"resolved_at"`
	ParentDeadlineAt             time.Time              `json:"parent_deadline_at"`
	ParentDeadlineRevision       uint32                 `json:"parent_deadline_revision"`
	ParentExtensionBudgetSeconds int                    `json:"parent_extension_budget_seconds"`
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
		EventCombatHelpRewardSettled,
		EventCombatHelpRewardVoided,
		EventTargetEffectStarted,
		EventTargetEffectCountered,
		EventTargetEffectResolved,
		EventRunAwayResponseApplied,
		EventRunAwayStepResolved,
		EventEconomyOfferOpened,
		EventEconomyOfferResolved,
		EventCharityTransferStarted,
		EventCharityAllocated,
		EventTheftAttemptStarted,
		EventTheftResolved,
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
	case EventInteractionWindowOpened:
		payload, err := decode[interactionWindowOpenedPayload](event)
		if err != nil {
			return State{}, err
		}
		if state.InteractionWindow != nil &&
			state.InteractionWindow.Status == InteractionWindowOpen {
			return State{}, fmt.Errorf(
				"%w: interaction is already open",
				ErrIllegalCommand,
			)
		}
		window := payload.Window
		if state.InteractionWindow != nil &&
			state.InteractionWindow.ID == window.ID {
			return State{}, fmt.Errorf(
				"%w: interaction ID cannot be reused",
				ErrIllegalCommand,
			)
		}
		if window.Status != InteractionWindowOpen ||
			window.DeadlineRevision != 1 ||
			window.DeadlineAt.After(
				window.OpenedAt.Add(
					time.Duration(window.DeadlinePolicy.BaseSeconds)*time.Second,
				),
			) {
			return State{}, fmt.Errorf(
				"%w: malformed interaction open event",
				ErrIllegalCommand,
			)
		}
		for _, actorID := range window.EligibleActorIDs {
			if window.Responses[actorID].State != InteractionResponsePending {
				return State{}, fmt.Errorf(
					"%w: interaction opens with recorded response",
					ErrIllegalCommand,
				)
			}
		}
		next := state.Clone()
		next.InteractionWindow = window.clone()
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventInteractionResponseRecorded:
		payload, err := decode[interactionResponseRecordedPayload](event)
		if err != nil {
			return State{}, err
		}
		next, err := applyInteractionResponse(state, payload)
		if err != nil {
			return State{}, err
		}
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventCombatInterventionApplied:
		payload, err := decode[combatInterventionAppliedPayload](event)
		if err != nil {
			return State{}, err
		}
		next, err := applyCombatIntervention(state, payload)
		if err != nil {
			return State{}, err
		}
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventAdvancedCombatEffectApplied:
		payload, err := decode[advancedCombatEffectAppliedPayload](event)
		if err != nil {
			return State{}, err
		}
		next, err := applyAdvancedCombatEffect(state, payload)
		if err != nil {
			return State{}, err
		}
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventCombatHelpOffered:
		payload, err := decode[combatHelpOfferedPayload](event)
		if err != nil {
			return State{}, err
		}
		next, err := applyCombatHelpOffered(state, payload)
		if err != nil {
			return State{}, err
		}
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventCombatHelpOfferResolved:
		payload, err := decode[combatHelpOfferResolvedPayload](event)
		if err != nil {
			return State{}, err
		}
		next, err := applyCombatHelpOfferResolved(state, payload)
		if err != nil {
			return State{}, err
		}
		next.Version++
		if err := next.Validate(); err != nil {
			return State{}, err
		}
		return next, nil
	case EventInteractionWindowClosed:
		payload, err := decode[interactionWindowClosedPayload](event)
		if err != nil {
			return State{}, err
		}
		if state.InteractionWindow == nil ||
			state.InteractionWindow.ID != payload.InteractionID ||
			state.InteractionWindow.Status != InteractionWindowOpen {
			return State{}, fmt.Errorf(
				"%w: stale or closed interaction",
				ErrIllegalCommand,
			)
		}
		next := state.Clone()
		next.InteractionWindow.Status = InteractionWindowClosed
		next.InteractionWindow.CloseReason = payload.Reason
		next.InteractionWindow.ClosedAt = payload.ClosedAt
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

func applyCombatHelpOffered(
	state State,
	payload combatHelpOfferedPayload,
) (State, error) {
	var parent InteractionWindow
	if payload.ReplacedOfferID == "" {
		if state.CombatHelpOffer != nil ||
			state.SuspendedInteractionWindow != nil ||
			state.InteractionWindow == nil ||
			state.InteractionWindow.Status != InteractionWindowOpen ||
			state.InteractionWindow.Kind != InteractionKindCombatResponse {
			return State{}, fmt.Errorf(
				"%w: combat-help parent is not available",
				ErrIllegalCommand,
			)
		}
		parent = *state.InteractionWindow.clone()
	} else {
		if state.CombatHelpOffer == nil ||
			state.SuspendedInteractionWindow == nil ||
			state.InteractionWindow == nil ||
			state.InteractionWindow.ID != payload.ReplacedOfferID ||
			state.CombatHelpOffer.ID != payload.ReplacedOfferID {
			return State{}, fmt.Errorf(
				"%w: combat-help supersede target is stale",
				ErrIllegalCommand,
			)
		}
		parent = *state.SuspendedInteractionWindow.clone()
	}
	expectedWindow, err := combatHelpWindow(
		parent,
		payload.Offer,
		payload.Window.OpenedAt,
	)
	if err != nil || !reflect.DeepEqual(*expectedWindow, payload.Window) {
		return State{}, fmt.Errorf(
			"%w: combat-help child outcome differs",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	if payload.ReplacedOfferID == "" {
		next.SuspendedInteractionWindow = parent.clone()
	}
	next.InteractionWindow = payload.Window.clone()
	offer := payload.Offer
	next.CombatHelpOffer = &offer
	return next, nil
}

func applyCombatHelpOfferResolved(
	state State,
	payload combatHelpOfferResolvedPayload,
) (State, error) {
	if state.CombatHelpOffer == nil ||
		state.SuspendedInteractionWindow == nil ||
		state.InteractionWindow == nil ||
		state.InteractionWindow.ID != payload.OfferID ||
		state.CombatHelpOffer.ID != payload.OfferID ||
		state.SuspendedInteractionWindow.ID != payload.ParentInteractionID {
		return State{}, fmt.Errorf(
			"%w: combat-help resolution is stale",
			ErrIllegalCommand,
		)
	}
	child := *state.InteractionWindow.clone()
	parent := *state.SuspendedInteractionWindow.clone()
	offer := *state.CombatHelpOffer
	if payload.ResolvedAt.IsZero() ||
		payload.ResolvedAt.Before(child.OpenedAt) {
		return State{}, fmt.Errorf(
			"%w: combat-help resolution instant",
			ErrIllegalCommand,
		)
	}
	expectedDeadline := parent.DeadlineAt
	expectedRevision := parent.DeadlineRevision
	expectedBudget := parent.ExtensionBudgetSeconds
	switch payload.Reason {
	case InteractionCloseAccepted:
		if payload.ActorID != offer.HelperPlayerID ||
			payload.Intent != InteractionIntentAccept ||
			!payload.ResolvedAt.Before(child.DeadlineAt) {
			return State{}, fmt.Errorf(
				"%w: malformed combat-help acceptance",
				ErrIllegalCommand,
			)
		}
		var err error
		expectedDeadline, expectedRevision, expectedBudget, err =
			combatInterventionDeadlineAfter(parent, payload.ResolvedAt)
		if err != nil {
			return State{}, err
		}
	case InteractionCloseDeclined:
		if payload.ActorID != offer.HelperPlayerID ||
			payload.Intent != InteractionIntentDecline ||
			!payload.ResolvedAt.Before(child.DeadlineAt) {
			return State{}, fmt.Errorf(
				"%w: malformed combat-help decline",
				ErrIllegalCommand,
			)
		}
	case InteractionCloseCancelled:
		if payload.ActorID != offer.CombatantPlayerID ||
			payload.Intent != "" ||
			!payload.ResolvedAt.Before(child.DeadlineAt) {
			return State{}, fmt.Errorf(
				"%w: malformed combat-help cancel",
				ErrIllegalCommand,
			)
		}
	case InteractionCloseDeadlineExpired:
		if payload.ActorID != offer.HelperPlayerID ||
			payload.Intent != InteractionIntentDecline ||
			payload.ResolvedAt.Before(child.DeadlineAt) {
			return State{}, fmt.Errorf(
				"%w: malformed combat-help timeout",
				ErrIllegalCommand,
			)
		}
	default:
		return State{}, fmt.Errorf(
			"%w: invalid combat-help resolution reason",
			ErrIllegalCommand,
		)
	}
	if !payload.ParentDeadlineAt.Equal(expectedDeadline) ||
		payload.ParentDeadlineRevision != expectedRevision ||
		payload.ParentExtensionBudgetSeconds != expectedBudget {
		return State{}, fmt.Errorf(
			"%w: combat-help parent deadline outcome differs",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	next.InteractionWindow = parent.clone()
	next.InteractionWindow.DeadlineAt = payload.ParentDeadlineAt
	next.InteractionWindow.DeadlineRevision =
		payload.ParentDeadlineRevision
	next.InteractionWindow.ExtensionBudgetSeconds =
		payload.ParentExtensionBudgetSeconds
	if payload.Reason == InteractionCloseAccepted {
		for _, actorID := range next.InteractionWindow.EligibleActorIDs {
			response := next.InteractionWindow.Responses[actorID]
			response.State = InteractionResponsePending
			response.Intent = ""
			response.AcceptedAt = time.Time{}
			next.InteractionWindow.Responses[actorID] = response
		}
		next.Turn.Encounter.CombatHelp = &CombatHelpAgreement{
			HelperPlayerID:  offer.HelperPlayerID,
			RewardTreasures: offer.RewardTreasures,
			RewardStatus:    CombatHelpRewardAccepted,
		}
	}
	next.SuspendedInteractionWindow = nil
	next.CombatHelpOffer = nil
	return next, nil
}

func applyCombatIntervention(
	state State,
	payload combatInterventionAppliedPayload,
) (State, error) {
	if state.InteractionWindow == nil ||
		state.InteractionWindow.ID != payload.InteractionID ||
		state.InteractionWindow.Status != InteractionWindowOpen ||
		state.InteractionWindow.Kind != InteractionKindCombatResponse ||
		state.InteractionWindow.Parent.SubjectKind != InteractionSubjectEncounter ||
		state.InteractionWindow.DeadlineRevision != payload.PreviousRevision ||
		state.Turn.Phase != PhaseCombat ||
		state.Turn.Encounter == nil ||
		payload.Amount == 0 {
		return State{}, fmt.Errorf(
			"%w: stale or malformed combat intervention",
			ErrIllegalCommand,
		)
	}
	window := *state.InteractionWindow.clone()
	if _, err := interactionResponseAt(window, payload.ActorID); err != nil {
		return State{}, err
	}
	playerIndex := state.PlayerIndex(payload.ActorID)
	if playerIndex < 0 ||
		!slices.Contains(
			state.Players[playerIndex].Hand,
			payload.SourceInstanceID,
		) {
		return State{}, fmt.Errorf(
			"%w: intervention source is not actor-owned",
			ErrIllegalCommand,
		)
	}
	if _, exists := state.Instances[payload.SourceInstanceID]; !exists {
		return State{}, fmt.Errorf(
			"%w: intervention source instance",
			ErrUnknownCard,
		)
	}
	deadline, revision, budget, err := combatInterventionDeadlineAfter(
		window,
		payload.AcceptedAt,
	)
	if err != nil {
		return State{}, err
	}
	if !payload.DeadlineAt.Equal(deadline) ||
		payload.DeadlineRevision != revision ||
		payload.ExtensionBudgetSeconds != budget {
		return State{}, fmt.Errorf(
			"%w: combat intervention deadline outcome differs",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	player := &next.Players[playerIndex]
	player.Hand, _ = removeString(player.Hand, payload.SourceInstanceID)
	switch payload.SourceDeck {
	case DeckDoor:
		next.DoorDiscard = append(next.DoorDiscard, payload.SourceInstanceID)
	case DeckTreasure:
		next.TreasureDiscard = append(
			next.TreasureDiscard,
			payload.SourceInstanceID,
		)
	default:
		return State{}, fmt.Errorf(
			"%w: intervention source deck",
			ErrIllegalCommand,
		)
	}
	switch payload.Target {
	case EffectTargetPlayer:
		next.Turn.Encounter.PlayerCombatModifier += payload.Amount
	case EffectTargetMonster:
		next.Turn.Encounter.MonsterCombatModifier += payload.Amount
	default:
		return State{}, fmt.Errorf(
			"%w: intervention target",
			ErrIllegalCommand,
		)
	}
	for _, actorID := range next.InteractionWindow.EligibleActorIDs {
		response := next.InteractionWindow.Responses[actorID]
		response.State = InteractionResponsePending
		response.Intent = ""
		response.AcceptedAt = time.Time{}
		next.InteractionWindow.Responses[actorID] = response
	}
	next.InteractionWindow.DeadlineAt = payload.DeadlineAt
	next.InteractionWindow.DeadlineRevision = payload.DeadlineRevision
	next.InteractionWindow.ExtensionBudgetSeconds =
		payload.ExtensionBudgetSeconds
	return next, nil
}

func applyAdvancedCombatEffect(
	state State,
	payload advancedCombatEffectAppliedPayload,
) (State, error) {
	profile, err := state.Profile()
	if err != nil {
		return State{}, err
	}
	if !profile.AdvancedCombat ||
		state.InteractionWindow == nil ||
		state.InteractionWindow.ID != payload.InteractionID ||
		state.InteractionWindow.Status != InteractionWindowOpen ||
		state.InteractionWindow.Kind != InteractionKindCombatResponse ||
		state.InteractionWindow.Parent.SubjectKind != InteractionSubjectEncounter ||
		state.InteractionWindow.DeadlineRevision != payload.PreviousRevision ||
		state.Turn.Phase != PhaseCombat ||
		state.Turn.Encounter == nil {
		return State{}, fmt.Errorf(
			"%w: stale or malformed advanced combat effect",
			ErrIllegalCommand,
		)
	}
	window := *state.InteractionWindow.clone()
	if _, err := interactionResponseAt(window, payload.ActorID); err != nil {
		return State{}, err
	}
	playerIndex := state.PlayerIndex(payload.ActorID)
	if playerIndex < 0 ||
		!slices.Contains(
			state.Players[playerIndex].Hand,
			payload.SourceInstanceID,
		) {
		return State{}, fmt.Errorf(
			"%w: advanced combat source is not actor-owned",
			ErrIllegalCommand,
		)
	}
	if _, exists := state.Instances[payload.SourceInstanceID]; !exists {
		return State{}, fmt.Errorf(
			"%w: advanced combat source instance",
			ErrUnknownCard,
		)
	}
	deadline, revision, budget, err := combatInterventionDeadlineAfter(
		window,
		payload.AcceptedAt,
	)
	if err != nil {
		return State{}, err
	}
	if !payload.DeadlineAt.Equal(deadline) ||
		payload.DeadlineRevision != revision ||
		payload.ExtensionBudgetSeconds != budget {
		return State{}, fmt.Errorf(
			"%w: advanced combat deadline outcome differs",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	player := &next.Players[playerIndex]
	player.Hand, _ = removeString(player.Hand, payload.SourceInstanceID)
	switch payload.Capability {
	case CombatCapabilityAddMonster:
		expectedOrder := append(
			encounterMonsterInstanceIDs(*state.Turn.Encounter),
			payload.SourceInstanceID,
		)
		if !slices.Equal(payload.EncounterOrder, expectedOrder) ||
			payload.SourceDeck != DeckDoor ||
			payload.EffectID != "" ||
			payload.TargetMonsterInstanceID != "" ||
			payload.TargetEffectID != "" ||
			payload.HelperPlayerID != "" ||
			payload.Amount != 0 ||
			payload.MonsterStrength < 1 ||
			payload.MonsterStrength > 99 {
			return State{}, fmt.Errorf(
				"%w: additional-monster outcome differs",
				ErrIllegalCommand,
			)
		}
		next.Turn.Encounter.AdditionalMonsterInstanceIDs = append(
			[]string(nil),
			payload.EncounterOrder[1:]...,
		)
		next.Turn.Encounter.MonsterCombatModifier += payload.MonsterStrength
	case CombatCapabilityEnhance:
		if payload.SourceDeck != DeckTreasure ||
			payload.EffectID == "" ||
			payload.Amount < 1 ||
			payload.Amount > 10 ||
			!slices.Contains(
				encounterMonsterInstanceIDs(*state.Turn.Encounter),
				payload.TargetMonsterInstanceID,
			) ||
			payload.TargetEffectID != "" ||
			payload.HelperPlayerID != "" ||
			payload.MonsterStrength != 0 ||
			len(payload.EncounterOrder) != 0 {
			return State{}, fmt.Errorf(
				"%w: monster-enhancement outcome differs",
				ErrIllegalCommand,
			)
		}
		next.Turn.Encounter.CombatEffects = append(
			next.Turn.Encounter.CombatEffects,
			CombatEffect{
				ID:                      payload.EffectID,
				Kind:                    CombatCapabilityEnhance,
				TargetMonsterInstanceID: payload.TargetMonsterInstanceID,
				Amount:                  payload.Amount,
				Active:                  true,
			},
		)
		next.Turn.Encounter.MonsterCombatModifier += payload.Amount
	case CombatCapabilityCounter:
		targetIndex := slices.IndexFunc(
			next.Turn.Encounter.CombatEffects,
			func(effect CombatEffect) bool {
				return effect.ID == payload.TargetEffectID &&
					effect.Kind == CombatCapabilityEnhance &&
					effect.Active
			},
		)
		if payload.SourceDeck != DeckTreasure ||
			payload.EffectID == "" ||
			targetIndex < 0 ||
			payload.TargetMonsterInstanceID != "" ||
			payload.HelperPlayerID != "" ||
			payload.Amount != 0 ||
			payload.MonsterStrength != 0 ||
			len(payload.EncounterOrder) != 0 {
			return State{}, fmt.Errorf(
				"%w: combat-counter outcome differs",
				ErrIllegalCommand,
			)
		}
		next.Turn.Encounter.MonsterCombatModifier -=
			next.Turn.Encounter.CombatEffects[targetIndex].Amount
		next.Turn.Encounter.CombatEffects[targetIndex].Active = false
		next.Turn.Encounter.CombatEffects = append(
			next.Turn.Encounter.CombatEffects,
			CombatEffect{
				ID:             payload.EffectID,
				Kind:           CombatCapabilityCounter,
				TargetEffectID: payload.TargetEffectID,
				Active:         true,
			},
		)
	case CombatCapabilityForceHelper:
		helperIndex := next.PlayerIndex(payload.HelperPlayerID)
		if payload.SourceDeck != DeckTreasure ||
			state.Turn.Encounter.CombatHelp != nil ||
			helperIndex < 0 ||
			payload.HelperPlayerID == state.Turn.PlayerID ||
			next.Players[helperIndex].Dead ||
			payload.EffectID != "" ||
			payload.TargetMonsterInstanceID != "" ||
			payload.TargetEffectID != "" ||
			payload.Amount != 0 ||
			payload.MonsterStrength != 0 ||
			len(payload.EncounterOrder) != 0 {
			return State{}, fmt.Errorf(
				"%w: forced-helper outcome differs",
				ErrIllegalCommand,
			)
		}
		next.Turn.Encounter.CombatHelp = &CombatHelpAgreement{
			HelperPlayerID: payload.HelperPlayerID,
			RewardStatus:   CombatHelpRewardAccepted,
			Forced:         true,
		}
	default:
		return State{}, fmt.Errorf(
			"%w: unknown advanced combat capability",
			ErrInvalidContent,
		)
	}
	if payload.Capability != CombatCapabilityAddMonster {
		switch payload.SourceDeck {
		case DeckDoor:
			next.DoorDiscard = append(
				next.DoorDiscard,
				payload.SourceInstanceID,
			)
		case DeckTreasure:
			next.TreasureDiscard = append(
				next.TreasureDiscard,
				payload.SourceInstanceID,
			)
		default:
			return State{}, fmt.Errorf(
				"%w: advanced combat source deck",
				ErrIllegalCommand,
			)
		}
	}
	for _, actorID := range next.InteractionWindow.EligibleActorIDs {
		response := next.InteractionWindow.Responses[actorID]
		response.State = InteractionResponsePending
		response.Intent = ""
		response.AcceptedAt = time.Time{}
		next.InteractionWindow.Responses[actorID] = response
	}
	next.InteractionWindow.DeadlineAt = payload.DeadlineAt
	next.InteractionWindow.DeadlineRevision = payload.DeadlineRevision
	next.InteractionWindow.ExtensionBudgetSeconds =
		payload.ExtensionBudgetSeconds
	return next, nil
}

func applyInteractionResponse(
	state State,
	payload interactionResponseRecordedPayload,
) (State, error) {
	if state.InteractionWindow == nil ||
		state.InteractionWindow.ID != payload.InteractionID ||
		state.InteractionWindow.Status != InteractionWindowOpen {
		return State{}, fmt.Errorf(
			"%w: stale or closed interaction",
			ErrIllegalCommand,
		)
	}
	window := *state.InteractionWindow
	current, err := interactionResponseAt(window, payload.ActorID)
	if err != nil {
		return State{}, err
	}
	if payload.Response.Requirement != current.Requirement ||
		payload.Response.TimeoutIntent != current.TimeoutIntent {
		return State{}, fmt.Errorf(
			"%w: response policy changed",
			ErrIllegalCommand,
		)
	}
	switch payload.Response.State {
	case InteractionResponseTimedOut:
		if current.Requirement != InteractionResponseOptional ||
			payload.Response.Intent != InteractionIntentPass ||
			payload.Response.AcceptedAt.Before(window.DeadlineAt) {
			return State{}, fmt.Errorf(
				"%w: malformed optional timeout response",
				ErrIllegalCommand,
			)
		}
		if !sameInteractionDeadline(window, payload) {
			return State{}, fmt.Errorf(
				"%w: timeout changed interaction deadline",
				ErrIllegalCommand,
			)
		}
	case InteractionResponseAutoResolved:
		if current.Requirement != InteractionResponseMandatory ||
			payload.Response.Intent != current.TimeoutIntent ||
			payload.Response.AcceptedAt.Before(window.DeadlineAt) {
			return State{}, fmt.Errorf(
				"%w: malformed mandatory timeout response",
				ErrIllegalCommand,
			)
		}
		if !sameInteractionDeadline(window, payload) {
			return State{}, fmt.Errorf(
				"%w: timeout changed interaction deadline",
				ErrIllegalCommand,
			)
		}
	default:
		expectedState, err := interactionResponseStateForIntent(
			payload.Response.Intent,
		)
		if err != nil || expectedState != payload.Response.State {
			return State{}, fmt.Errorf(
				"%w: response state does not match intent",
				ErrIllegalCommand,
			)
		}
		deadline, revision, budget, err := interactionDeadlineAfter(
			window,
			payload.Response.AcceptedAt,
			payload.Response.Intent,
		)
		if err != nil {
			return State{}, err
		}
		if !payload.DeadlineAt.Equal(deadline) ||
			payload.DeadlineRevision != revision ||
			payload.ExtensionBudgetSeconds != budget {
			return State{}, fmt.Errorf(
				"%w: response deadline outcome differs",
				ErrIllegalCommand,
			)
		}
	}
	next := state.Clone()
	next.InteractionWindow.Responses[payload.ActorID] = payload.Response
	next.InteractionWindow.DeadlineAt = payload.DeadlineAt
	next.InteractionWindow.DeadlineRevision = payload.DeadlineRevision
	next.InteractionWindow.ExtensionBudgetSeconds = payload.ExtensionBudgetSeconds
	return next, nil
}

func sameInteractionDeadline(
	window InteractionWindow,
	payload interactionResponseRecordedPayload,
) bool {
	return payload.DeadlineAt.Equal(window.DeadlineAt) &&
		payload.DeadlineRevision == window.DeadlineRevision &&
		payload.ExtensionBudgetSeconds == window.ExtensionBudgetSeconds
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

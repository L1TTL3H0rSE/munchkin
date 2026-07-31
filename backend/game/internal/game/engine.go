package game

import (
	"fmt"
	"slices"
	"strings"
	"time"
)

type CommandType string

const (
	CommandJoin                    CommandType = "join"
	CommandStart                   CommandType = "start"
	CommandFinishSetup             CommandType = "finish_setup"
	CommandPlayCard                CommandType = "play_card"
	CommandEquipItem               CommandType = "equip_item"
	CommandUnequipItem             CommandType = "unequip_item"
	CommandDiscardCard             CommandType = "discard_card"
	CommandSellItems               CommandType = "sell_items"
	CommandOpenDoor                CommandType = "open_door"
	CommandLookForTrouble          CommandType = "look_for_trouble"
	CommandLootRoom                CommandType = "loot_room"
	CommandUseAbility              CommandType = "use_ability"
	CommandResolveCombat           CommandType = "resolve_combat"
	CommandRequestCombatResolution CommandType = "request_combat_resolution"
	CommandRunAway                 CommandType = "run_away"
	CommandChooseEffect            CommandType = "choose_effect"
	CommandResolveCharity          CommandType = "resolve_charity"
	CommandEndTurn                 CommandType = "end_turn"

	CommandOpenInteractionWindow    CommandType = "open_interaction_window"
	CommandRespondInteraction       CommandType = "respond_interaction"
	CommandPassInteraction          CommandType = "pass_interaction"
	CommandTimeoutInteraction       CommandType = "timeout_interaction"
	CommandCloseInteractionWindow   CommandType = "close_interaction_window"
	CommandPlayCombatIntervention   CommandType = "play_combat_intervention"
	CommandPlayAdvancedCombatEffect CommandType = "play_advanced_combat_effect"
	CommandCompleteCombatResolution CommandType = "complete_combat_resolution"
	CommandOfferCombatHelp          CommandType = "offer_combat_help"
	CommandRespondCombatHelp        CommandType = "respond_combat_help"
	CommandCancelCombatHelp         CommandType = "cancel_combat_help"
	CommandPlayTargetEffect         CommandType = "play_target_effect"
	CommandCounterTargetEffect      CommandType = "counter_target_effect"
	CommandResolveTargetEffect      CommandType = "resolve_target_effect"
	CommandPlayRunAwayModifier      CommandType = "play_run_away_modifier"
	CommandCounterRunAwayEffect     CommandType = "counter_run_away_effect"
	CommandResolveRunAwayStep       CommandType = "resolve_run_away_step"

	// Bootstrap aliases remain parseable, but use the new deterministic paths.
	CommandFight CommandType = "fight"
	CommandLoot  CommandType = "loot"
)

type Command struct {
	Type                   CommandType            `json:"type"`
	ActorID                string                 `json:"-"`
	PlayerID               string                 `json:"-"`
	DisplayName            string                 `json:"-"`
	CredentialHash         string                 `json:"-"`
	InstanceID             string                 `json:"instance_id,omitempty"`
	TargetInstanceID       string                 `json:"target_instance_id,omitempty"`
	InstanceIDs            []string               `json:"instance_ids,omitempty"`
	ChoiceIDs              []string               `json:"choice_ids,omitempty"`
	AbilityIndex           int                    `json:"ability_index,omitempty"`
	InteractionID          string                 `json:"-"`
	InteractionIntent      InteractionIntent      `json:"-"`
	InteractionAt          time.Time              `json:"-"`
	InteractionRevision    uint32                 `json:"-"`
	InteractionCloseReason InteractionCloseReason `json:"-"`
	InteractionWindow      *InteractionWindow     `json:"-"`
	ChildInteractionID     string                 `json:"-"`
	HelperPlayerID         string                 `json:"-"`
	TargetEffectID         string                 `json:"-"`
	TargetPlayerID         string                 `json:"-"`
	RewardTreasures        int                    `json:"-"`
}

func CreateLobby(gameID string, owner Player, pack Pack, seed uint64) (DomainEvent, error) {
	profile := LobbyMultiplayerProfile()
	if pack.SetID == "moscow-core" && pack.Version == 3 {
		profile = AdvancedCombatProfile()
	}
	return CreateLobbyWithProfile(
		gameID,
		owner,
		pack,
		seed,
		profile,
	)
}

func CreateLegacyLobby(
	gameID string,
	owner Player,
	pack Pack,
	seed uint64,
) (DomainEvent, error) {
	return CreateLobbyWithProfile(
		gameID,
		owner,
		pack,
		seed,
		FirstEditionCoreProfile(),
	)
}

func CreateLobbyWithProfile(
	gameID string,
	owner Player,
	pack Pack,
	seed uint64,
	profile RulesProfile,
) (DomainEvent, error) {
	if gameID == "" ||
		owner.ID == "" ||
		strings.TrimSpace(owner.Name) == "" ||
		owner.CredentialHash == "" {
		return DomainEvent{}, fmt.Errorf("%w: create lobby fields", ErrIllegalCommand)
	}
	if err := profile.Validate(); err != nil {
		return DomainEvent{}, err
	}
	return newEvent(EventLobbyCreated, lobbyCreatedPayload{
		GameID:              gameID,
		Owner:               owner,
		Seed:                seed,
		ContentSetID:        pack.SetID,
		ContentVersion:      pack.Version,
		ContentDigest:       pack.ContentDigest,
		RulesProfileID:      profile.ID,
		RulesProfileVersion: profile.Version,
	})
}

func Handle(state State, command Command, pack Pack) ([]DomainEvent, error) {
	if state.Status == StatusFinished {
		return nil, fmt.Errorf("%w: game is finished", ErrIllegalCommand)
	}
	if state.ContentSetID != pack.SetID ||
		state.ContentVersion != pack.Version ||
		state.ContentDigest != pack.ContentDigest {
		return nil, fmt.Errorf("%w: content identity drift", ErrInvalidContent)
	}
	if _, err := state.Profile(); err != nil {
		return nil, err
	}
	switch command.Type {
	case CommandJoin:
		return handleJoin(state, command)
	case CommandStart:
		return handleStart(state, command, pack)
	case CommandFinishSetup:
		return handleFinishSetup(state, command)
	case CommandPlayCard:
		return handlePlayCard(state, command, pack)
	case CommandEquipItem:
		return handleEquipItem(state, command, pack)
	case CommandUnequipItem:
		return handleUnequipItem(state, command, pack)
	case CommandDiscardCard:
		return handleDiscardCard(state, command, pack)
	case CommandSellItems:
		return handleSellItems(state, command, pack)
	case CommandOpenDoor:
		return handleOpenDoor(state, command, pack)
	case CommandLookForTrouble:
		return handleLookForTrouble(state, command, pack)
	case CommandLootRoom, CommandLoot:
		return handleLootRoom(state, command, pack)
	case CommandUseAbility:
		return handleUseAbility(state, command, pack)
	case CommandResolveCombat, CommandFight:
		return handleResolveCombat(state, command, pack)
	case CommandRequestCombatResolution:
		return handleRequestCombatResolution(state, command, pack)
	case CommandRunAway:
		return handleRunAway(state, command, pack)
	case CommandChooseEffect:
		return handleChooseEffect(state, command, pack)
	case CommandResolveCharity:
		return handleResolveCharity(state, command, pack)
	case CommandEndTurn:
		return handleEndTurn(state, command, pack)
	case CommandOpenInteractionWindow:
		return handleOpenInteractionWindow(state, command)
	case CommandRespondInteraction:
		return handleRespondInteraction(state, command)
	case CommandPassInteraction:
		return handlePassInteraction(state, command)
	case CommandTimeoutInteraction:
		return handleTimeoutInteraction(state, command, pack)
	case CommandCloseInteractionWindow:
		return handleCloseInteractionWindow(state, command, pack)
	case CommandPlayCombatIntervention:
		return handlePlayCombatIntervention(state, command, pack)
	case CommandPlayAdvancedCombatEffect:
		return handlePlayAdvancedCombatEffect(state, command, pack)
	case CommandCompleteCombatResolution:
		return handleCompleteCombatResolution(state, command, pack)
	case CommandOfferCombatHelp:
		return handleOfferCombatHelp(state, command, pack)
	case CommandRespondCombatHelp:
		return handleRespondCombatHelp(state, command, pack)
	case CommandCancelCombatHelp:
		return handleCancelCombatHelp(state, command)
	case CommandPlayTargetEffect:
		return handlePlayTargetEffect(state, command, pack)
	case CommandCounterTargetEffect:
		return handleCounterTargetEffect(state, command, pack)
	case CommandResolveTargetEffect:
		return handleResolveTargetEffect(state, command, pack)
	case CommandPlayRunAwayModifier:
		return handlePlayRunAwayModifier(state, command, pack)
	case CommandCounterRunAwayEffect:
		return handleCounterRunAwayEffect(state, command, pack)
	case CommandResolveRunAwayStep:
		return handleResolveRunAwayStep(state, command, pack)
	default:
		return nil, fmt.Errorf("%w: unknown command %s", ErrIllegalCommand, command.Type)
	}
}

func handleOpenInteractionWindow(
	state State,
	command Command,
) ([]DomainEvent, error) {
	if state.Status != StatusActive || command.InteractionWindow == nil {
		return nil, fmt.Errorf(
			"%w: interaction requires active game and typed window",
			ErrIllegalCommand,
		)
	}
	if state.InteractionWindow != nil &&
		state.InteractionWindow.Status == InteractionWindowOpen {
		return nil, fmt.Errorf("%w: interaction is already open", ErrIllegalCommand)
	}
	window := command.InteractionWindow.clone()
	if state.InteractionWindow != nil &&
		state.InteractionWindow.ID == window.ID {
		return nil, fmt.Errorf(
			"%w: interaction ID cannot be reused",
			ErrIllegalCommand,
		)
	}
	if command.ActorID == "" ||
		command.ActorID != window.InitiatorActorID ||
		state.PlayerIndex(command.ActorID) < 0 {
		return nil, fmt.Errorf(
			"%w: actor cannot open interaction",
			ErrIllegalCommand,
		)
	}
	if window.Parent.Phase != state.Turn.Phase {
		return nil, fmt.Errorf(
			"%w: interaction parent phase is stale",
			ErrIllegalCommand,
		)
	}
	event, err := newEvent(
		EventInteractionWindowOpened,
		interactionWindowOpenedPayload{Window: *window},
	)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleRespondInteraction(
	state State,
	command Command,
) ([]DomainEvent, error) {
	if command.InteractionIntent == InteractionIntentPass ||
		command.InteractionIntent == InteractionIntentAutoResolve {
		return nil, fmt.Errorf(
			"%w: use the typed pass or timeout transition",
			ErrIllegalCommand,
		)
	}
	return recordInteractionResponse(
		state,
		command,
		command.InteractionIntent,
		false,
	)
}

func handlePassInteraction(
	state State,
	command Command,
) ([]DomainEvent, error) {
	return recordInteractionResponse(
		state,
		command,
		InteractionIntentPass,
		false,
	)
}

func recordInteractionResponse(
	state State,
	command Command,
	intent InteractionIntent,
	timeout bool,
) ([]DomainEvent, error) {
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	revisionBound := profile.CombatResponses &&
		window.Kind == InteractionKindCombatResponse &&
		window.Parent.SubjectKind == InteractionSubjectEncounter ||
		window.Kind == InteractionKindTargetResponse ||
		window.Kind == InteractionKindRunAwayResponse ||
		window.Kind == InteractionKindPrivateChoice
	if !timeout &&
		revisionBound &&
		command.InteractionRevision != window.DeadlineRevision {
		return nil, fmt.Errorf(
			"%w: stale combat response revision",
			ErrIllegalCommand,
		)
	}
	current, err := interactionResponseAt(window, command.ActorID)
	if err != nil {
		return nil, err
	}
	var responseState InteractionResponseState
	if timeout {
		switch current.Requirement {
		case InteractionResponseOptional:
			intent = InteractionIntentPass
			responseState = InteractionResponseTimedOut
		case InteractionResponseMandatory:
			intent = current.TimeoutIntent
			responseState = InteractionResponseAutoResolved
		default:
			return nil, fmt.Errorf(
				"%w: invalid interaction response requirement",
				ErrIllegalCommand,
			)
		}
	} else {
		responseState, err = interactionResponseStateForIntent(intent)
		if err != nil {
			return nil, err
		}
	}
	if !slices.Contains(window.AllowedIntents, intent) {
		return nil, fmt.Errorf(
			"%w: interaction intent is not allowed",
			ErrIllegalCommand,
		)
	}
	deadline := window.DeadlineAt
	revision := window.DeadlineRevision
	budget := window.ExtensionBudgetSeconds
	if timeout {
		if command.InteractionAt.IsZero() ||
			command.InteractionAt.Before(window.DeadlineAt) {
			return nil, fmt.Errorf(
				"%w: interaction deadline has not expired",
				ErrIllegalCommand,
			)
		}
	} else {
		deadline, revision, budget, err = interactionDeadlineAfter(
			window,
			command.InteractionAt,
			intent,
		)
		if err != nil {
			return nil, err
		}
	}
	response := current
	response.State = responseState
	response.Intent = intent
	response.AcceptedAt = command.InteractionAt
	event, err := newEvent(
		EventInteractionResponseRecorded,
		interactionResponseRecordedPayload{
			InteractionID:          window.ID,
			ActorID:                command.ActorID,
			Response:               response,
			DeadlineAt:             deadline,
			DeadlineRevision:       revision,
			ExtensionBudgetSeconds: budget,
		},
	)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleTimeoutInteraction(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	if command.ActorID != "" {
		return nil, fmt.Errorf(
			"%w: player cannot issue interaction timeout",
			ErrIllegalCommand,
		)
	}
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	if command.InteractionRevision != window.DeadlineRevision {
		return nil, fmt.Errorf(
			"%w: stale interaction deadline revision",
			ErrIllegalCommand,
		)
	}
	if command.InteractionAt.IsZero() ||
		command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: interaction deadline has not expired",
			ErrIllegalCommand,
		)
	}
	if state.CombatHelpOffer != nil &&
		state.SuspendedInteractionWindow != nil &&
		window.ID == state.CombatHelpOffer.ID {
		return handleTimeoutCombatHelp(state, command, pack)
	}
	next := state.Clone()
	events := make([]DomainEvent, 0, len(window.EligibleActorIDs)+1)
	for _, actorID := range window.EligibleActorIDs {
		if next.InteractionWindow.Responses[actorID].State !=
			InteractionResponsePending {
			continue
		}
		responseEvents, err := recordInteractionResponse(
			next,
			Command{
				ActorID:       actorID,
				InteractionID: command.InteractionID,
				InteractionAt: command.InteractionAt,
			},
			"",
			true,
		)
		if err != nil {
			return nil, err
		}
		next, err = Apply(next, responseEvents[0])
		if err != nil {
			return nil, err
		}
		events = append(events, responseEvents[0])
	}
	closeEvent, err := newEvent(
		EventInteractionWindowClosed,
		interactionWindowClosedPayload{
			InteractionID: command.InteractionID,
			Reason:        InteractionCloseDeadlineExpired,
			ClosedAt:      command.InteractionAt,
		},
	)
	if err != nil {
		return nil, err
	}
	events = append(events, closeEvent)
	next, err = Apply(next, closeEvent)
	if err != nil {
		return nil, err
	}
	return appendCombatContinuation(next, events, command.InteractionAt, pack)
}

func handleCloseInteractionWindow(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	if command.ActorID == "" || command.ActorID != window.InitiatorActorID {
		return nil, fmt.Errorf(
			"%w: actor cannot close interaction",
			ErrIllegalCommand,
		)
	}
	if command.InteractionAt.IsZero() ||
		command.InteractionAt.Before(window.OpenedAt) ||
		!command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: invalid interaction close instant",
			ErrIllegalCommand,
		)
	}
	reason := command.InteractionCloseReason
	if reason == "" {
		reason = InteractionCloseAllResponded
	}
	if reason == InteractionCloseDeadlineExpired ||
		reason == InteractionCloseAutoSkipped ||
		!validInteractionCloseReason(reason) {
		return nil, fmt.Errorf(
			"%w: close reason requires another typed transition",
			ErrIllegalCommand,
		)
	}
	event, err := newEvent(
		EventInteractionWindowClosed,
		interactionWindowClosedPayload{
			InteractionID: command.InteractionID,
			Reason:        reason,
			ClosedAt:      command.InteractionAt,
		},
	)
	if err != nil {
		return nil, err
	}
	next, err := Apply(state, event)
	if err != nil {
		return nil, err
	}
	return appendCombatContinuation(
		next,
		[]DomainEvent{event},
		command.InteractionAt,
		pack,
	)
}

func handlePlayCombatIntervention(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	if !profile.CombatResponses ||
		window.Kind != InteractionKindCombatResponse ||
		window.Parent.SubjectKind != InteractionSubjectEncounter ||
		state.Turn.Phase != PhaseCombat ||
		state.Turn.Encounter == nil ||
		state.Turn.Encounter.CombatClosed ||
		command.InteractionRevision != window.DeadlineRevision {
		return nil, fmt.Errorf(
			"%w: stale combat response action",
			ErrIllegalCommand,
		)
	}
	if _, err := interactionResponseAt(window, command.ActorID); err != nil {
		return nil, err
	}
	playerIndex := state.PlayerIndex(command.ActorID)
	if playerIndex < 0 ||
		!slices.Contains(state.Players[playerIndex].Hand, command.InstanceID) {
		return nil, fmt.Errorf(
			"%w: intervention source is not actor-owned",
			ErrIllegalCommand,
		)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	effect, legal := combatInterventionEffect(card)
	if !exists || !legal || string(effect.Target) != command.TargetInstanceID {
		return nil, fmt.Errorf(
			"%w: intervention source or target is not legal",
			ErrIllegalCommand,
		)
	}
	deadline, revision, budget, err := combatInterventionDeadlineAfter(
		window,
		command.InteractionAt,
	)
	if err != nil {
		return nil, err
	}
	event, err := newEvent(
		EventCombatInterventionApplied,
		combatInterventionAppliedPayload{
			InteractionID:          window.ID,
			PreviousRevision:       window.DeadlineRevision,
			ActorID:                command.ActorID,
			SourceInstanceID:       command.InstanceID,
			SourceDeck:             card.Deck,
			Target:                 effect.Target,
			Amount:                 effect.Amount,
			AcceptedAt:             command.InteractionAt,
			DeadlineAt:             deadline,
			DeadlineRevision:       revision,
			ExtensionBudgetSeconds: budget,
		},
	)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handlePlayAdvancedCombatEffect(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	if !profile.AdvancedCombat ||
		window.Kind != InteractionKindCombatResponse ||
		window.Parent.SubjectKind != InteractionSubjectEncounter ||
		state.Turn.Phase != PhaseCombat ||
		state.Turn.Encounter == nil ||
		state.Turn.Encounter.CombatClosed ||
		command.InteractionRevision != window.DeadlineRevision {
		return nil, fmt.Errorf(
			"%w: stale advanced combat action",
			ErrIllegalCommand,
		)
	}
	if _, err := interactionResponseAt(window, command.ActorID); err != nil {
		return nil, err
	}
	playerIndex := state.PlayerIndex(command.ActorID)
	if playerIndex < 0 ||
		!slices.Contains(state.Players[playerIndex].Hand, command.InstanceID) {
		return nil, fmt.Errorf(
			"%w: advanced combat source is not actor-owned",
			ErrIllegalCommand,
		)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists || card.CombatCapability == nil {
		return nil, fmt.Errorf(
			"%w: advanced combat source is not registered",
			ErrIllegalCommand,
		)
	}
	capability := *card.CombatCapability
	payload := advancedCombatEffectAppliedPayload{
		InteractionID:    window.ID,
		PreviousRevision: window.DeadlineRevision,
		ActorID:          command.ActorID,
		SourceInstanceID: command.InstanceID,
		SourceDeck:       card.Deck,
		Capability:       capability.Kind,
		Amount:           capability.Amount,
		AcceptedAt:       command.InteractionAt,
	}
	switch capability.Kind {
	case CombatCapabilityAddMonster:
		if card.Monster == nil ||
			command.TargetInstanceID != "" ||
			command.TargetEffectID != "" ||
			command.HelperPlayerID != "" {
			return nil, fmt.Errorf(
				"%w: invalid additional-monster target",
				ErrIllegalCommand,
			)
		}
		payload.EncounterOrder = append(
			encounterMonsterInstanceIDs(*state.Turn.Encounter),
			command.InstanceID,
		)
		payload.MonsterStrength = card.Monster.Strength
	case CombatCapabilityEnhance:
		if !slices.Contains(
			encounterMonsterInstanceIDs(*state.Turn.Encounter),
			command.TargetInstanceID,
		) ||
			command.TargetEffectID != "" ||
			command.HelperPlayerID != "" {
			return nil, fmt.Errorf(
				"%w: invalid enhancement target",
				ErrIllegalCommand,
			)
		}
		payload.EffectID = realizedCombatEffectID(
			window.ID,
			command.ActorID,
			command.InstanceID,
			window.DeadlineRevision,
		)
		payload.TargetMonsterInstanceID = command.TargetInstanceID
	case CombatCapabilityCounter:
		targetIndex := slices.IndexFunc(
			state.Turn.Encounter.CombatEffects,
			func(effect CombatEffect) bool {
				return effect.ID == command.TargetEffectID &&
					effect.Kind == CombatCapabilityEnhance &&
					effect.Active
			},
		)
		if targetIndex < 0 ||
			command.TargetInstanceID != "" ||
			command.HelperPlayerID != "" {
			return nil, fmt.Errorf(
				"%w: stale or invalid combat effect target",
				ErrIllegalCommand,
			)
		}
		payload.EffectID = realizedCombatEffectID(
			window.ID,
			command.ActorID,
			command.InstanceID,
			window.DeadlineRevision,
		)
		payload.TargetEffectID = command.TargetEffectID
	case CombatCapabilityForceHelper:
		helperIndex := state.PlayerIndex(command.HelperPlayerID)
		if state.Turn.Encounter.CombatHelp != nil ||
			helperIndex < 0 ||
			command.HelperPlayerID == state.Turn.PlayerID ||
			state.Players[helperIndex].Dead ||
			command.TargetInstanceID != "" ||
			command.TargetEffectID != "" {
			return nil, fmt.Errorf(
				"%w: invalid forced-helper target",
				ErrIllegalCommand,
			)
		}
		payload.HelperPlayerID = command.HelperPlayerID
	default:
		return nil, fmt.Errorf(
			"%w: unknown advanced combat capability",
			ErrInvalidContent,
		)
	}
	deadline, revision, budget, err := combatInterventionDeadlineAfter(
		window,
		command.InteractionAt,
	)
	if err != nil {
		return nil, err
	}
	payload.DeadlineAt = deadline
	payload.DeadlineRevision = revision
	payload.ExtensionBudgetSeconds = budget
	event, err := newEvent(EventAdvancedCombatEffectApplied, payload)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleOfferCombatHelp(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if !profile.CombatResponses ||
		state.Status != StatusActive ||
		state.Turn.Phase != PhaseCombat ||
		state.Turn.Encounter == nil ||
		state.Turn.Encounter.CombatClosed ||
		state.Turn.Encounter.CombatHelp != nil ||
		command.ActorID != state.Turn.PlayerID ||
		strings.TrimSpace(command.ChildInteractionID) == "" {
		return nil, fmt.Errorf(
			"%w: combat help is not available",
			ErrIllegalCommand,
		)
	}
	var parent InteractionWindow
	var replacedOfferID string
	if state.CombatHelpOffer == nil {
		window, err := requireInteractionWindow(state, command.InteractionID)
		if err != nil {
			return nil, err
		}
		if window.Kind != InteractionKindCombatResponse ||
			window.Parent.SubjectKind != InteractionSubjectEncounter ||
			window.InitiatorActorID != command.ActorID ||
			window.DeadlineRevision != command.InteractionRevision {
			return nil, fmt.Errorf(
				"%w: stale combat-help parent action",
				ErrIllegalCommand,
			)
		}
		parent = window
	} else {
		window, err := requireInteractionWindow(state, command.InteractionID)
		if err != nil {
			return nil, err
		}
		if state.SuspendedInteractionWindow == nil ||
			window.ID != state.CombatHelpOffer.ID ||
			window.InitiatorActorID != command.ActorID ||
			window.DeadlineRevision != command.InteractionRevision {
			return nil, fmt.Errorf(
				"%w: stale combat-help supersede action",
				ErrIllegalCommand,
			)
		}
		parent = *state.SuspendedInteractionWindow.clone()
		replacedOfferID = state.CombatHelpOffer.ID
	}
	helperIndex := state.PlayerIndex(command.HelperPlayerID)
	if helperIndex < 0 ||
		command.HelperPlayerID == command.ActorID ||
		state.Players[helperIndex].Dead {
		return nil, fmt.Errorf(
			"%w: combat helper is not eligible",
			ErrIllegalCommand,
		)
	}
	maxReward, err := combatHelpRewardMaximumSelected(state, pack)
	if err != nil {
		return nil, err
	}
	if command.RewardTreasures < 1 ||
		command.RewardTreasures > maxReward {
		return nil, fmt.Errorf(
			"%w: combat-help reward is outside server bounds",
			ErrIllegalCommand,
		)
	}
	offer := CombatHelpOffer{
		ID:                  command.ChildInteractionID,
		ParentInteractionID: parent.ID,
		CombatantPlayerID:   command.ActorID,
		HelperPlayerID:      command.HelperPlayerID,
		RewardTreasures:     command.RewardTreasures,
	}
	child, err := combatHelpWindow(parent, offer, command.InteractionAt)
	if err != nil {
		return nil, err
	}
	event, err := newEvent(
		EventCombatHelpOffered,
		combatHelpOfferedPayload{
			Offer:           offer,
			Window:          *child,
			ReplacedOfferID: replacedOfferID,
		},
	)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleRespondCombatHelp(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	if command.InteractionIntent != InteractionIntentAccept &&
		command.InteractionIntent != InteractionIntentDecline {
		return nil, fmt.Errorf(
			"%w: combat-help response must accept or decline",
			ErrIllegalCommand,
		)
	}
	window, offer, parent, err := requireCombatHelpOffer(
		state,
		command.InteractionID,
	)
	if err != nil {
		return nil, err
	}
	if command.ActorID != offer.HelperPlayerID ||
		command.InteractionRevision != window.DeadlineRevision ||
		command.InteractionAt.IsZero() ||
		command.InteractionAt.Before(window.OpenedAt) ||
		!command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: stale or foreign combat-help response",
			ErrIllegalCommand,
		)
	}
	if _, err := interactionResponseAt(window, command.ActorID); err != nil {
		return nil, err
	}
	reason := InteractionCloseDeclined
	parentDeadline := parent.DeadlineAt
	parentRevision := parent.DeadlineRevision
	parentBudget := parent.ExtensionBudgetSeconds
	if command.InteractionIntent == InteractionIntentAccept {
		maxReward, err := combatHelpRewardMaximumSelected(state, pack)
		if err != nil {
			return nil, err
		}
		if offer.RewardTreasures > maxReward {
			return nil, fmt.Errorf(
				"%w: accepted combat-help reward is no longer available",
				ErrIllegalCommand,
			)
		}
		parentDeadline, parentRevision, parentBudget, err =
			combatInterventionDeadlineAfter(parent, command.InteractionAt)
		if err != nil {
			return nil, err
		}
		reason = InteractionCloseAccepted
	}
	event, err := newEvent(
		EventCombatHelpOfferResolved,
		combatHelpOfferResolvedPayload{
			OfferID:                      offer.ID,
			ParentInteractionID:          parent.ID,
			ActorID:                      command.ActorID,
			Intent:                       command.InteractionIntent,
			Reason:                       reason,
			ResolvedAt:                   command.InteractionAt,
			ParentDeadlineAt:             parentDeadline,
			ParentDeadlineRevision:       parentRevision,
			ParentExtensionBudgetSeconds: parentBudget,
		},
	)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleCancelCombatHelp(
	state State,
	command Command,
) ([]DomainEvent, error) {
	window, offer, parent, err := requireCombatHelpOffer(
		state,
		command.InteractionID,
	)
	if err != nil {
		return nil, err
	}
	if command.ActorID != offer.CombatantPlayerID ||
		command.ActorID != window.InitiatorActorID ||
		command.InteractionRevision != window.DeadlineRevision ||
		command.InteractionAt.IsZero() ||
		command.InteractionAt.Before(window.OpenedAt) ||
		!command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: stale or foreign combat-help cancel",
			ErrIllegalCommand,
		)
	}
	event, err := newEvent(
		EventCombatHelpOfferResolved,
		combatHelpOfferResolvedPayload{
			OfferID:                      offer.ID,
			ParentInteractionID:          parent.ID,
			ActorID:                      command.ActorID,
			Reason:                       InteractionCloseCancelled,
			ResolvedAt:                   command.InteractionAt,
			ParentDeadlineAt:             parent.DeadlineAt,
			ParentDeadlineRevision:       parent.DeadlineRevision,
			ParentExtensionBudgetSeconds: parent.ExtensionBudgetSeconds,
		},
	)
	if err != nil {
		return nil, err
	}
	if _, err := Apply(state, event); err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleTimeoutCombatHelp(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	window, offer, parent, err := requireCombatHelpOffer(
		state,
		command.InteractionID,
	)
	if err != nil {
		return nil, err
	}
	if command.InteractionRevision != window.DeadlineRevision ||
		command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: stale combat-help timeout",
			ErrIllegalCommand,
		)
	}
	event, err := newEvent(
		EventCombatHelpOfferResolved,
		combatHelpOfferResolvedPayload{
			OfferID:                      offer.ID,
			ParentInteractionID:          parent.ID,
			ActorID:                      offer.HelperPlayerID,
			Intent:                       InteractionIntentDecline,
			Reason:                       InteractionCloseDeadlineExpired,
			ResolvedAt:                   command.InteractionAt,
			ParentDeadlineAt:             parent.DeadlineAt,
			ParentDeadlineRevision:       parent.DeadlineRevision,
			ParentExtensionBudgetSeconds: parent.ExtensionBudgetSeconds,
		},
	)
	if err != nil {
		return nil, err
	}
	next, err := Apply(state, event)
	if err != nil {
		return nil, err
	}
	events := []DomainEvent{event}
	if !command.InteractionAt.Before(parent.DeadlineAt) {
		parentEvents, err := handleTimeoutInteraction(
			next,
			Command{
				Type:                CommandTimeoutInteraction,
				InteractionID:       parent.ID,
				InteractionAt:       command.InteractionAt,
				InteractionRevision: parent.DeadlineRevision,
			},
			pack,
		)
		if err != nil {
			return nil, err
		}
		events = append(events, parentEvents...)
	}
	return events, nil
}

func requireCombatHelpOffer(
	state State,
	interactionID string,
) (InteractionWindow, CombatHelpOffer, InteractionWindow, error) {
	window, err := requireInteractionWindow(state, interactionID)
	if err != nil {
		return InteractionWindow{}, CombatHelpOffer{}, InteractionWindow{}, err
	}
	if state.CombatHelpOffer == nil ||
		state.SuspendedInteractionWindow == nil ||
		state.CombatHelpOffer.ID != window.ID {
		return InteractionWindow{}, CombatHelpOffer{}, InteractionWindow{},
			fmt.Errorf("%w: combat-help offer is not active", ErrIllegalCommand)
	}
	return window,
		*state.CombatHelpOffer,
		*state.SuspendedInteractionWindow.clone(),
		nil
}

func appendCombatContinuation(
	state State,
	events []DomainEvent,
	acceptedAt time.Time,
	pack Pack,
) ([]DomainEvent, error) {
	window := state.InteractionWindow
	if window == nil ||
		window.Status != InteractionWindowClosed {
		return events, nil
	}
	command := Command{
		ActorID:       window.InitiatorActorID,
		InteractionID: window.ID,
		InteractionAt: acceptedAt,
	}
	var continued []DomainEvent
	var err error
	switch window.Kind {
	case InteractionKindCombatResponse:
		if window.Parent.SubjectKind != InteractionSubjectEncounter {
			return events, nil
		}
		command.Type = CommandCompleteCombatResolution
		continued, err = handleCompleteCombatResolution(
			state,
			command,
			pack,
		)
	case InteractionKindTargetResponse:
		command.Type = CommandResolveTargetEffect
		continued, err = handleResolveTargetEffect(state, command, pack)
	case InteractionKindRunAwayResponse:
		command.Type = CommandResolveRunAwayStep
		continued, err = handleResolveRunAwayStep(state, command, pack)
	default:
		return events, nil
	}
	if err != nil {
		return nil, err
	}
	return append(events, continued...), nil
}

func requireInteractionWindow(
	state State,
	interactionID string,
) (InteractionWindow, error) {
	if strings.TrimSpace(interactionID) == "" ||
		state.InteractionWindow == nil ||
		state.InteractionWindow.ID != interactionID {
		return InteractionWindow{}, fmt.Errorf(
			"%w: stale interaction ID",
			ErrIllegalCommand,
		)
	}
	if state.InteractionWindow.Status != InteractionWindowOpen {
		return InteractionWindow{}, fmt.Errorf(
			"%w: interaction is already closed",
			ErrIllegalCommand,
		)
	}
	return *state.InteractionWindow.clone(), nil
}

func requireActiveActor(state State, command Command) (int, error) {
	if state.Status != StatusActive ||
		command.ActorID == "" ||
		command.ActorID != state.Turn.PlayerID {
		return -1, fmt.Errorf("%w: actor does not own turn", ErrIllegalCommand)
	}
	index := state.PlayerIndex(command.ActorID)
	if index < 0 {
		return -1, fmt.Errorf("%w: actor is not a player", ErrIllegalCommand)
	}
	return index, nil
}

func requirePhase(state State, command Command, phases ...Phase) (int, error) {
	index, err := requireActiveActor(state, command)
	if err != nil {
		return -1, err
	}
	if state.Turn.Pending != nil && command.Type != CommandChooseEffect {
		return -1, fmt.Errorf("%w: a decision is pending", ErrIllegalCommand)
	}
	if !slices.Contains(phases, state.Turn.Phase) {
		return -1, fmt.Errorf(
			"%w: phase %s is not valid for %s",
			ErrIllegalCommand,
			state.Turn.Phase,
			command.Type,
		)
	}
	return index, nil
}

func transition(
	eventType string,
	command Command,
	next State,
	outcomes []RandomOutcome,
) ([]DomainEvent, error) {
	if err := next.Validate(); err != nil {
		return nil, err
	}
	event, err := newStateEvent(eventType, command.Type, next, outcomes)
	if err != nil {
		return nil, err
	}
	return []DomainEvent{event}, nil
}

func handleJoin(state State, command Command) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if state.Status != StatusLobby || len(state.Players) >= profile.MaxPlayers {
		return nil, fmt.Errorf("%w: lobby is not joinable", ErrIllegalCommand)
	}
	name := strings.TrimSpace(command.DisplayName)
	if command.PlayerID == "" || name == "" || command.CredentialHash == "" {
		return nil, fmt.Errorf("%w: join fields", ErrIllegalCommand)
	}
	if state.PlayerIndex(command.PlayerID) >= 0 {
		return nil, fmt.Errorf("%w: duplicate player", ErrIllegalCommand)
	}
	for _, player := range state.Players {
		if player.CredentialHash == command.CredentialHash {
			return nil, fmt.Errorf("%w: duplicate credential", ErrIllegalCommand)
		}
	}
	next := state.Clone()
	next.Players = append(next.Players, Player{
		ID:             command.PlayerID,
		Name:           name,
		Level:          1,
		CredentialHash: command.CredentialHash,
	})
	return transition(EventPlayerJoined, command, next, nil)
}

func handleStart(state State, command Command, pack Pack) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if state.Status != StatusLobby || command.ActorID != state.OwnerPlayerID {
		return nil, fmt.Errorf("%w: only owner starts lobby", ErrIllegalCommand)
	}
	if len(state.Players) < profile.MinPlayers {
		return nil, fmt.Errorf(
			"%w: at least %d player required",
			ErrIllegalCommand,
			profile.MinPlayers,
		)
	}
	instances, doors, treasures, err := materializeSelectedProfile(pack, profile)
	if err != nil {
		return nil, err
	}
	doors, rngState := shuffle(doors, state.RNGState)
	treasures, rngState = shuffle(treasures, rngState)
	next := state.Clone()
	next.Status = StatusActive
	next.Instances = instances
	next.DoorDeck = doors
	next.TreasureDeck = treasures
	next.RNGState = rngState
	outcomes := []RandomOutcome{
		{Kind: "shuffle", Deck: DeckDoor, Order: append([]string(nil), doors...)},
		{Kind: "shuffle", Deck: DeckTreasure, Order: append([]string(nil), treasures...)},
	}
	for index := range next.Players {
		doorCards, err := next.takeCards(
			DeckDoor,
			profile.InitialDoorCards,
			&outcomes,
		)
		if err != nil {
			return nil, err
		}
		treasureCards, err := next.takeCards(
			DeckTreasure,
			profile.InitialTreasureCards,
			&outcomes,
		)
		if err != nil {
			return nil, err
		}
		next.Players[index].Hand = append(doorCards, treasureCards...)
		next.Players[index].SetupDone = false
	}
	next.Turn = Turn{PlayerID: next.Players[0].ID}
	setTurnPhase(&next, PhaseSetup)
	return transition(EventGameStarted, command, next, outcomes)
}

func handleFinishSetup(state State, command Command) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseSetup)
	if err != nil {
		return nil, err
	}
	next := state.Clone()
	next.Players[playerIndex].SetupDone = true
	nextPlayerIndex := -1
	for offset := 1; offset <= len(next.Players); offset++ {
		candidate := (playerIndex + offset) % len(next.Players)
		if !next.Players[candidate].SetupDone {
			nextPlayerIndex = candidate
			break
		}
	}
	if nextPlayerIndex >= 0 {
		next.Turn = Turn{PlayerID: next.Players[nextPlayerIndex].ID}
		setTurnPhase(&next, PhaseSetup)
	} else {
		next.Turn = Turn{PlayerID: next.Players[0].ID}
		setTurnPhase(&next, PhasePreparation)
	}
	return transition(EventSetupFinished, command, next, nil)
}

func handlePlayCard(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(
		state,
		command,
		PhaseSetup,
		PhasePreparation,
		PhaseCombat,
		PhaseCharity,
	)
	if err != nil {
		return nil, err
	}
	player := state.Players[playerIndex]
	if !slices.Contains(player.Hand, command.InstanceID) {
		return nil, fmt.Errorf("%w: selected card is not in hand", ErrIllegalCommand)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists {
		return nil, fmt.Errorf("%w: hand card", ErrUnknownCard)
	}
	next := state.Clone()
	nextPlayer := &next.Players[playerIndex]
	switch card.Kind {
	case CardItem:
		if state.Turn.Phase == PhaseCombat {
			return nil, fmt.Errorf("%w: item cannot enter play during combat", ErrIllegalCommand)
		}
		if err := canCarryItem(state, playerIndex, command.InstanceID, pack); err != nil {
			return nil, err
		}
		nextPlayer.Hand, _ = removeString(nextPlayer.Hand, command.InstanceID)
		nextPlayer.Carried = append(nextPlayer.Carried, command.InstanceID)
	case CardClass, CardRace:
		if state.Turn.Phase == PhaseCombat {
			return nil, fmt.Errorf("%w: trait cannot enter play during combat", ErrIllegalCommand)
		}
		capacity, err := traitCapacity(next, *nextPlayer, card.Trait.Group, pack)
		if err != nil {
			return nil, err
		}
		count, err := traitCount(next, *nextPlayer, card.Trait.Group, pack)
		if err != nil {
			return nil, err
		}
		if count >= capacity {
			return nil, fmt.Errorf("%w: trait capacity is full", ErrIllegalCommand)
		}
		nextPlayer.Hand, _ = removeString(nextPlayer.Hand, command.InstanceID)
		nextPlayer.Traits = append(nextPlayer.Traits, command.InstanceID)
	case CardTraitAttachment:
		if state.Turn.Phase == PhaseCombat {
			return nil, fmt.Errorf("%w: attachment cannot enter play during combat", ErrIllegalCommand)
		}
		count, err := traitCount(next, *nextPlayer, card.Attachment.Group, pack)
		if err != nil {
			return nil, err
		}
		if count == 0 {
			return nil, fmt.Errorf("%w: attachment needs an existing trait", ErrIllegalCommand)
		}
		for _, attachmentID := range nextPlayer.Attachments {
			attachment, _, exists := pack.DefinitionForInstance(next, attachmentID)
			if exists &&
				attachment.Attachment != nil &&
				attachment.Attachment.Group == card.Attachment.Group {
				return nil, fmt.Errorf("%w: attachment group already used", ErrIllegalCommand)
			}
		}
		nextPlayer.Hand, _ = removeString(nextPlayer.Hand, command.InstanceID)
		nextPlayer.Attachments = append(nextPlayer.Attachments, command.InstanceID)
	case CardCheat:
		if state.Turn.Phase == PhaseCombat {
			return nil, fmt.Errorf("%w: cheat cannot enter play during combat", ErrIllegalCommand)
		}
		if command.TargetInstanceID == "" ||
			(!slices.Contains(nextPlayer.Hand, command.TargetInstanceID) &&
				!slices.Contains(nextPlayer.Carried, command.TargetInstanceID) &&
				!slices.Contains(nextPlayer.Equipped, command.TargetInstanceID)) {
			return nil, fmt.Errorf("%w: cheat target is not an owned item", ErrIllegalCommand)
		}
		target, _, exists := pack.DefinitionForInstance(next, command.TargetInstanceID)
		if !exists || target.Item == nil || isCheated(*nextPlayer, command.TargetInstanceID) {
			return nil, fmt.Errorf("%w: invalid cheat target", ErrIllegalCommand)
		}
		if slices.Contains(nextPlayer.Hand, command.TargetInstanceID) {
			nextPlayer.Hand, _ = removeString(
				nextPlayer.Hand,
				command.TargetInstanceID,
			)
			nextPlayer.Carried = append(
				nextPlayer.Carried,
				command.TargetInstanceID,
			)
		}
		nextPlayer.Hand, _ = removeString(nextPlayer.Hand, command.InstanceID)
		nextPlayer.Attachments = append(nextPlayer.Attachments, command.InstanceID)
		if nextPlayer.CheatTargets == nil {
			nextPlayer.CheatTargets = make(map[string]string)
		}
		nextPlayer.CheatTargets[command.InstanceID] = command.TargetInstanceID
	case CardOneShot:
		if state.Turn.Phase != PhaseCombat {
			return nil, fmt.Errorf("%w: one-shot requires combat", ErrIllegalCommand)
		}
		nextPlayer.Hand, _ = removeString(nextPlayer.Hand, command.InstanceID)
		next.Turn.Resolving = append(next.Turn.Resolving, command.InstanceID)
		var outcomes []RandomOutcome
		if err := beginEffectSequence(
			&next,
			playerIndex,
			command.InstanceID,
			card.Effects,
			PendingFinalize{
				Phase:            PhaseCombat,
				DiscardSource:    true,
				SourceInstanceID: command.InstanceID,
			},
			pack,
			&outcomes,
		); err != nil {
			return nil, err
		}
		return transition(EventCardPlayed, command, next, outcomes)
	case CardCurse, CardLevelUp:
		if state.Turn.Phase == PhaseCombat {
			return nil, fmt.Errorf("%w: card cannot be played during combat", ErrIllegalCommand)
		}
		profile, err := state.Profile()
		if err != nil {
			return nil, err
		}
		if profile.TargetAndRunAway && targetableEffectCard(card) {
			return nil, fmt.Errorf(
				"%w: other-player curse requires a server target descriptor",
				ErrIllegalCommand,
			)
		}
		nextPlayer.Hand, _ = removeString(nextPlayer.Hand, command.InstanceID)
		next.Turn.Resolving = append(next.Turn.Resolving, command.InstanceID)
		var outcomes []RandomOutcome
		if err := beginEffectSequence(
			&next,
			playerIndex,
			command.InstanceID,
			card.Effects,
			PendingFinalize{
				Phase:            state.Turn.Phase,
				DiscardSource:    !effectsPersist(card.Effects),
				SourceInstanceID: command.InstanceID,
			},
			pack,
			&outcomes,
		); err != nil {
			return nil, err
		}
		return transition(EventCardPlayed, command, next, outcomes)
	default:
		return nil, fmt.Errorf("%w: card cannot be played directly", ErrIllegalCommand)
	}
	if err := reconcileLoadout(&next, playerIndex, pack); err != nil {
		return nil, err
	}
	return transition(EventCardPlayed, command, next, nil)
}

func handleEquipItem(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(
		state,
		command,
		PhaseSetup,
		PhasePreparation,
		PhaseCharity,
	)
	if err != nil {
		return nil, err
	}
	if err := canEquip(state, playerIndex, command.InstanceID, pack); err != nil {
		return nil, err
	}
	next := state.Clone()
	player := &next.Players[playerIndex]
	player.Carried, _ = removeString(player.Carried, command.InstanceID)
	player.Equipped = append(player.Equipped, command.InstanceID)
	if err := reconcileLoadout(&next, playerIndex, pack); err != nil {
		return nil, err
	}
	return transition(EventEquipmentChanged, command, next, nil)
}

func handleUnequipItem(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(
		state,
		command,
		PhaseSetup,
		PhasePreparation,
		PhaseCharity,
	)
	if err != nil {
		return nil, err
	}
	if !slices.Contains(state.Players[playerIndex].Equipped, command.InstanceID) {
		return nil, fmt.Errorf("%w: item is not equipped", ErrIllegalCommand)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists || card.Item == nil {
		return nil, fmt.Errorf("%w: equipped card is not an item", ErrInvalidContent)
	}
	next := state.Clone()
	player := &next.Players[playerIndex]
	player.Equipped, _ = removeString(player.Equipped, command.InstanceID)
	player.Carried = append(player.Carried, command.InstanceID)
	if err := reconcileLoadout(&next, playerIndex, pack); err != nil {
		return nil, err
	}
	return transition(EventEquipmentChanged, command, next, nil)
}

func handleDiscardCard(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(
		state,
		command,
		PhaseSetup,
		PhasePreparation,
		PhaseCombat,
		PhaseCharity,
	)
	if err != nil {
		return nil, err
	}
	player := state.Players[playerIndex]
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists {
		return nil, fmt.Errorf("%w: selected card", ErrUnknownCard)
	}
	if !slices.Contains(player.Traits, command.InstanceID) &&
		!slices.Contains(player.Attachments, command.InstanceID) {
		return nil, fmt.Errorf("%w: only an in-play trait may be discarded", ErrIllegalCommand)
	}
	if card.Kind != CardClass &&
		card.Kind != CardRace &&
		card.Kind != CardTraitAttachment {
		return nil, fmt.Errorf("%w: card is not a discardable trait", ErrIllegalCommand)
	}
	if card.Attachment != nil {
		count, err := traitCount(state, player, card.Attachment.Group, pack)
		if err != nil {
			return nil, err
		}
		capacity, err := traitCapacity(state, player, card.Attachment.Group, pack)
		if err != nil {
			return nil, err
		}
		if count > capacity-card.Attachment.ExtraTraits {
			return nil, fmt.Errorf(
				"%w: discard an extra trait before its attachment",
				ErrIllegalCommand,
			)
		}
	}
	next := state.Clone()
	if err := discardOwnedInstance(&next, playerIndex, command.InstanceID, pack); err != nil {
		return nil, err
	}
	if err := reconcileLoadout(&next, playerIndex, pack); err != nil {
		return nil, err
	}
	return transition(EventCardPlayed, command, next, nil)
}

func handleSellItems(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(
		state,
		command,
		PhasePreparation,
		PhaseCharity,
	)
	if err != nil {
		return nil, err
	}
	if len(command.InstanceIDs) == 0 || !uniqueStrings(command.InstanceIDs) {
		return nil, fmt.Errorf("%w: select unique items to sell", ErrIllegalCommand)
	}
	player := state.Players[playerIndex]
	total := 0
	for _, instanceID := range command.InstanceIDs {
		if !slices.Contains(player.Hand, instanceID) &&
			!slices.Contains(player.Carried, instanceID) &&
			!slices.Contains(player.Equipped, instanceID) {
			return nil, fmt.Errorf("%w: sold card is not owned", ErrIllegalCommand)
		}
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if !exists || card.Item == nil {
			return nil, fmt.Errorf("%w: only items may be sold", ErrIllegalCommand)
		}
		total += card.Item.Value
	}
	levels := total / SaleLevelCost
	if levels < 1 {
		return nil, fmt.Errorf(
			"%w: sale value must reach %d",
			ErrIllegalCommand,
			SaleLevelCost,
		)
	}
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if player.Level >= profile.WinningLevel-1 {
		return nil, fmt.Errorf("%w: sale cannot grant the winning level", ErrIllegalCommand)
	}
	next := state.Clone()
	for _, instanceID := range command.InstanceIDs {
		if err := discardOwnedInstance(&next, playerIndex, instanceID, pack); err != nil {
			return nil, err
		}
	}
	next.Players[playerIndex].Level = min(
		profile.WinningLevel-1,
		next.Players[playerIndex].Level+levels,
	)
	if _, err := queueLoadoutResolution(
		&next,
		playerIndex,
		"",
		nil,
		PendingFinalize{Phase: state.Turn.Phase},
		pack,
	); err != nil {
		return nil, err
	}
	return transition(EventItemsSold, command, next, nil)
}

func handleOpenDoor(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhasePreparation)
	if err != nil {
		return nil, err
	}
	next := state.Clone()
	var outcomes []RandomOutcome
	drawn, err := next.takeCards(DeckDoor, 1, &outcomes)
	if err != nil {
		return nil, err
	}
	instanceID := drawn[0]
	next.Turn.Resolving = append(next.Turn.Resolving, instanceID)
	card, _, exists := pack.DefinitionForInstance(next, instanceID)
	if !exists {
		return nil, fmt.Errorf("%w: opened door", ErrUnknownCard)
	}
	switch card.Kind {
	case CardMonster:
		next.Turn.Resolving, _ = removeString(next.Turn.Resolving, instanceID)
		next.Turn.Encounter = &Encounter{MonsterInstanceID: instanceID}
		setTurnPhase(&next, PhaseCombat)
	case CardCurse:
		profile, err := next.Profile()
		if err != nil {
			return nil, err
		}
		if profile.TargetAndRunAway && targetableEffectCard(card) {
			next.Turn.Resolving, _ = removeString(
				next.Turn.Resolving,
				instanceID,
			)
			next.Players[playerIndex].Hand = append(
				next.Players[playerIndex].Hand,
				instanceID,
			)
			setTurnPhase(&next, PhaseDoorChoice)
			break
		}
		if err := beginEffectSequence(
			&next,
			playerIndex,
			instanceID,
			card.Effects,
			PendingFinalize{
				Phase:            PhaseDoorChoice,
				DiscardSource:    !effectsPersist(card.Effects),
				SourceInstanceID: instanceID,
			},
			pack,
			&outcomes,
		); err != nil {
			return nil, err
		}
	default:
		next.Turn.Resolving, _ = removeString(next.Turn.Resolving, instanceID)
		next.Players[playerIndex].Hand = append(
			next.Players[playerIndex].Hand,
			instanceID,
		)
		setTurnPhase(&next, PhaseDoorChoice)
	}
	return transition(EventDoorOpened, command, next, outcomes)
}

func handleLookForTrouble(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseDoorChoice)
	if err != nil {
		return nil, err
	}
	if !slices.Contains(state.Players[playerIndex].Hand, command.InstanceID) {
		return nil, fmt.Errorf("%w: monster is not in hand", ErrIllegalCommand)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists || card.Monster == nil {
		return nil, fmt.Errorf("%w: selected card is not a monster", ErrIllegalCommand)
	}
	next := state.Clone()
	next.Players[playerIndex].Hand, _ = removeString(
		next.Players[playerIndex].Hand,
		command.InstanceID,
	)
	next.Turn.Encounter = &Encounter{MonsterInstanceID: command.InstanceID}
	setTurnPhase(&next, PhaseCombat)
	return transition(EventTroubleSought, command, next, nil)
}

func handleLootRoom(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseDoorChoice)
	if err != nil {
		return nil, err
	}
	next := state.Clone()
	var outcomes []RandomOutcome
	drawn, err := next.takeCards(DeckDoor, 1, &outcomes)
	if err != nil {
		return nil, err
	}
	next.Players[playerIndex].Hand = append(next.Players[playerIndex].Hand, drawn[0])
	setTurnPhase(&next, PhaseCharity)
	return transition(EventRoomLooted, command, next, outcomes)
}

func handleUseAbility(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseCombat)
	if err != nil {
		return nil, err
	}
	if state.Turn.Encounter == nil || state.Turn.Encounter.CombatClosed {
		return nil, fmt.Errorf("%w: combat action window is closed", ErrIllegalCommand)
	}
	player := state.Players[playerIndex]
	if !slices.Contains(player.Traits, command.InstanceID) &&
		!slices.Contains(player.Equipped, command.InstanceID) {
		return nil, fmt.Errorf("%w: ability source is not active", ErrIllegalCommand)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists ||
		command.AbilityIndex < 0 ||
		command.AbilityIndex >= len(card.Abilities) {
		return nil, fmt.Errorf("%w: unknown ability", ErrIllegalCommand)
	}
	ability := card.Abilities[command.AbilityIndex]
	if ability.Kind != AbilityDiscardForCombat ||
		len(command.InstanceIDs) != ability.DiscardCount ||
		!uniqueStrings(command.InstanceIDs) {
		return nil, fmt.Errorf("%w: invalid ability cost", ErrIllegalCommand)
	}
	for _, costID := range command.InstanceIDs {
		if !slices.Contains(player.Hand, costID) {
			return nil, fmt.Errorf("%w: ability cost is not in hand", ErrIllegalCommand)
		}
	}
	next := state.Clone()
	for _, costID := range command.InstanceIDs {
		if err := discardOwnedInstance(&next, playerIndex, costID, pack); err != nil {
			return nil, err
		}
	}
	next.Turn.Encounter.PlayerCombatModifier += ability.Amount
	return transition(EventCombatAction, command, next, nil)
}

func handleResolveCombat(state State, command Command, pack Pack) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if profile.CombatResponses {
		return nil, fmt.Errorf(
			"%w: multiplayer combat requires resolution request",
			ErrIllegalCommand,
		)
	}
	return resolveCombatNow(state, command, pack)
}

func handleRequestCombatResolution(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	if _, err := requirePhase(state, command, PhaseCombat); err != nil {
		return nil, err
	}
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if !profile.CombatResponses ||
		state.Turn.Encounter == nil ||
		state.Turn.Encounter.CombatClosed ||
		state.InteractionWindow != nil &&
			state.InteractionWindow.Status == InteractionWindowOpen ||
		strings.TrimSpace(command.InteractionID) == "" ||
		command.InteractionAt.IsZero() {
		return nil, fmt.Errorf(
			"%w: combat response window cannot be requested",
			ErrIllegalCommand,
		)
	}
	window := combatResponseWindow(
		state,
		command.InteractionID,
		command.InteractionAt,
	)
	if window == nil {
		return resolveCombatNow(state, command, pack)
	}
	return handleOpenInteractionWindow(state, Command{
		Type:              CommandOpenInteractionWindow,
		ActorID:           command.ActorID,
		InteractionWindow: window,
	})
}

func handleCompleteCombatResolution(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window := state.InteractionWindow
	if !profile.CombatResponses ||
		window == nil ||
		window.ID != command.InteractionID ||
		window.Status != InteractionWindowClosed ||
		window.Kind != InteractionKindCombatResponse ||
		window.Parent.SubjectKind != InteractionSubjectEncounter ||
		window.InitiatorActorID != command.ActorID {
		return nil, fmt.Errorf(
			"%w: combat response continuation is not available",
			ErrIllegalCommand,
		)
	}
	return resolveCombatNow(state, command, pack)
}

func resolveCombatNow(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseCombat)
	if err != nil {
		return nil, err
	}
	if state.Turn.Encounter == nil || state.Turn.Encounter.CombatClosed {
		return nil, fmt.Errorf("%w: combat is already closed", ErrIllegalCommand)
	}
	totals, err := combatTotals(state, playerIndex, pack)
	if err != nil {
		return nil, err
	}
	next := state.Clone()
	monsterCards, err := encounterMonsterCards(next, pack)
	if err != nil {
		return nil, err
	}
	monsterCard := monsterCards[0]
	var outcomes []RandomOutcome
	if totals.PlayerWins {
		rewardModifier, err := treasureRewardModifier(
			next,
			playerIndex,
			pack,
			monsterCard.Monster.Tags,
		)
		if err != nil {
			return nil, err
		}
		rewardCount := rewardModifier
		levelReward := 0
		for _, encounteredMonster := range monsterCards {
			rewardCount += encounteredMonster.Monster.Treasures
			levelReward += encounteredMonster.Monster.Levels
		}
		rewardCount = max(0, rewardCount)
		rewardCount = min(
			rewardCount,
			len(next.TreasureDeck)+len(next.TreasureDiscard),
		)
		var prefix []DomainEvent
		help := next.Turn.Encounter.CombatHelp
		if help != nil && help.RewardStatus == CombatHelpRewardAccepted {
			if rewardCount < help.RewardTreasures {
				return nil, fmt.Errorf(
					"%w: accepted helper reward cannot be settled",
					ErrIllegalCommand,
				)
			}
			helperIndex := next.PlayerIndex(help.HelperPlayerID)
			if helperIndex < 0 {
				return nil, fmt.Errorf(
					"%w: accepted combat helper is missing",
					ErrIllegalCommand,
				)
			}
			rewards, err := next.takeCards(
				DeckTreasure,
				rewardCount,
				&outcomes,
			)
			if err != nil {
				return nil, err
			}
			outcomes = append(outcomes, RandomOutcome{
				Kind:  "draw",
				Deck:  DeckTreasure,
				Order: append([]string(nil), rewards...),
			})
			next.Players[helperIndex].Hand = append(
				next.Players[helperIndex].Hand,
				rewards[:help.RewardTreasures]...,
			)
			next.Players[playerIndex].Hand = append(
				next.Players[playerIndex].Hand,
				rewards[help.RewardTreasures:]...,
			)
			next.Turn.Encounter.CombatHelp.RewardStatus =
				CombatHelpRewardSettled
			settlement, err := newStateEvent(
				EventCombatHelpRewardSettled,
				command.Type,
				next,
				outcomes,
			)
			if err != nil {
				return nil, err
			}
			next, err = Apply(state, settlement)
			if err != nil {
				return nil, err
			}
			prefix = append(prefix, settlement)
			outcomes = nil
		} else if rewardCount > 0 {
			rewards, err := next.takeCards(DeckTreasure, rewardCount, &outcomes)
			if err != nil {
				return nil, err
			}
			next.Players[playerIndex].Hand = append(
				next.Players[playerIndex].Hand,
				rewards...,
			)
		}
		profile, err := next.Profile()
		if err != nil {
			return nil, err
		}
		next.Players[playerIndex].Level = min(
			profile.WinningLevel,
			next.Players[playerIndex].Level+levelReward,
		)
		if err := discardEncounterSet(&next, pack); err != nil {
			return nil, err
		}
		if next.Players[playerIndex].Level >= profile.WinningLevel {
			next.Status = StatusFinished
			next.WinnerPlayerID = next.Players[playerIndex].ID
			next.Turn.Phase = ""
			next.Turn.ActionWindow = ActionWindow{}
		} else {
			setTurnPhase(&next, PhaseCharity)
		}
		resolved, err := transition(
			EventCombatResolved,
			command,
			next,
			outcomes,
		)
		if err != nil {
			return nil, err
		}
		return append(prefix, resolved...), nil
	}
	var prefix []DomainEvent
	if help := next.Turn.Encounter.CombatHelp; help != nil &&
		help.RewardStatus == CombatHelpRewardAccepted {
		next.Turn.Encounter.CombatHelp.RewardStatus = CombatHelpRewardVoided
		voided, err := newStateEvent(
			EventCombatHelpRewardVoided,
			command.Type,
			next,
			nil,
		)
		if err != nil {
			return nil, err
		}
		next, err = Apply(state, voided)
		if err != nil {
			return nil, err
		}
		prefix = append(prefix, voided)
	}
	profile, err := next.Profile()
	if err != nil {
		return nil, err
	}
	if profile.TargetAndRunAway {
		next.Turn.Encounter.CombatClosed = true
		if err := initializeRunAwaySequence(&next); err != nil {
			return nil, err
		}
		setTurnPhase(&next, PhaseRunAway)
	} else {
		tags, err := characterTags(next, next.Players[playerIndex], pack)
		if err != nil {
			return nil, err
		}
		autoEscape := next.Players[playerIndex].Level <=
			monsterCard.Monster.PursuitMinLevel ||
			containsAny(tags, monsterCard.Monster.AutoEscapeCharacterTags)
		if autoEscape {
			if err := discardEncounterSet(&next, pack); err != nil {
				return nil, err
			}
			setTurnPhase(&next, PhaseCharity)
		} else {
			next.Turn.Encounter.CombatClosed = true
			setTurnPhase(&next, PhaseRunAway)
		}
	}
	resolved, err := transition(EventCombatResolved, command, next, outcomes)
	if err != nil {
		return nil, err
	}
	return append(prefix, resolved...), nil
}

func handlePlayTargetEffect(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(
		state,
		command,
		PhasePreparation,
		PhaseDoorChoice,
		PhaseCharity,
	)
	if err != nil {
		return nil, err
	}
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if !profile.TargetAndRunAway ||
		state.Turn.TargetEffect != nil ||
		state.Turn.RunAway != nil ||
		state.InteractionWindow != nil &&
			state.InteractionWindow.Status == InteractionWindowOpen ||
		strings.TrimSpace(command.InteractionID) == "" ||
		command.InteractionAt.IsZero() ||
		!slices.Contains(
			state.Players[playerIndex].Hand,
			command.InstanceID,
		) {
		return nil, fmt.Errorf(
			"%w: target effect is not available",
			ErrIllegalCommand,
		)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists || !targetableEffectCard(card) {
		return nil, fmt.Errorf(
			"%w: target effect source is not registered",
			ErrIllegalCommand,
		)
	}
	targetIndex := state.PlayerIndex(command.TargetPlayerID)
	if targetIndex < 0 ||
		command.TargetPlayerID == command.ActorID ||
		state.Players[targetIndex].Dead {
		return nil, fmt.Errorf(
			"%w: target player is not server-legal",
			ErrIllegalCommand,
		)
	}
	window := targetEffectWindow(
		state,
		command.InteractionID,
		command.InteractionAt,
		command.ActorID,
		command.InstanceID,
	)
	if window == nil {
		return nil, fmt.Errorf(
			"%w: target response window has no public responder set",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	next.Players[playerIndex].Hand, _ = removeString(
		next.Players[playerIndex].Hand,
		command.InstanceID,
	)
	next.Turn.Resolving = append(next.Turn.Resolving, command.InstanceID)
	next.Turn.TargetEffect = &TargetEffectState{
		ID: realizedTargetEffectID(
			command.InteractionID,
			command.ActorID,
			command.InstanceID,
		),
		InitiatorPlayerID: command.ActorID,
		TargetPlayerID:    command.TargetPlayerID,
		SourceInstanceID:  command.InstanceID,
		ParentPhase:       state.Turn.Phase,
	}
	next.InteractionWindow = window
	return transition(EventTargetEffectStarted, command, next, nil)
}

func handleCounterTargetEffect(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	target := state.Turn.TargetEffect
	if !profile.TargetAndRunAway ||
		window.Kind != InteractionKindTargetResponse ||
		target == nil ||
		target.Countered ||
		command.TargetEffectID != target.ID ||
		command.InteractionRevision != window.DeadlineRevision ||
		command.InteractionAt.IsZero() ||
		!command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: stale target counter",
			ErrIllegalCommand,
		)
	}
	if _, err := interactionResponseAt(window, command.ActorID); err != nil {
		return nil, err
	}
	playerIndex := state.PlayerIndex(command.ActorID)
	if playerIndex < 0 ||
		!slices.Contains(state.Players[playerIndex].Hand, command.InstanceID) {
		return nil, fmt.Errorf(
			"%w: target counter source is not actor-owned",
			ErrIllegalCommand,
		)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists ||
		card.CombatCapability == nil ||
		card.CombatCapability.Kind != CombatCapabilityCounter {
		return nil, fmt.Errorf(
			"%w: target counter source is not registered",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	next.Players[playerIndex].Hand, _ = removeString(
		next.Players[playerIndex].Hand,
		command.InstanceID,
	)
	if err := appendDiscard(&next, command.InstanceID, pack); err != nil {
		return nil, err
	}
	next.Turn.TargetEffect.Countered = true
	for _, actorID := range next.InteractionWindow.EligibleActorIDs {
		response := next.InteractionWindow.Responses[actorID]
		response.AcceptedAt = command.InteractionAt
		if actorID == command.ActorID {
			response.State = InteractionResponseActed
			response.Intent = InteractionIntentRespond
		} else if response.State == InteractionResponsePending {
			response.State = InteractionResponsePassed
			response.Intent = InteractionIntentPass
		}
		next.InteractionWindow.Responses[actorID] = response
	}
	return transition(EventTargetEffectCountered, command, next, nil)
}

func handleResolveTargetEffect(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window := state.InteractionWindow
	target := state.Turn.TargetEffect
	if !profile.TargetAndRunAway ||
		window == nil ||
		window.Status != InteractionWindowClosed ||
		window.Kind != InteractionKindTargetResponse ||
		target == nil ||
		window.Parent.SubjectID != target.SourceInstanceID {
		return nil, fmt.Errorf(
			"%w: target effect continuation is not available",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	if target.Countered {
		if err := discardResolvingInstance(
			&next,
			target.SourceInstanceID,
			pack,
		); err != nil {
			return nil, err
		}
		next.Turn.TargetEffect = nil
		setTurnPhase(&next, target.ParentPhase)
		return transition(EventTargetEffectResolved, command, next, nil)
	}
	card, _, exists := pack.DefinitionForInstance(
		next,
		target.SourceInstanceID,
	)
	if !exists || !targetableEffectCard(card) {
		return nil, fmt.Errorf(
			"%w: target effect source disappeared",
			ErrInvalidContent,
		)
	}
	targetIndex := next.PlayerIndex(target.TargetPlayerID)
	if targetIndex < 0 || next.Players[targetIndex].Dead {
		return nil, fmt.Errorf(
			"%w: target effect target disappeared",
			ErrIllegalCommand,
		)
	}
	var outcomes []RandomOutcome
	if err := beginEffectSequence(
		&next,
		targetIndex,
		target.SourceInstanceID,
		card.Effects,
		PendingFinalize{
			Phase:             target.ParentPhase,
			DiscardSource:     !effectsPersist(card.Effects),
			ClearTargetEffect: true,
			SourceInstanceID:  target.SourceInstanceID,
		},
		pack,
		&outcomes,
	); err != nil {
		return nil, err
	}
	return transition(EventTargetEffectResolved, command, next, outcomes)
}

func handlePlayRunAwayModifier(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	sequence, playerIndex, _, err := currentRunAwayStep(state)
	if err != nil {
		return nil, err
	}
	if !profile.TargetAndRunAway ||
		window.Kind != InteractionKindRunAwayResponse ||
		command.ActorID != sequence.ParticipantPlayerIDs[sequence.ParticipantIndex] ||
		command.InteractionRevision != window.DeadlineRevision ||
		command.InteractionAt.IsZero() ||
		!command.InteractionAt.Before(window.DeadlineAt) ||
		!slices.Contains(state.Players[playerIndex].Hand, command.InstanceID) {
		return nil, fmt.Errorf(
			"%w: stale Run Away modifier",
			ErrIllegalCommand,
		)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	effect, legal := runAwayModifierEffect(card)
	if !exists || !legal {
		return nil, fmt.Errorf(
			"%w: Run Away modifier is not registered",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	next.Players[playerIndex].Hand, _ = removeString(
		next.Players[playerIndex].Hand,
		command.InstanceID,
	)
	if err := appendDiscard(&next, command.InstanceID, pack); err != nil {
		return nil, err
	}
	next.Turn.RunAway.Effects = append(
		next.Turn.RunAway.Effects,
		RunAwayEffect{
			ID: realizedRunAwayEffectID(
				window.ID,
				command.ActorID,
				command.InstanceID,
				window.DeadlineRevision,
			),
			Kind:             RunAwayEffectModifier,
			ActorPlayerID:    command.ActorID,
			SourceInstanceID: command.InstanceID,
			Amount:           effect.Amount,
			Active:           true,
		},
	)
	if err := resetInteractionResponses(
		next.InteractionWindow,
		command.InteractionAt,
	); err != nil {
		return nil, err
	}
	return transition(EventRunAwayResponseApplied, command, next, nil)
}

func handleCounterRunAwayEffect(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window, err := requireInteractionWindow(state, command.InteractionID)
	if err != nil {
		return nil, err
	}
	sequence, _, _, err := currentRunAwayStep(state)
	if err != nil {
		return nil, err
	}
	targetIndex := slices.IndexFunc(
		sequence.Effects,
		func(effect RunAwayEffect) bool {
			return effect.ID == command.TargetEffectID &&
				effect.Kind == RunAwayEffectModifier &&
				effect.Active
		},
	)
	if !profile.TargetAndRunAway ||
		window.Kind != InteractionKindRunAwayResponse ||
		targetIndex < 0 ||
		command.InteractionRevision != window.DeadlineRevision ||
		command.InteractionAt.IsZero() ||
		!command.InteractionAt.Before(window.DeadlineAt) {
		return nil, fmt.Errorf(
			"%w: stale Run Away counter",
			ErrIllegalCommand,
		)
	}
	if _, err := interactionResponseAt(window, command.ActorID); err != nil {
		return nil, err
	}
	playerIndex := state.PlayerIndex(command.ActorID)
	if playerIndex < 0 ||
		!slices.Contains(state.Players[playerIndex].Hand, command.InstanceID) {
		return nil, fmt.Errorf(
			"%w: Run Away counter source is not actor-owned",
			ErrIllegalCommand,
		)
	}
	card, _, exists := pack.DefinitionForInstance(state, command.InstanceID)
	if !exists ||
		card.CombatCapability == nil ||
		card.CombatCapability.Kind != CombatCapabilityCounter {
		return nil, fmt.Errorf(
			"%w: Run Away counter source is not registered",
			ErrIllegalCommand,
		)
	}
	next := state.Clone()
	next.Players[playerIndex].Hand, _ = removeString(
		next.Players[playerIndex].Hand,
		command.InstanceID,
	)
	if err := appendDiscard(&next, command.InstanceID, pack); err != nil {
		return nil, err
	}
	next.Turn.RunAway.Effects[targetIndex].Active = false
	next.Turn.RunAway.Effects = append(
		next.Turn.RunAway.Effects,
		RunAwayEffect{
			ID: realizedRunAwayEffectID(
				window.ID,
				command.ActorID,
				command.InstanceID,
				window.DeadlineRevision,
			),
			Kind:             RunAwayEffectCounter,
			ActorPlayerID:    command.ActorID,
			SourceInstanceID: command.InstanceID,
			TargetEffectID:   command.TargetEffectID,
			Active:           true,
		},
	)
	if err := resetInteractionResponses(
		next.InteractionWindow,
		command.InteractionAt,
	); err != nil {
		return nil, err
	}
	return transition(EventRunAwayResponseApplied, command, next, nil)
}

func handleResolveRunAwayStep(
	state State,
	command Command,
	pack Pack,
) ([]DomainEvent, error) {
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	window := state.InteractionWindow
	sequence, playerIndex, monsterInstanceID, err := currentRunAwayStep(state)
	if err != nil {
		return nil, err
	}
	if !profile.TargetAndRunAway ||
		window == nil ||
		window.Status != InteractionWindowClosed ||
		window.Kind != InteractionKindRunAwayResponse ||
		state.Turn.Phase != PhaseRunAway ||
		window.Parent.SubjectID != monsterInstanceID {
		return nil, fmt.Errorf(
			"%w: Run Away continuation is not available",
			ErrIllegalCommand,
		)
	}
	monsterCard, _, exists := pack.DefinitionForInstance(
		state,
		monsterInstanceID,
	)
	if !exists || monsterCard.Monster == nil {
		return nil, fmt.Errorf(
			"%w: Run Away monster is invalid",
			ErrInvalidContent,
		)
	}
	next := state.Clone()
	tags, err := characterTags(next, next.Players[playerIndex], pack)
	if err != nil {
		return nil, err
	}
	modifier := 0
	for _, effect := range sequence.Effects {
		if effect.Kind == RunAwayEffectModifier && effect.Active {
			modifier += effect.Amount
		}
	}
	bonus, err := escapeBonus(next, playerIndex, pack)
	if err != nil {
		return nil, err
	}
	automatic := next.Players[playerIndex].Level <=
		monsterCard.Monster.PursuitMinLevel ||
		containsAny(tags, monsterCard.Monster.AutoEscapeCharacterTags)
	attempt := RunAwayAttempt{
		PlayerID:          next.Players[playerIndex].ID,
		MonsterInstanceID: monsterInstanceID,
		Modifier:          bonus + modifier,
		Automatic:         automatic,
	}
	var outcomes []RandomOutcome
	if automatic {
		attempt.Escaped = true
	} else {
		roll, rngState := rollD6(next.RNGState)
		next.RNGState = rngState
		attempt.Roll = roll
		attempt.Total = roll + attempt.Modifier
		attempt.Escaped = attempt.Total >= profile.RunAwayTarget
		outcomes = append(outcomes, RandomOutcome{
			Kind: "d6",
			Roll: roll,
		})
	}
	attempt.BadStuffApplied = !attempt.Escaped
	next.Turn.RunAway.Attempts = append(
		next.Turn.RunAway.Attempts,
		attempt,
	)
	if attempt.Escaped {
		if err := advanceRunAwaySequence(&next, pack); err != nil {
			return nil, err
		}
	} else if err := beginEffectSequence(
		&next,
		playerIndex,
		monsterInstanceID,
		monsterCard.Monster.BadStuff,
		PendingFinalize{
			ContinueRunAway:  true,
			SourceInstanceID: monsterInstanceID,
		},
		pack,
		&outcomes,
	); err != nil {
		return nil, err
	}
	return transition(EventRunAwayStepResolved, command, next, outcomes)
}

func handleRunAway(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseRunAway)
	if err != nil {
		return nil, err
	}
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	if profile.TargetAndRunAway {
		return nil, fmt.Errorf(
			"%w: Run Away is resolved through the durable response step",
			ErrIllegalCommand,
		)
	}
	if state.Turn.Encounter == nil || !state.Turn.Encounter.CombatClosed {
		return nil, fmt.Errorf("%w: losing combat was not resolved", ErrIllegalCommand)
	}
	totals, err := combatTotals(state, playerIndex, pack)
	if err != nil {
		return nil, err
	}
	if totals.PlayerWins {
		return nil, fmt.Errorf("%w: winning player cannot run away", ErrIllegalCommand)
	}
	next := state.Clone()
	monsterCard, _, exists := pack.DefinitionForInstance(
		next,
		next.Turn.Encounter.MonsterInstanceID,
	)
	if !exists || monsterCard.Monster == nil {
		return nil, fmt.Errorf("%w: invalid monster", ErrInvalidContent)
	}
	roll, rngState := rollD6(next.RNGState)
	next.RNGState = rngState
	outcomes := []RandomOutcome{{Kind: "d6", Roll: roll}}
	bonus, err := escapeBonus(next, playerIndex, pack)
	if err != nil {
		return nil, err
	}
	if roll+bonus >= profile.RunAwayTarget {
		if err := discardEncounterSet(&next, pack); err != nil {
			return nil, err
		}
		setTurnPhase(&next, PhaseCharity)
		return transition(EventRunAwayResolved, command, next, outcomes)
	}
	if err := beginEffectSequence(
		&next,
		playerIndex,
		"",
		monsterCard.Monster.BadStuff,
		PendingFinalize{
			Phase:          PhaseCharity,
			ClearEncounter: true,
		},
		pack,
		&outcomes,
	); err != nil {
		return nil, err
	}
	return transition(EventRunAwayResolved, command, next, outcomes)
}

func handleChooseEffect(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex := state.PlayerIndex(command.ActorID)
	if playerIndex < 0 {
		return nil, fmt.Errorf("%w: effect actor is not a player", ErrIllegalCommand)
	}
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	privateChoice := profile.TargetAndRunAway &&
		state.Turn.Pending != nil &&
		state.Turn.Pending.ActorID == command.ActorID &&
		state.InteractionWindow != nil &&
		state.InteractionWindow.Status == InteractionWindowClosed &&
		state.InteractionWindow.Kind == InteractionKindPrivateChoice
	if command.ActorID != state.Turn.PlayerID && !privateChoice {
		return nil, fmt.Errorf("%w: actor does not own effect choice", ErrIllegalCommand)
	}
	if state.Turn.Phase != PhaseResolveEffect {
		return nil, fmt.Errorf("%w: no effect choice is pending", ErrIllegalCommand)
	}
	next := state.Clone()
	var outcomes []RandomOutcome
	selected := command.ChoiceIDs
	if len(selected) == 0 {
		selected = command.InstanceIDs
	}
	if err := resolvePendingEffect(
		&next,
		playerIndex,
		selected,
		pack,
		&outcomes,
	); err != nil {
		return nil, err
	}
	return transition(EventEffectResolved, command, next, outcomes)
}

func handleResolveCharity(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseCharity)
	if err != nil {
		return nil, err
	}
	limit, err := handLimit(state, playerIndex, pack)
	if err != nil {
		return nil, err
	}
	excess := max(0, len(state.Players[playerIndex].Hand)-limit)
	selected := command.InstanceIDs
	if len(selected) != excess || !uniqueStrings(selected) && len(selected) > 0 {
		return nil, fmt.Errorf(
			"%w: charity requires exactly %d cards",
			ErrIllegalCommand,
			excess,
		)
	}
	for _, instanceID := range selected {
		if !slices.Contains(state.Players[playerIndex].Hand, instanceID) {
			return nil, fmt.Errorf("%w: charity card is not in hand", ErrIllegalCommand)
		}
	}
	next := state.Clone()
	for _, instanceID := range selected {
		if err := discardOwnedInstance(&next, playerIndex, instanceID, pack); err != nil {
			return nil, err
		}
	}
	setTurnPhase(&next, PhaseEndTurn)
	return transition(EventCharityResolved, command, next, nil)
}

func handleEndTurn(state State, command Command, pack Pack) ([]DomainEvent, error) {
	playerIndex, err := requirePhase(state, command, PhaseEndTurn)
	if err != nil {
		return nil, err
	}
	next := state.Clone()
	nextPlayerIndex := (playerIndex + 1) % len(next.Players)
	next.Turn = Turn{PlayerID: next.Players[nextPlayerIndex].ID}
	var outcomes []RandomOutcome
	if next.Players[nextPlayerIndex].NeedsRedraw {
		profile, err := next.Profile()
		if err != nil {
			return nil, err
		}
		doors, err := next.takeCards(
			DeckDoor,
			profile.InitialDoorCards,
			&outcomes,
		)
		if err != nil {
			return nil, err
		}
		treasures, err := next.takeCards(
			DeckTreasure,
			profile.InitialTreasureCards,
			&outcomes,
		)
		if err != nil {
			return nil, err
		}
		next.Players[nextPlayerIndex].Hand = append(doors, treasures...)
		next.Players[nextPlayerIndex].NeedsRedraw = false
		next.Players[nextPlayerIndex].Dead = false
	}
	setTurnPhase(&next, PhasePreparation)
	return transition(EventTurnAdvanced, command, next, outcomes)
}

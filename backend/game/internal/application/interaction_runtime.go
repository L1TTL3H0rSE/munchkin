package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/game"
)

const defaultInteractionSweepBatch = 100

type InteractionParticipant struct {
	ActorID       string
	Requirement   game.InteractionResponseRequirement
	TimeoutIntent game.InteractionIntent
}

type InteractionOpenSpec struct {
	Kind              game.InteractionKind
	Parent            game.InteractionParent
	InitiatorActorID  string
	EligibilityPolicy game.InteractionEligibilityPolicy
	AllowedIntents    []game.InteractionIntent
	Participants      []InteractionParticipant
	DeadlinePolicy    game.InteractionDeadlinePolicy
}

func (service *Service) OpenInteraction(
	ctx context.Context,
	gameID string,
	commandID string,
	expectedVersion uint64,
	spec InteractionOpenSpec,
) (string, error) {
	if strings.TrimSpace(gameID) == "" || strings.TrimSpace(commandID) == "" {
		return "", game.ErrIllegalCommand
	}
	var interactionID string
	var publish *Invalidation
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		if state.Version != expectedVersion {
			return ErrVersionConflict
		}
		openedAt := time.Unix(0, service.clock.Now()).UTC()
		generatedID, err := service.randomID("interaction")
		if err != nil {
			return err
		}
		window, err := interactionWindowFromSpec(generatedID, openedAt, spec)
		if err != nil {
			return err
		}
		events, err := game.Handle(state, game.Command{
			Type:              game.CommandOpenInteractionWindow,
			ActorID:           spec.InitiatorActorID,
			InteractionWindow: window,
		}, service.pack)
		if err != nil {
			return err
		}
		envelopes, next, err := service.applyAt(
			state,
			commandID,
			events,
			openedAt,
		)
		if err != nil {
			return err
		}
		if err := tx.Save(state.Version, next, envelopes, nil); err != nil {
			return err
		}
		interactionID = generatedID
		publish = interactionInvalidation(gameID, next.Version, openedAt)
		return nil
	})
	if err != nil {
		return "", err
	}
	if publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	return interactionID, nil
}

func (service *Service) RequestCombatResolution(
	ctx context.Context,
	gameID string,
	credential string,
	commandID string,
	expectedVersion uint64,
) (CommandResult, error) {
	gameID = strings.TrimSpace(gameID)
	commandID = strings.TrimSpace(commandID)
	if gameID == "" || credential == "" || commandID == "" {
		return CommandResult{}, ErrUnauthorized
	}
	fingerprint := commandFingerprint(
		game.Command{Type: game.CommandRequestCombatResolution},
		expectedVersion,
	)
	tokenHash := hashCredential(credential)
	var result CommandResult
	var publish *Invalidation
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		actorID, exists := state.ActorByCredentialHash(tokenHash)
		if !exists {
			return ErrUnauthorized
		}
		if receipt, exists := tx.FindReceipt(actorID, commandID); exists {
			if receipt.Fingerprint != fingerprint {
				return ErrIdempotencyConflict
			}
			var projection game.Projection
			if err := json.Unmarshal(receipt.Projection, &projection); err != nil {
				return err
			}
			result = CommandResult{
				GameID:     gameID,
				CommandID:  commandID,
				Version:    receipt.Version,
				Replayed:   true,
				Projection: projection,
			}
			return nil
		}
		if state.Version != expectedVersion {
			return ErrVersionConflict
		}
		acceptedAt := time.Unix(0, service.clock.Now()).UTC()
		interactionID, err := service.randomID("interaction")
		if err != nil {
			return err
		}
		events, err := game.Handle(state, game.Command{
			Type:          game.CommandRequestCombatResolution,
			ActorID:       actorID,
			InteractionID: interactionID,
			InteractionAt: acceptedAt,
		}, service.pack)
		if err != nil {
			return err
		}
		events, err = service.appendFollowupInteraction(
			state,
			events,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		envelopes, next, err := service.applyAt(
			state,
			commandID,
			events,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		projection, err := service.projectForActor(next, actorID, acceptedAt)
		if err != nil {
			return err
		}
		rawProjection, err := json.Marshal(projection)
		if err != nil {
			return err
		}
		receipt := Receipt{
			ActorID:     actorID,
			CommandID:   commandID,
			Fingerprint: fingerprint,
			Version:     next.Version,
			Projection:  rawProjection,
		}
		if err := tx.Save(state.Version, next, envelopes, &receipt); err != nil {
			return err
		}
		result = CommandResult{
			GameID:     gameID,
			CommandID:  commandID,
			Version:    next.Version,
			Projection: projection,
		}
		publish = interactionInvalidation(gameID, next.Version, acceptedAt)
		return nil
	})
	if err != nil {
		return CommandResult{}, err
	}
	if publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	return result, nil
}

func (service *Service) PlayTargetEffect(
	ctx context.Context,
	gameID string,
	credential string,
	commandID string,
	expectedVersion uint64,
	sourceInstanceID string,
	targetPlayerID string,
) (CommandResult, error) {
	gameID = strings.TrimSpace(gameID)
	commandID = strings.TrimSpace(commandID)
	sourceInstanceID = strings.TrimSpace(sourceInstanceID)
	targetPlayerID = strings.TrimSpace(targetPlayerID)
	if gameID == "" || credential == "" || commandID == "" {
		return CommandResult{}, ErrUnauthorized
	}
	if sourceInstanceID == "" || targetPlayerID == "" {
		return CommandResult{}, ErrInteractionAction
	}
	tokenHash := hashCredential(credential)
	fingerprint := targetEffectFingerprint(
		expectedVersion,
		sourceInstanceID,
		targetPlayerID,
	)
	var result CommandResult
	var publish *Invalidation
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		actorID, exists := state.ActorByCredentialHash(tokenHash)
		if !exists {
			return ErrUnauthorized
		}
		if receipt, exists := tx.FindReceipt(actorID, commandID); exists {
			if receipt.Fingerprint != fingerprint {
				return ErrIdempotencyConflict
			}
			var projection game.Projection
			if err := json.Unmarshal(
				receipt.Projection,
				&projection,
			); err != nil {
				return err
			}
			result = CommandResult{
				GameID:     gameID,
				CommandID:  commandID,
				Version:    receipt.Version,
				Replayed:   true,
				Projection: projection,
			}
			return nil
		}
		if state.Version != expectedVersion {
			return ErrVersionConflict
		}
		acceptedAt := time.Unix(0, service.clock.Now()).UTC()
		interactionID, err := service.randomID("interaction")
		if err != nil {
			return err
		}
		events, err := game.Handle(
			state,
			game.Command{
				Type:           game.CommandPlayTargetEffect,
				ActorID:        actorID,
				InstanceID:     sourceInstanceID,
				TargetPlayerID: targetPlayerID,
				InteractionID:  interactionID,
				InteractionAt:  acceptedAt,
			},
			service.pack,
		)
		if err != nil {
			return err
		}
		envelopes, next, err := service.applyAt(
			state,
			commandID,
			events,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		projection, err := service.projectForActor(
			next,
			actorID,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		rawProjection, err := json.Marshal(projection)
		if err != nil {
			return err
		}
		receipt := Receipt{
			ActorID:     actorID,
			CommandID:   commandID,
			Fingerprint: fingerprint,
			Version:     next.Version,
			Projection:  rawProjection,
		}
		if err := tx.Save(
			state.Version,
			next,
			envelopes,
			&receipt,
		); err != nil {
			return err
		}
		result = CommandResult{
			GameID:     gameID,
			CommandID:  commandID,
			Version:    next.Version,
			Projection: projection,
		}
		publish = interactionInvalidation(
			gameID,
			next.Version,
			acceptedAt,
		)
		return nil
	})
	if err != nil {
		return CommandResult{}, err
	}
	if publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	return result, nil
}

func (service *Service) ExecuteInteraction(
	ctx context.Context,
	gameID string,
	credential string,
	commandID string,
	expectedVersion uint64,
	interactionID string,
	actionID string,
	intent game.InteractionIntent,
) (CommandResult, error) {
	gameID = strings.TrimSpace(gameID)
	commandID = strings.TrimSpace(commandID)
	interactionID = strings.TrimSpace(interactionID)
	actionID = strings.TrimSpace(actionID)
	if gameID == "" || credential == "" || commandID == "" {
		return CommandResult{}, ErrUnauthorized
	}
	if interactionID == "" ||
		actionID == "" ||
		!playerInteractionIntent(intent) {
		return CommandResult{}, ErrInteractionAction
	}
	tokenHash := hashCredential(credential)
	fingerprint := interactionFingerprint(
		expectedVersion,
		interactionID,
		actionID,
		intent,
	)
	var result CommandResult
	var publish *Invalidation
	var committedError error
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		actorID, exists := state.ActorByCredentialHash(tokenHash)
		if !exists {
			return ErrUnauthorized
		}
		if receipt, exists := tx.FindReceipt(actorID, commandID); exists {
			if receipt.Fingerprint != fingerprint {
				return ErrIdempotencyConflict
			}
			var projection game.Projection
			if err := json.Unmarshal(receipt.Projection, &projection); err != nil {
				return err
			}
			result = CommandResult{
				GameID:     gameID,
				CommandID:  commandID,
				Version:    receipt.Version,
				Replayed:   true,
				Projection: projection,
			}
			return nil
		}
		if state.Version != expectedVersion {
			return ErrVersionConflict
		}
		window := state.InteractionWindow
		if window == nil || window.Status != game.InteractionWindowOpen {
			return ErrInteractionClosed
		}
		if window.ID != interactionID {
			return ErrInteractionAction
		}
		projected, err := game.ProjectForActor(state, actorID, service.pack)
		if err != nil {
			return err
		}
		action, available := projectedInteractionAction(
			projected,
			interactionID,
			actionID,
			intent,
		)
		if !available {
			return ErrInteractionAction
		}
		acceptedAt := time.Unix(0, service.clock.Now()).UTC()
		if !acceptedAt.Before(window.DeadlineAt) {
			next, invalidation, processed, err := service.timeoutInTransaction(
				tx,
				state,
				window.ID,
				window.DeadlineRevision,
				acceptedAt,
			)
			if err != nil {
				return err
			}
			if processed {
				publish = invalidation
				result.Version = next.Version
			}
			committedError = ErrInteractionExpired
			return nil
		}
		commandType := game.CommandRespondInteraction
		if intent == game.InteractionIntentPass {
			commandType = game.CommandPassInteraction
		}
		command := game.Command{
			Type:                commandType,
			ActorID:             actorID,
			InteractionID:       interactionID,
			InteractionIntent:   intent,
			InteractionAt:       acceptedAt,
			InteractionRevision: action.Revision,
			ChoiceIDs:           append([]string(nil), action.ChoiceIDs...),
		}
		if intent == game.InteractionIntentRespond &&
			action.SourceInstanceID != "" {
			command.InstanceID = action.SourceInstanceID
			switch window.Kind {
			case game.InteractionKindTargetResponse:
				command.Type = game.CommandCounterTargetEffect
				command.TargetEffectID = action.TargetEffectID
			case game.InteractionKindRunAwayResponse:
				if action.EscapeDelta != 0 {
					command.Type = game.CommandPlayRunAwayModifier
				} else {
					command.Type = game.CommandCounterRunAwayEffect
					command.TargetEffectID = action.TargetEffectID
				}
			case game.InteractionKindCombatResponse:
				if action.CombatCapability != "" {
					command.Type = game.CommandPlayAdvancedCombatEffect
					command.TargetInstanceID =
						action.TargetMonsterInstanceID
					command.TargetEffectID = action.TargetEffectID
					command.HelperPlayerID = action.HelperPlayerID
				} else {
					command.Type = game.CommandPlayCombatIntervention
					command.TargetInstanceID = string(action.Target)
				}
			default:
				return ErrInteractionAction
			}
		} else if intent == game.InteractionIntentRespond &&
			(window.Kind == game.InteractionKindTargetResponse ||
				window.Kind == game.InteractionKindRunAwayResponse) {
			return ErrInteractionAction
		}
		combatHelpResponse := state.CombatHelpOffer != nil &&
			state.SuspendedInteractionWindow != nil &&
			state.CombatHelpOffer.ID == interactionID
		if combatHelpResponse &&
			(intent == game.InteractionIntentAccept ||
				intent == game.InteractionIntentDecline) {
			command.Type = game.CommandRespondCombatHelp
		}
		events, err := game.Handle(state, command, service.pack)
		if err != nil {
			return err
		}
		if !combatHelpResponse {
			events, err = appendInteractionClose(
				state,
				events,
				command,
				service.pack,
			)
			if err != nil {
				return err
			}
		}
		if window.Kind == game.InteractionKindPrivateChoice &&
			intent == game.InteractionIntentRespond {
			intermediate, err := applyDomainEvents(
				state,
				events,
			)
			if err != nil {
				return err
			}
			choiceEvents, err := game.Handle(
				intermediate,
				game.Command{
					Type:      game.CommandChooseEffect,
					ActorID:   actorID,
					ChoiceIDs: append([]string(nil), action.ChoiceIDs...),
				},
				service.pack,
			)
			if err != nil {
				return err
			}
			events = append(events, choiceEvents...)
		}
		events, err = service.appendFollowupInteraction(
			state,
			events,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		envelopes, next, err := service.applyAt(
			state,
			commandID,
			events,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		projection, err := service.projectForActor(next, actorID, acceptedAt)
		if err != nil {
			return err
		}
		rawProjection, err := json.Marshal(projection)
		if err != nil {
			return err
		}
		receipt := Receipt{
			ActorID:     actorID,
			CommandID:   commandID,
			Fingerprint: fingerprint,
			Version:     next.Version,
			Projection:  rawProjection,
		}
		if err := tx.Save(state.Version, next, envelopes, &receipt); err != nil {
			return err
		}
		result = CommandResult{
			GameID:     gameID,
			CommandID:  commandID,
			Version:    next.Version,
			Projection: projection,
		}
		publish = interactionInvalidation(gameID, next.Version, acceptedAt)
		return nil
	})
	if err != nil {
		return CommandResult{}, err
	}
	if publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	if committedError != nil {
		return CommandResult{}, committedError
	}
	return result, nil
}

func (service *Service) ExecuteCombatHelpAction(
	ctx context.Context,
	gameID string,
	credential string,
	commandID string,
	expectedVersion uint64,
	actionID string,
) (CommandResult, error) {
	gameID = strings.TrimSpace(gameID)
	commandID = strings.TrimSpace(commandID)
	actionID = strings.TrimSpace(actionID)
	if gameID == "" || credential == "" || commandID == "" {
		return CommandResult{}, ErrUnauthorized
	}
	if actionID == "" {
		return CommandResult{}, ErrInteractionAction
	}
	tokenHash := hashCredential(credential)
	fingerprint := combatHelpFingerprint(expectedVersion, actionID)
	var result CommandResult
	var publish *Invalidation
	var committedError error
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		actorID, exists := state.ActorByCredentialHash(tokenHash)
		if !exists {
			return ErrUnauthorized
		}
		if receipt, exists := tx.FindReceipt(actorID, commandID); exists {
			if receipt.Fingerprint != fingerprint {
				return ErrIdempotencyConflict
			}
			var projection game.Projection
			if err := json.Unmarshal(receipt.Projection, &projection); err != nil {
				return err
			}
			result = CommandResult{
				GameID:     gameID,
				CommandID:  commandID,
				Version:    receipt.Version,
				Replayed:   true,
				Projection: projection,
			}
			return nil
		}
		if state.Version != expectedVersion {
			return ErrVersionConflict
		}
		projected, err := game.ProjectForActor(state, actorID, service.pack)
		if err != nil {
			return err
		}
		action, available := projectedCombatHelpAction(projected, actionID)
		if !available {
			return ErrInteractionAction
		}
		window := state.InteractionWindow
		if window == nil ||
			window.Status != game.InteractionWindowOpen ||
			window.ID != action.InteractionID {
			return ErrInteractionClosed
		}
		acceptedAt := time.Unix(0, service.clock.Now()).UTC()
		if !acceptedAt.Before(window.DeadlineAt) {
			next, invalidation, processed, err := service.timeoutInTransaction(
				tx,
				state,
				window.ID,
				window.DeadlineRevision,
				acceptedAt,
			)
			if err != nil {
				return err
			}
			if processed {
				publish = invalidation
				result.Version = next.Version
			}
			committedError = ErrInteractionExpired
			return nil
		}
		command := game.Command{
			ActorID:             actorID,
			InteractionID:       action.InteractionID,
			InteractionAt:       acceptedAt,
			InteractionRevision: action.Revision,
		}
		switch action.Type {
		case game.InteractionIntentOfferHelp:
			childID, err := service.randomID("interaction")
			if err != nil {
				return err
			}
			command.Type = game.CommandOfferCombatHelp
			command.ChildInteractionID = childID
			command.HelperPlayerID = action.HelperPlayerID
			command.RewardTreasures = action.RewardTreasures
		case game.InteractionIntentCancelHelp:
			command.Type = game.CommandCancelCombatHelp
		default:
			return ErrInteractionAction
		}
		events, err := game.Handle(state, command, service.pack)
		if err != nil {
			return err
		}
		envelopes, next, err := service.applyAt(
			state,
			commandID,
			events,
			acceptedAt,
		)
		if err != nil {
			return err
		}
		projection, err := service.projectForActor(next, actorID, acceptedAt)
		if err != nil {
			return err
		}
		rawProjection, err := json.Marshal(projection)
		if err != nil {
			return err
		}
		receipt := Receipt{
			ActorID:     actorID,
			CommandID:   commandID,
			Fingerprint: fingerprint,
			Version:     next.Version,
			Projection:  rawProjection,
		}
		if err := tx.Save(state.Version, next, envelopes, &receipt); err != nil {
			return err
		}
		result = CommandResult{
			GameID:     gameID,
			CommandID:  commandID,
			Version:    next.Version,
			Projection: projection,
		}
		publish = interactionInvalidation(gameID, next.Version, acceptedAt)
		return nil
	})
	if err != nil {
		return CommandResult{}, err
	}
	if publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	if committedError != nil {
		return CommandResult{}, committedError
	}
	return result, nil
}

func (service *Service) ProcessInteractionTimeout(
	ctx context.Context,
	candidate InteractionDeadline,
) (bool, error) {
	var publish *Invalidation
	processed := false
	err := service.store.WithinGame(ctx, candidate.GameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		window := state.InteractionWindow
		if window == nil ||
			window.Status != game.InteractionWindowOpen ||
			window.ID != candidate.InteractionID ||
			window.DeadlineRevision != candidate.DeadlineRevision {
			return nil
		}
		observedAt := time.Unix(0, service.clock.Now()).UTC()
		if observedAt.Before(window.DeadlineAt) {
			return nil
		}
		_, invalidation, committed, err := service.timeoutInTransaction(
			tx,
			state,
			window.ID,
			window.DeadlineRevision,
			observedAt,
		)
		if err != nil {
			return err
		}
		processed = committed
		publish = invalidation
		return nil
	})
	if errors.Is(err, ErrNotFound) || errors.Is(err, ErrVersionConflict) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	return processed, nil
}

func (service *Service) SweepDueInteractions(
	ctx context.Context,
	limit int,
) (int, error) {
	if limit <= 0 {
		limit = defaultInteractionSweepBatch
	}
	scanAt := time.Unix(0, service.clock.Now()).UTC()
	candidates, err := service.store.DueInteractions(ctx, scanAt, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	for _, candidate := range candidates {
		committed, err := service.ProcessInteractionTimeout(ctx, candidate)
		if err != nil {
			return processed, err
		}
		if committed {
			processed++
		}
	}
	return processed, nil
}

func (service *Service) RunInteractionTimeoutWorker(
	ctx context.Context,
	interval time.Duration,
	limit int,
	onError func(error),
) error {
	if interval <= 0 {
		return fmt.Errorf("interaction sweep interval must be positive")
	}
	sweep := func() {
		if _, err := service.SweepDueInteractions(ctx, limit); err != nil &&
			ctx.Err() == nil &&
			onError != nil {
			onError(err)
		}
	}
	sweep()
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			sweep()
		}
	}
}

func (service *Service) timeoutInTransaction(
	tx Tx,
	state game.State,
	interactionID string,
	revision uint32,
	observedAt time.Time,
) (game.State, *Invalidation, bool, error) {
	commandID := fmt.Sprintf("timeout:%s:%d", interactionID, revision)
	events, err := game.Handle(state, game.Command{
		Type:                game.CommandTimeoutInteraction,
		InteractionID:       interactionID,
		InteractionAt:       observedAt,
		InteractionRevision: revision,
	}, service.pack)
	if err != nil {
		return game.State{}, nil, false, err
	}
	events, err = service.appendFollowupInteraction(
		state,
		events,
		observedAt,
	)
	if err != nil {
		return game.State{}, nil, false, err
	}
	envelopes, next, err := service.applyAt(
		state,
		commandID,
		events,
		observedAt,
	)
	if err != nil {
		return game.State{}, nil, false, err
	}
	if err := tx.Save(state.Version, next, envelopes, nil); err != nil {
		return game.State{}, nil, false, err
	}
	return next, interactionInvalidation(state.GameID, next.Version, observedAt), true, nil
}

func (service *Service) appendFollowupInteraction(
	state game.State,
	events []game.DomainEvent,
	openedAt time.Time,
) ([]game.DomainEvent, error) {
	next, err := applyDomainEvents(state, events)
	if err != nil {
		return nil, err
	}
	if next.InteractionWindow != nil &&
		next.InteractionWindow.Status == game.InteractionWindowOpen {
		return events, nil
	}
	profile, err := next.Profile()
	if err != nil {
		return nil, err
	}
	if !profile.TargetAndRunAway {
		return events, nil
	}
	if next.InteractionWindow != nil &&
		next.InteractionWindow.Status == game.InteractionWindowClosed &&
		next.InteractionWindow.Kind == game.InteractionKindPrivateChoice &&
		next.Turn.Pending != nil {
		decision := next.Turn.Pending
		if decision.Minimum < 0 ||
			decision.Minimum > len(decision.Options) {
			return nil, game.ErrIllegalCommand
		}
		selected := append(
			[]string(nil),
			decision.Options[:decision.Minimum]...,
		)
		defaultEvents, err := game.Handle(
			next,
			game.Command{
				Type:      game.CommandChooseEffect,
				ActorID:   decision.ActorID,
				ChoiceIDs: selected,
			},
			service.pack,
		)
		if err != nil {
			return nil, err
		}
		events = append(events, defaultEvents...)
		next, err = applyDomainEvents(next, defaultEvents)
		if err != nil {
			return nil, err
		}
	}
	var spec InteractionOpenSpec
	switch {
	case next.Turn.Pending != nil:
		decision := next.Turn.Pending
		spec = InteractionOpenSpec{
			Kind: game.InteractionKindPrivateChoice,
			Parent: game.InteractionParent{
				Phase:       next.Turn.Phase,
				SubjectKind: game.InteractionSubjectTurn,
				SubjectID:   next.Turn.PlayerID,
			},
			InitiatorActorID:  decision.ActorID,
			EligibilityPolicy: game.InteractionEligibilityActorPrivate,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentRespond,
				game.InteractionIntentAutoResolve,
			},
			Participants: []InteractionParticipant{{
				ActorID:       decision.ActorID,
				Requirement:   game.InteractionResponseMandatory,
				TimeoutIntent: game.InteractionIntentAutoResolve,
			}},
			DeadlinePolicy: game.AddressedInteractionDeadlinePolicy(),
		}
	case next.Turn.Phase == game.PhaseRunAway &&
		next.Turn.RunAway != nil &&
		!next.Turn.RunAway.Completed:
		sequence := next.Turn.RunAway
		currentPlayerID := sequence.ParticipantPlayerIDs[sequence.ParticipantIndex]
		currentMonsterID := sequence.MonsterInstanceIDs[sequence.MonsterIndex]
		participants := make(
			[]InteractionParticipant,
			0,
			len(next.Players),
		)
		for _, player := range next.Players {
			if player.Dead {
				continue
			}
			participants = append(participants, InteractionParticipant{
				ActorID:       player.ID,
				Requirement:   game.InteractionResponseOptional,
				TimeoutIntent: game.InteractionIntentPass,
			})
		}
		spec = InteractionOpenSpec{
			Kind: game.InteractionKindRunAwayResponse,
			Parent: game.InteractionParent{
				Phase:       game.PhaseRunAway,
				SubjectKind: game.InteractionSubjectEncounter,
				SubjectID:   currentMonsterID,
			},
			InitiatorActorID:  currentPlayerID,
			EligibilityPolicy: game.InteractionEligibilityOpaquePublicSet,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentPass,
				game.InteractionIntentRespond,
			},
			Participants:   participants,
			DeadlinePolicy: game.AddressedInteractionDeadlinePolicy(),
		}
	default:
		return events, nil
	}
	interactionID, err := service.randomID("interaction")
	if err != nil {
		return nil, err
	}
	window, err := interactionWindowFromSpec(
		interactionID,
		openedAt,
		spec,
	)
	if err != nil {
		return nil, err
	}
	openEvents, err := game.Handle(
		next,
		game.Command{
			Type:              game.CommandOpenInteractionWindow,
			ActorID:           spec.InitiatorActorID,
			InteractionWindow: window,
		},
		service.pack,
	)
	if err != nil {
		return nil, err
	}
	return append(events, openEvents...), nil
}

func applyDomainEvents(
	state game.State,
	events []game.DomainEvent,
) (game.State, error) {
	next := state
	var err error
	for _, event := range events {
		next, err = game.Apply(next, event)
		if err != nil {
			return game.State{}, err
		}
	}
	return next, nil
}

func interactionWindowFromSpec(
	interactionID string,
	openedAt time.Time,
	spec InteractionOpenSpec,
) (*game.InteractionWindow, error) {
	if interactionID == "" ||
		openedAt.IsZero() ||
		spec.InitiatorActorID == "" ||
		len(spec.Participants) == 0 ||
		spec.DeadlinePolicy.BaseSeconds <= 0 ||
		spec.DeadlinePolicy.MaxSeconds < spec.DeadlinePolicy.BaseSeconds {
		return nil, game.ErrIllegalCommand
	}
	responses := make(map[string]game.InteractionResponse, len(spec.Participants))
	eligibleActorIDs := make([]string, 0, len(spec.Participants))
	for _, participant := range spec.Participants {
		actorID := strings.TrimSpace(participant.ActorID)
		if actorID == "" {
			return nil, game.ErrIllegalCommand
		}
		if _, exists := responses[actorID]; exists {
			return nil, game.ErrIllegalCommand
		}
		responses[actorID] = game.InteractionResponse{
			Requirement:   participant.Requirement,
			TimeoutIntent: participant.TimeoutIntent,
			State:         game.InteractionResponsePending,
		}
		eligibleActorIDs = append(eligibleActorIDs, actorID)
	}
	return &game.InteractionWindow{
		ID:                     interactionID,
		Kind:                   spec.Kind,
		Parent:                 spec.Parent,
		InitiatorActorID:       spec.InitiatorActorID,
		EligibilityPolicy:      spec.EligibilityPolicy,
		AllowedIntents:         append([]game.InteractionIntent(nil), spec.AllowedIntents...),
		EligibleActorIDs:       eligibleActorIDs,
		OpenedAt:               openedAt,
		DeadlineAt:             openedAt.Add(time.Duration(spec.DeadlinePolicy.BaseSeconds) * time.Second),
		DeadlineRevision:       1,
		DeadlinePolicy:         spec.DeadlinePolicy,
		ExtensionBudgetSeconds: spec.DeadlinePolicy.MaxSeconds - spec.DeadlinePolicy.BaseSeconds,
		Responses:              responses,
		Status:                 game.InteractionWindowOpen,
	}, nil
}

func appendInteractionClose(
	state game.State,
	responseEvents []game.DomainEvent,
	command game.Command,
	pack game.Pack,
) ([]game.DomainEvent, error) {
	next := state
	var err error
	for _, event := range responseEvents {
		next, err = game.Apply(next, event)
		if err != nil {
			return nil, err
		}
	}
	window := next.InteractionWindow
	if window == nil || window.Status != game.InteractionWindowOpen {
		return responseEvents, nil
	}
	closeReason := game.InteractionCloseReason("")
	switch command.InteractionIntent {
	case game.InteractionIntentAccept:
		closeReason = game.InteractionCloseAccepted
	case game.InteractionIntentDecline:
		if allInteractionResponded(window) {
			closeReason = game.InteractionCloseDeclined
		}
	default:
		if allInteractionResponded(window) {
			closeReason = game.InteractionCloseAllResponded
		}
	}
	if closeReason == "" {
		return responseEvents, nil
	}
	closeEvents, err := game.Handle(next, game.Command{
		Type:                   game.CommandCloseInteractionWindow,
		ActorID:                window.InitiatorActorID,
		InteractionID:          window.ID,
		InteractionAt:          command.InteractionAt,
		InteractionCloseReason: closeReason,
	}, pack)
	if err != nil {
		return nil, err
	}
	return append(responseEvents, closeEvents...), nil
}

func allInteractionResponded(window *game.InteractionWindow) bool {
	for _, actorID := range window.EligibleActorIDs {
		if window.Responses[actorID].State == game.InteractionResponsePending {
			return false
		}
	}
	return true
}

func projectedInteractionAction(
	projection game.Projection,
	interactionID string,
	actionID string,
	intent game.InteractionIntent,
) (game.InteractionActionView, bool) {
	if projection.Interaction == nil ||
		projection.Interaction.InteractionID != interactionID {
		return game.InteractionActionView{}, false
	}
	for _, action := range projection.Interaction.Actions {
		if action.ActionID == actionID &&
			action.InteractionID == interactionID &&
			action.Type == intent {
			return action, true
		}
	}
	return game.InteractionActionView{}, false
}

func projectedCombatHelpAction(
	projection game.Projection,
	actionID string,
) (game.InteractionActionView, bool) {
	if projection.Interaction == nil {
		return game.InteractionActionView{}, false
	}
	for _, action := range projection.Interaction.Actions {
		if action.ActionID == actionID &&
			(action.Type == game.InteractionIntentOfferHelp ||
				action.Type == game.InteractionIntentCancelHelp) {
			return action, true
		}
	}
	return game.InteractionActionView{}, false
}

func playerInteractionIntent(intent game.InteractionIntent) bool {
	switch intent {
	case game.InteractionIntentPass,
		game.InteractionIntentRespond,
		game.InteractionIntentAccept,
		game.InteractionIntentDecline:
		return true
	default:
		return false
	}
}

func interactionFingerprint(
	expectedVersion uint64,
	interactionID string,
	actionID string,
	intent game.InteractionIntent,
) string {
	raw, err := json.Marshal(struct {
		Type            string                 `json:"type"`
		ExpectedVersion uint64                 `json:"expected_version"`
		InteractionID   string                 `json:"interaction_id"`
		ActionID        string                 `json:"action_id"`
		Intent          game.InteractionIntent `json:"intent"`
	}{
		Type:            "interaction_response",
		ExpectedVersion: expectedVersion,
		InteractionID:   interactionID,
		ActionID:        actionID,
		Intent:          intent,
	})
	if err != nil {
		panic(fmt.Sprintf("marshal interaction fingerprint: %v", err))
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func targetEffectFingerprint(
	expectedVersion uint64,
	sourceInstanceID string,
	targetPlayerID string,
) string {
	raw, err := json.Marshal(struct {
		Type             string `json:"type"`
		ExpectedVersion  uint64 `json:"expected_version"`
		SourceInstanceID string `json:"source_instance_id"`
		TargetPlayerID   string `json:"target_player_id"`
	}{
		Type:             string(game.CommandPlayTargetEffect),
		ExpectedVersion:  expectedVersion,
		SourceInstanceID: sourceInstanceID,
		TargetPlayerID:   targetPlayerID,
	})
	if err != nil {
		panic(fmt.Sprintf("marshal target-effect fingerprint: %v", err))
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func combatHelpFingerprint(expectedVersion uint64, actionID string) string {
	raw, err := json.Marshal(struct {
		Type            string `json:"type"`
		ExpectedVersion uint64 `json:"expected_version"`
		ActionID        string `json:"action_id"`
	}{
		Type:            "combat_help_action",
		ExpectedVersion: expectedVersion,
		ActionID:        actionID,
	})
	if err != nil {
		panic(fmt.Sprintf("marshal combat-help fingerprint: %v", err))
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func interactionInvalidation(
	gameID string,
	version uint64,
	occurredAt time.Time,
) *Invalidation {
	return &Invalidation{
		Type:       "game.v1.version_advanced",
		OccurredAt: occurredAt.UTC().Format(time.RFC3339Nano),
		GameID:     gameID,
		Version:    version,
		Reason:     "interaction_changed",
	}
}

package game

import (
	"errors"
	"fmt"
	"slices"
)

func beginEffectSequence(
	state *State,
	playerIndex int,
	sourceInstanceID string,
	effects []Effect,
	finalize PendingFinalize,
	pack Pack,
	outcomes *[]RandomOutcome,
) error {
	for index, effect := range effects {
		if effect.Kind == EffectDiscard {
			options, err := effectOptions(*state, playerIndex, effect.Selector, pack)
			if err != nil {
				return err
			}
			required := min(effect.Count, len(options))
			if required == 0 {
				continue
			}
			if len(options) > required {
				state.Turn.Pending = &PendingDecision{
					Type:             "effect_choice",
					ActorID:          state.Players[playerIndex].ID,
					SourceInstanceID: sourceInstanceID,
					Options:          options,
					Minimum:          required,
					Maximum:          required,
					Effect:           effect,
					RemainingEffects: append([]Effect(nil), effects[index+1:]...),
					Finalize:         finalize,
				}
				setTurnPhase(state, PhaseResolveEffect)
				return nil
			}
			for _, instanceID := range options {
				if err := discardOwnedInstance(state, playerIndex, instanceID, pack); err != nil {
					return err
				}
			}
			pending, err := queueLoadoutResolution(
				state,
				playerIndex,
				sourceInstanceID,
				effects[index+1:],
				finalize,
				pack,
			)
			if err != nil {
				return err
			}
			if pending {
				return nil
			}
			continue
		}
		if err := applyImmediateEffect(
			state,
			playerIndex,
			effect,
			pack,
			outcomes,
		); err != nil {
			return err
		}
		pending, err := queueLoadoutResolution(
			state,
			playerIndex,
			sourceInstanceID,
			effects[index+1:],
			finalize,
			pack,
		)
		if err != nil {
			return err
		}
		if pending {
			return nil
		}
		if state.Status == StatusFinished || state.Players[playerIndex].Dead {
			break
		}
	}
	return finalizeEffectSequence(
		state,
		playerIndex,
		sourceInstanceID,
		finalize,
		pack,
	)
}

func resolvePendingEffect(
	state *State,
	playerIndex int,
	selected []string,
	pack Pack,
	outcomes *[]RandomOutcome,
) error {
	decision := state.Turn.Pending
	if decision == nil ||
		decision.Type != "effect_choice" ||
		decision.ActorID != state.Players[playerIndex].ID {
		return fmt.Errorf("%w: no effect choice is pending", ErrIllegalCommand)
	}
	if len(selected) < decision.Minimum ||
		len(selected) > decision.Maximum ||
		!uniqueStrings(selected) {
		return fmt.Errorf("%w: invalid effect selection count", ErrIllegalCommand)
	}
	for _, instanceID := range selected {
		if !slices.Contains(decision.Options, instanceID) {
			return fmt.Errorf("%w: selected card is not an option", ErrIllegalCommand)
		}
	}
	state.Turn.Pending = nil
	for _, instanceID := range selected {
		if !ownsInstance(state.Players[playerIndex], instanceID) {
			continue
		}
		if err := discardOwnedInstance(state, playerIndex, instanceID, pack); err != nil {
			return err
		}
	}
	sourceInstanceID := decision.SourceInstanceID
	remaining := append([]Effect(nil), decision.RemainingEffects...)
	finalize := decision.Finalize
	pending, err := queueLoadoutResolution(
		state,
		playerIndex,
		sourceInstanceID,
		remaining,
		finalize,
		pack,
	)
	if err != nil {
		return err
	}
	if pending {
		return nil
	}
	return beginEffectSequence(
		state,
		playerIndex,
		sourceInstanceID,
		remaining,
		finalize,
		pack,
		outcomes,
	)
}

func effectOptions(
	state State,
	playerIndex int,
	selector SelectorKind,
	pack Pack,
) ([]string, error) {
	player := state.Players[playerIndex]
	var options []string
	switch selector {
	case SelectorHand:
		options = append(options, player.Hand...)
	case SelectorEquipment:
		options = append(options, player.Carried...)
		options = append(options, player.Equipped...)
	case SelectorTrait:
		options = append(options, player.Traits...)
		for _, instanceID := range player.Attachments {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if !exists {
				return nil, fmt.Errorf("%w: attachment %s", ErrUnknownCard, instanceID)
			}
			if card.Kind == CardTraitAttachment {
				options = append(options, instanceID)
			}
		}
	case SelectorOwnedCard:
		for _, zone := range player.allOwnedZones() {
			options = append(options, zone...)
		}
	default:
		return nil, fmt.Errorf("%w: unsupported selector", ErrInvalidContent)
	}
	return options, nil
}

func queueLoadoutResolution(
	state *State,
	playerIndex int,
	sourceInstanceID string,
	remaining []Effect,
	finalize PendingFinalize,
	pack Pack,
) (bool, error) {
	err := reconcileLoadout(state, playerIndex, pack)
	if err == nil {
		return false, nil
	}
	var conflict *loadoutResolutionError
	if !errors.As(err, &conflict) {
		return false, err
	}
	state.Turn.Pending = &PendingDecision{
		Type:             "effect_choice",
		ActorID:          state.Players[playerIndex].ID,
		SourceInstanceID: sourceInstanceID,
		Options:          append([]string(nil), conflict.Options...),
		Minimum:          conflict.Count,
		Maximum:          conflict.Count,
		Effect: Effect{
			Kind:     EffectDiscard,
			Selector: SelectorOwnedCard,
			Count:    conflict.Count,
		},
		RemainingEffects: append([]Effect(nil), remaining...),
		Finalize:         finalize,
	}
	setTurnPhase(state, PhaseResolveEffect)
	return true, nil
}

func applyImmediateEffect(
	state *State,
	playerIndex int,
	effect Effect,
	pack Pack,
	outcomes *[]RandomOutcome,
) error {
	player := &state.Players[playerIndex]
	switch effect.Kind {
	case EffectGainLevel:
		profile, err := state.Profile()
		if err != nil {
			return err
		}
		target := player.Level + effect.Amount
		if !effect.CanWin && target >= profile.WinningLevel {
			target = profile.WinningLevel - 1
		}
		player.Level = min(target, profile.WinningLevel)
		if effect.CanWin && player.Level >= profile.WinningLevel {
			state.Status = StatusFinished
			state.WinnerPlayerID = player.ID
			state.Turn.ActionWindow = ActionWindow{}
			state.Turn.Phase = ""
		}
	case EffectLoseLevel:
		player.Level = max(1, player.Level-effect.Amount)
	case EffectModifyCombat:
		if effect.Persistent {
			return nil
		}
		if state.Turn.Encounter == nil {
			return fmt.Errorf("%w: combat modifier outside combat", ErrIllegalCommand)
		}
		switch effect.Target {
		case EffectTargetPlayer:
			state.Turn.Encounter.PlayerCombatModifier += effect.Amount
		case EffectTargetMonster:
			state.Turn.Encounter.MonsterCombatModifier += effect.Amount
		default:
			return fmt.Errorf("%w: invalid combat target", ErrInvalidContent)
		}
	case EffectModifyEscape:
		if effect.Persistent {
			return nil
		}
		if state.Turn.Encounter == nil {
			return fmt.Errorf("%w: escape modifier outside combat", ErrIllegalCommand)
		}
		state.Turn.Encounter.EscapeModifier += effect.Amount
	case EffectModifyHandLimit:
		if !effect.Persistent {
			return fmt.Errorf("%w: temporary hand limit is unsupported", ErrInvalidContent)
		}
	case EffectModifyReward:
		if effect.Persistent {
			return nil
		}
		if state.Turn.Encounter == nil {
			return fmt.Errorf("%w: reward modifier outside combat", ErrIllegalCommand)
		}
		state.Turn.Encounter.TreasureRewardModifier += effect.Amount
	case EffectChangeTag:
		if effect.ReplaceTag != "" {
			player.CharacterTags, _ = removeString(
				player.CharacterTags,
				effect.ReplaceTag,
			)
			player.SuppressedTags = appendUnique(
				player.SuppressedTags,
				effect.ReplaceTag,
			)
		}
		player.SuppressedTags, _ = removeString(player.SuppressedTags, effect.Tag)
		player.CharacterTags = appendUnique(player.CharacterTags, effect.Tag)
	case EffectDeath:
		return killPlayer(state, playerIndex, pack)
	case EffectDraw:
		drawn, err := state.takeCards(effect.Deck, effect.Amount, outcomes)
		if err != nil {
			return err
		}
		player.Hand = append(player.Hand, drawn...)
	case EffectTieWins:
		if !effect.Persistent {
			return fmt.Errorf("%w: temporary tie win is unsupported", ErrInvalidContent)
		}
	case EffectDiscard:
		return fmt.Errorf("%w: discard effect requires selection path", ErrInvalidContent)
	default:
		return fmt.Errorf("%w: unsupported effect %s", ErrInvalidContent, effect.Kind)
	}
	return nil
}

func finalizeEffectSequence(
	state *State,
	playerIndex int,
	sourceInstanceID string,
	finalize PendingFinalize,
	pack Pack,
) error {
	state.Turn.Pending = nil
	if sourceInstanceID != "" && slices.Contains(state.Turn.Resolving, sourceInstanceID) {
		if finalize.DiscardSource {
			if err := discardResolvingInstance(state, sourceInstanceID, pack); err != nil {
				return err
			}
		} else {
			var removed bool
			state.Turn.Resolving, removed = removeString(
				state.Turn.Resolving,
				sourceInstanceID,
			)
			if !removed {
				return fmt.Errorf("%w: persistent source is not resolving", ErrIllegalCommand)
			}
			state.Players[playerIndex].PersistentCurses = append(
				state.Players[playerIndex].PersistentCurses,
				sourceInstanceID,
			)
		}
	}
	if finalize.ClearEncounter {
		if err := discardEncounter(state, pack); err != nil {
			return err
		}
	}
	if state.Status == StatusFinished {
		state.Turn.Phase = ""
		state.Turn.ActionWindow = ActionWindow{}
		return nil
	}
	phase := finalize.Phase
	if state.Players[playerIndex].Dead {
		phase = PhaseCharity
	}
	setTurnPhase(state, phase)
	return nil
}

func killPlayer(state *State, playerIndex int, pack Pack) error {
	player := &state.Players[playerIndex]
	toDiscard := append([]string(nil), player.Hand...)
	toDiscard = append(toDiscard, player.Carried...)
	toDiscard = append(toDiscard, player.Equipped...)
	var keptAttachments []string
	for _, instanceID := range player.Attachments {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists {
			return fmt.Errorf("%w: attachment %s", ErrUnknownCard, instanceID)
		}
		if card.Kind == CardTraitAttachment {
			keptAttachments = append(keptAttachments, instanceID)
		} else {
			toDiscard = append(toDiscard, instanceID)
		}
	}
	player.Hand = nil
	player.Carried = nil
	player.Equipped = nil
	player.Attachments = keptAttachments
	player.CheatTargets = nil
	for _, instanceID := range toDiscard {
		if err := appendDiscard(state, instanceID, pack); err != nil {
			return err
		}
	}
	player.Dead = true
	player.NeedsRedraw = true
	return nil
}

func effectsPersist(effects []Effect) bool {
	for _, effect := range effects {
		if effect.Persistent {
			return true
		}
	}
	return false
}

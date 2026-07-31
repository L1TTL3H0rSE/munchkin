package game

import (
	"fmt"
	"slices"
	"strconv"
	"time"
)

type CombatTotals struct {
	PlayerStrength  int
	MonsterStrength int
	PlayerWins      bool
	TieWins         bool
	AutomaticDefeat bool
}

func setTurnPhase(state *State, phase Phase) {
	state.Turn.Phase = phase
	state.Turn.ActionWindow = ActionWindow{
		Kind:             string(phase),
		EligibleActorIDs: []string{state.Turn.PlayerID},
	}
}

func CollectiveInteractionDeadlinePolicy() InteractionDeadlinePolicy {
	return InteractionDeadlinePolicy{
		BaseSeconds:          60,
		LateThresholdSeconds: 30,
		ExtensionStepSeconds: 10,
		MaxSeconds:           90,
	}
}

func AddressedInteractionDeadlinePolicy() InteractionDeadlinePolicy {
	return InteractionDeadlinePolicy{
		BaseSeconds: 30,
		MaxSeconds:  30,
	}
}

func economyOfferWindow(
	state State,
	offer EconomyOffer,
	openedAt time.Time,
) (*InteractionWindow, error) {
	if offer.ID == "" ||
		offer.OffererPlayerID == "" ||
		offer.RecipientPlayerID == "" ||
		openedAt.IsZero() {
		return nil, fmt.Errorf(
			"%w: incomplete economy offer window",
			ErrIllegalCommand,
		)
	}
	policy := AddressedInteractionDeadlinePolicy()
	return &InteractionWindow{
		ID:   offer.ID,
		Kind: InteractionKindEconomyOffer,
		Parent: InteractionParent{
			Phase:       offer.ParentPhase,
			SubjectKind: InteractionSubjectTurn,
			SubjectID:   state.Turn.PlayerID,
		},
		InitiatorActorID:  offer.OffererPlayerID,
		EligibilityPolicy: InteractionEligibilityActorPrivate,
		AllowedIntents: []InteractionIntent{
			InteractionIntentAccept,
			InteractionIntentDecline,
		},
		EligibleActorIDs: []string{offer.RecipientPlayerID},
		OpenedAt:         openedAt,
		DeadlineAt: openedAt.Add(
			time.Duration(policy.BaseSeconds) * time.Second,
		),
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses: map[string]InteractionResponse{
			offer.RecipientPlayerID: {
				Requirement:   InteractionResponseMandatory,
				TimeoutIntent: InteractionIntentDecline,
				State:         InteractionResponsePending,
			},
		},
		Status: InteractionWindowOpen,
	}, nil
}

func charityRecipientIDs(state State, allocatorIndex int) []string {
	minimumLevel := 0
	for index, player := range state.Players {
		if index == allocatorIndex || player.Dead {
			continue
		}
		if minimumLevel == 0 || player.Level < minimumLevel {
			minimumLevel = player.Level
		}
	}
	if minimumLevel == 0 {
		return nil
	}
	recipients := make([]string, 0, len(state.Players)-1)
	for offset := 1; offset < len(state.Players); offset++ {
		index := (allocatorIndex + offset) % len(state.Players)
		player := state.Players[index]
		if !player.Dead && player.Level == minimumLevel {
			recipients = append(recipients, player.ID)
		}
	}
	return recipients
}

func charityTransferWindow(
	state State,
	interactionID string,
	openedAt time.Time,
) (*InteractionWindow, error) {
	if interactionID == "" ||
		openedAt.IsZero() ||
		state.Turn.PlayerID == "" {
		return nil, fmt.Errorf(
			"%w: incomplete charity window",
			ErrIllegalCommand,
		)
	}
	policy := AddressedInteractionDeadlinePolicy()
	return &InteractionWindow{
		ID:   interactionID,
		Kind: InteractionKindCharityTransfer,
		Parent: InteractionParent{
			Phase:       PhaseCharity,
			SubjectKind: InteractionSubjectTurn,
			SubjectID:   state.Turn.PlayerID,
		},
		InitiatorActorID:  state.Turn.PlayerID,
		EligibilityPolicy: InteractionEligibilityActorPrivate,
		AllowedIntents: []InteractionIntent{
			InteractionIntentRespond,
			InteractionIntentAutoResolve,
		},
		EligibleActorIDs: []string{state.Turn.PlayerID},
		OpenedAt:         openedAt,
		DeadlineAt: openedAt.Add(
			time.Duration(policy.BaseSeconds) * time.Second,
		),
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses: map[string]InteractionResponse{
			state.Turn.PlayerID: {
				Requirement:   InteractionResponseMandatory,
				TimeoutIntent: InteractionIntentAutoResolve,
				State:         InteractionResponsePending,
			},
		},
		Status: InteractionWindowOpen,
	}, nil
}

func theftResponseWindow(
	state State,
	attempt TheftAttempt,
	openedAt time.Time,
) (*InteractionWindow, error) {
	if attempt.InteractionID == "" ||
		attempt.ThiefPlayerID == "" ||
		attempt.VictimPlayerID == "" ||
		openedAt.IsZero() {
		return nil, fmt.Errorf(
			"%w: incomplete theft response window",
			ErrIllegalCommand,
		)
	}
	eligible := make([]string, 0, len(state.Players)-1)
	responses := make(
		map[string]InteractionResponse,
		len(state.Players)-1,
	)
	for _, player := range state.Players {
		if player.Dead || player.ID == attempt.ThiefPlayerID {
			continue
		}
		eligible = append(eligible, player.ID)
		responses[player.ID] = InteractionResponse{
			Requirement:   InteractionResponseOptional,
			TimeoutIntent: InteractionIntentPass,
			State:         InteractionResponsePending,
		}
	}
	if len(eligible) == 0 {
		return nil, fmt.Errorf(
			"%w: theft has no response actors",
			ErrIllegalCommand,
		)
	}
	policy := AddressedInteractionDeadlinePolicy()
	return &InteractionWindow{
		ID:   attempt.InteractionID,
		Kind: InteractionKindTheftResponse,
		Parent: InteractionParent{
			Phase:       attempt.ParentPhase,
			SubjectKind: InteractionSubjectTurn,
			SubjectID:   state.Turn.PlayerID,
		},
		InitiatorActorID:  attempt.ThiefPlayerID,
		EligibilityPolicy: InteractionEligibilityOpaquePublicSet,
		AllowedIntents: []InteractionIntent{
			InteractionIntentPass,
			InteractionIntentRespond,
		},
		EligibleActorIDs: eligible,
		OpenedAt:         openedAt,
		DeadlineAt: openedAt.Add(
			time.Duration(policy.BaseSeconds) * time.Second,
		),
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses:        responses,
		Status:           InteractionWindowOpen,
	}, nil
}

func transferableCarriedInstances(
	state State,
	playerIndex int,
	pack Pack,
) ([]string, error) {
	player := state.Players[playerIndex]
	ids := make([]string, 0, len(player.Carried))
	for _, instanceID := range player.Carried {
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if !exists || card.Item == nil {
			return nil, fmt.Errorf(
				"%w: carried card is not an item",
				ErrInvalidContent,
			)
		}
		if isCheated(player, instanceID) {
			continue
		}
		ids = append(ids, instanceID)
	}
	return ids, nil
}

func transferCarriedInstances(
	state *State,
	fromIndex int,
	toIndex int,
	instanceIDs []string,
	pack Pack,
) error {
	if fromIndex < 0 ||
		toIndex < 0 ||
		fromIndex == toIndex ||
		len(instanceIDs) == 0 ||
		!uniqueStrings(instanceIDs) {
		return fmt.Errorf(
			"%w: malformed transfer clause",
			ErrIllegalCommand,
		)
	}
	from := &state.Players[fromIndex]
	for _, instanceID := range instanceIDs {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists ||
			card.Item == nil ||
			!slices.Contains(from.Carried, instanceID) ||
			isCheated(*from, instanceID) {
			return fmt.Errorf(
				"%w: card is not transferable",
				ErrIllegalCommand,
			)
		}
	}
	for _, instanceID := range instanceIDs {
		from.Carried, _ = removeString(from.Carried, instanceID)
		state.Players[toIndex].Carried = append(
			state.Players[toIndex].Carried,
			instanceID,
		)
	}
	return nil
}

func targetResponseActors(state State, initiatorID string) []string {
	actorIDs := make([]string, 0, len(state.Players)-1)
	for _, player := range state.Players {
		if player.ID != initiatorID && !player.Dead {
			actorIDs = append(actorIDs, player.ID)
		}
	}
	return actorIDs
}

func runAwayResponseActors(state State) []string {
	actorIDs := make([]string, 0, len(state.Players))
	for _, player := range state.Players {
		if !player.Dead {
			actorIDs = append(actorIDs, player.ID)
		}
	}
	return actorIDs
}

func targetEffectWindow(
	state State,
	interactionID string,
	openedAt time.Time,
	initiatorID string,
	sourceInstanceID string,
) *InteractionWindow {
	actorIDs := targetResponseActors(state, initiatorID)
	if len(actorIDs) == 0 {
		return nil
	}
	responses := make(map[string]InteractionResponse, len(actorIDs))
	for _, actorID := range actorIDs {
		responses[actorID] = InteractionResponse{
			Requirement:   InteractionResponseOptional,
			TimeoutIntent: InteractionIntentPass,
			State:         InteractionResponsePending,
		}
	}
	policy := AddressedInteractionDeadlinePolicy()
	return &InteractionWindow{
		ID:   interactionID,
		Kind: InteractionKindTargetResponse,
		Parent: InteractionParent{
			Phase:       state.Turn.Phase,
			SubjectKind: InteractionSubjectEffect,
			SubjectID:   sourceInstanceID,
		},
		InitiatorActorID:  initiatorID,
		EligibilityPolicy: InteractionEligibilityOpaquePublicSet,
		AllowedIntents: []InteractionIntent{
			InteractionIntentPass,
			InteractionIntentRespond,
		},
		EligibleActorIDs: actorIDs,
		OpenedAt:         openedAt,
		DeadlineAt: openedAt.Add(
			time.Duration(policy.BaseSeconds) * time.Second,
		),
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses:        responses,
		Status:           InteractionWindowOpen,
	}
}

func initializeRunAwaySequence(state *State) error {
	if state.Turn.Encounter == nil {
		return fmt.Errorf("%w: missing Run Away encounter", ErrIllegalCommand)
	}
	participants := []string{state.Turn.PlayerID}
	if help := state.Turn.Encounter.CombatHelp; help != nil {
		if help.HelperPlayerID != "" &&
			help.HelperPlayerID != state.Turn.PlayerID {
			participants = append(participants, help.HelperPlayerID)
		}
	}
	state.Turn.RunAway = &RunAwaySequence{
		ParticipantPlayerIDs: participants,
		MonsterInstanceIDs: encounterMonsterInstanceIDs(
			*state.Turn.Encounter,
		),
	}
	return nil
}

func currentRunAwayStep(
	state State,
) (*RunAwaySequence, int, string, error) {
	sequence := state.Turn.RunAway
	if sequence == nil ||
		sequence.Completed ||
		sequence.ParticipantIndex < 0 ||
		sequence.ParticipantIndex >= len(sequence.ParticipantPlayerIDs) ||
		sequence.MonsterIndex < 0 ||
		sequence.MonsterIndex >= len(sequence.MonsterInstanceIDs) {
		return nil, -1, "", fmt.Errorf(
			"%w: Run Away step is not active",
			ErrIllegalCommand,
		)
	}
	playerIndex := state.PlayerIndex(
		sequence.ParticipantPlayerIDs[sequence.ParticipantIndex],
	)
	if playerIndex < 0 {
		return nil, -1, "", fmt.Errorf(
			"%w: Run Away participant is missing",
			ErrIllegalCommand,
		)
	}
	return sequence, playerIndex,
		sequence.MonsterInstanceIDs[sequence.MonsterIndex], nil
}

func resetInteractionResponses(
	window *InteractionWindow,
	acceptedAt time.Time,
) error {
	if window == nil ||
		window.Status != InteractionWindowOpen ||
		acceptedAt.IsZero() ||
		!acceptedAt.Before(window.DeadlineAt) {
		return fmt.Errorf(
			"%w: stale interaction material response",
			ErrIllegalCommand,
		)
	}
	for _, actorID := range window.EligibleActorIDs {
		response := window.Responses[actorID]
		response.State = InteractionResponsePending
		response.Intent = ""
		response.AcceptedAt = time.Time{}
		window.Responses[actorID] = response
	}
	window.DeadlineRevision++
	return nil
}

func materializeForProfile(
	pack Pack,
	profile RulesProfile,
) (map[string]CardInstance, []string, []string, error) {
	instances, doors, treasures, err := pack.Materialize()
	if err != nil || !profile.CombatResponses {
		return instances, doors, treasures, err
	}
	for _, card := range pack.Cards {
		if _, ok := combatInterventionEffect(card); !ok {
			continue
		}
		for copyIndex := 1; copyIndex <= card.Copies; copyIndex++ {
			instanceID := card.ID + "-" + strconv.Itoa(copyIndex)
			if _, exists := instances[instanceID]; exists {
				return nil, nil, nil, fmt.Errorf(
					"%w: duplicate instance %s",
					ErrInvalidContent,
					instanceID,
				)
			}
			instances[instanceID] = CardInstance{
				ID:           instanceID,
				DefinitionID: card.ID,
			}
			switch card.Deck {
			case DeckDoor:
				doors = append(doors, instanceID)
			case DeckTreasure:
				treasures = append(treasures, instanceID)
			default:
				return nil, nil, nil, fmt.Errorf(
					"%w: card %s has invalid deck",
					ErrInvalidContent,
					card.ID,
				)
			}
		}
	}
	return instances, doors, treasures, nil
}

func combatInterventionEffect(card Card) (Effect, bool) {
	if card.InteractionScope != InteractionOtherPlayers ||
		card.Kind != CardOneShot ||
		len(card.Effects) != 1 {
		return Effect{}, false
	}
	effect := card.Effects[0]
	if effect.Kind != EffectModifyCombat ||
		effect.Persistent ||
		(effect.Target != EffectTargetPlayer &&
			effect.Target != EffectTargetMonster) {
		return Effect{}, false
	}
	return effect, true
}

func combatResponseActors(state State) []string {
	actorIDs := make([]string, 0, len(state.Players)-1)
	for _, player := range state.Players {
		if player.ID != state.Turn.PlayerID && !player.Dead {
			actorIDs = append(actorIDs, player.ID)
		}
	}
	return actorIDs
}

func combatResponseWindow(
	state State,
	interactionID string,
	openedAt time.Time,
) *InteractionWindow {
	actorIDs := combatResponseActors(state)
	if len(actorIDs) == 0 || state.Turn.Encounter == nil {
		return nil
	}
	responses := make(map[string]InteractionResponse, len(actorIDs))
	for _, actorID := range actorIDs {
		responses[actorID] = InteractionResponse{
			Requirement:   InteractionResponseOptional,
			TimeoutIntent: InteractionIntentPass,
			State:         InteractionResponsePending,
		}
	}
	policy := CollectiveInteractionDeadlinePolicy()
	return &InteractionWindow{
		ID:   interactionID,
		Kind: InteractionKindCombatResponse,
		Parent: InteractionParent{
			Phase:       PhaseCombat,
			SubjectKind: InteractionSubjectEncounter,
			SubjectID:   state.Turn.Encounter.MonsterInstanceID,
		},
		InitiatorActorID:  state.Turn.PlayerID,
		EligibilityPolicy: InteractionEligibilityOpaquePublicSet,
		AllowedIntents: []InteractionIntent{
			InteractionIntentPass,
			InteractionIntentRespond,
		},
		EligibleActorIDs:       actorIDs,
		OpenedAt:               openedAt,
		DeadlineAt:             openedAt.Add(time.Duration(policy.BaseSeconds) * time.Second),
		DeadlineRevision:       1,
		DeadlinePolicy:         policy,
		ExtensionBudgetSeconds: policy.MaxSeconds - policy.BaseSeconds,
		Responses:              responses,
		Status:                 InteractionWindowOpen,
	}
}

func combatHelpWindow(
	parent InteractionWindow,
	offer CombatHelpOffer,
	openedAt time.Time,
) (*InteractionWindow, error) {
	if parent.Status != InteractionWindowOpen ||
		parent.Kind != InteractionKindCombatResponse ||
		parent.Parent.SubjectKind != InteractionSubjectEncounter ||
		offer.ID == "" ||
		offer.ParentInteractionID != parent.ID ||
		offer.CombatantPlayerID != parent.InitiatorActorID ||
		offer.HelperPlayerID == "" ||
		offer.RewardTreasures < 1 ||
		openedAt.IsZero() ||
		openedAt.Before(parent.OpenedAt) {
		return nil, fmt.Errorf(
			"%w: malformed combat-help offer",
			ErrIllegalCommand,
		)
	}
	remaining := parent.DeadlineAt.Sub(openedAt)
	if remaining < 10*time.Second {
		return nil, fmt.Errorf(
			"%w: combat-help offer requires ten parent seconds",
			ErrIllegalCommand,
		)
	}
	deadline := openedAt.Add(30 * time.Second)
	if parent.DeadlineAt.Before(deadline) {
		deadline = parent.DeadlineAt
	}
	baseSeconds := int(
		(deadline.Sub(openedAt) + time.Second - 1) / time.Second,
	)
	policy := InteractionDeadlinePolicy{
		BaseSeconds: baseSeconds,
		MaxSeconds:  baseSeconds,
	}
	return &InteractionWindow{
		ID:   offer.ID,
		Kind: InteractionKindAddressedResponse,
		Parent: InteractionParent{
			Phase:               PhaseCombat,
			SubjectKind:         InteractionSubjectInteraction,
			SubjectID:           parent.ID,
			ParentInteractionID: parent.ID,
		},
		InitiatorActorID:  offer.CombatantPlayerID,
		EligibilityPolicy: InteractionEligibilityActorPrivate,
		AllowedIntents: []InteractionIntent{
			InteractionIntentAccept,
			InteractionIntentDecline,
		},
		EligibleActorIDs: []string{offer.HelperPlayerID},
		OpenedAt:         openedAt,
		DeadlineAt:       deadline,
		DeadlineRevision: 1,
		DeadlinePolicy:   policy,
		Responses: map[string]InteractionResponse{
			offer.HelperPlayerID: {
				Requirement:   InteractionResponseMandatory,
				TimeoutIntent: InteractionIntentDecline,
				State:         InteractionResponsePending,
			},
		},
		Status: InteractionWindowOpen,
	}, nil
}

func combatHelpRewardMaximum(state State, pack Pack) (int, error) {
	if state.Turn.Encounter == nil {
		return 0, fmt.Errorf("%w: missing encounter", ErrIllegalCommand)
	}
	playerIndex := state.PlayerIndex(state.Turn.PlayerID)
	if playerIndex < 0 {
		return 0, fmt.Errorf("%w: missing combatant", ErrIllegalCommand)
	}
	monsterCard, _, exists := pack.DefinitionForInstance(
		state,
		state.Turn.Encounter.MonsterInstanceID,
	)
	if !exists || monsterCard.Monster == nil {
		return 0, fmt.Errorf("%w: invalid monster", ErrInvalidContent)
	}
	modifier, err := treasureRewardModifier(
		state,
		playerIndex,
		pack,
		monsterCard.Monster.Tags,
	)
	if err != nil {
		return 0, err
	}
	return min(
		max(0, monsterCard.Monster.Treasures+modifier),
		len(state.TreasureDeck)+len(state.TreasureDiscard),
	), nil
}

func combatInterventionDeadlineAfter(
	window InteractionWindow,
	acceptedAt time.Time,
) (time.Time, uint32, int, error) {
	deadline, revision, budget, err := interactionDeadlineAfter(
		window,
		acceptedAt,
		InteractionIntentRespond,
	)
	if err != nil {
		return time.Time{}, 0, 0, err
	}
	if revision == window.DeadlineRevision {
		if revision == ^uint32(0) {
			return time.Time{}, 0, 0, fmt.Errorf(
				"%w: interaction deadline revision overflow",
				ErrIllegalCommand,
			)
		}
		revision++
	}
	return deadline, revision, budget, nil
}

func interactionResponseStateForIntent(
	intent InteractionIntent,
) (InteractionResponseState, error) {
	switch intent {
	case InteractionIntentPass:
		return InteractionResponsePassed, nil
	case InteractionIntentRespond:
		return InteractionResponseActed, nil
	case InteractionIntentAccept:
		return InteractionResponseAccepted, nil
	case InteractionIntentDecline:
		return InteractionResponseDeclined, nil
	default:
		return "", fmt.Errorf("%w: intent cannot be submitted", ErrIllegalCommand)
	}
}

func interactionDeadlineAfter(
	window InteractionWindow,
	acceptedAt time.Time,
	intent InteractionIntent,
) (time.Time, uint32, int, error) {
	if acceptedAt.IsZero() ||
		acceptedAt.Before(window.OpenedAt) ||
		!acceptedAt.Before(window.DeadlineAt) {
		return time.Time{}, 0, 0, fmt.Errorf(
			"%w: interaction response is outside deadline",
			ErrIllegalCommand,
		)
	}
	deadline := window.DeadlineAt
	revision := window.DeadlineRevision
	budget := window.ExtensionBudgetSeconds
	policy := window.DeadlinePolicy
	if intent != InteractionIntentRespond ||
		policy.ExtensionStepSeconds == 0 ||
		acceptedAt.Before(
			window.OpenedAt.Add(
				time.Duration(policy.LateThresholdSeconds)*time.Second,
			),
		) ||
		budget < policy.ExtensionStepSeconds {
		return deadline, revision, budget, nil
	}
	hardDeadline := window.OpenedAt.Add(
		time.Duration(policy.MaxSeconds) * time.Second,
	)
	extended := deadline.Add(
		time.Duration(policy.ExtensionStepSeconds) * time.Second,
	)
	if extended.After(hardDeadline) {
		extended = hardDeadline
	}
	added := int(extended.Sub(deadline) / time.Second)
	if added <= 0 {
		return deadline, revision, budget, nil
	}
	if revision == ^uint32(0) {
		return time.Time{}, 0, 0, fmt.Errorf(
			"%w: interaction deadline revision overflow",
			ErrIllegalCommand,
		)
	}
	return extended, revision + 1, budget - added, nil
}

func interactionResponseAt(
	window InteractionWindow,
	actorID string,
) (InteractionResponse, error) {
	if window.Status != InteractionWindowOpen {
		return InteractionResponse{}, fmt.Errorf(
			"%w: interaction is already closed",
			ErrIllegalCommand,
		)
	}
	response, exists := window.Responses[actorID]
	if !exists || !slices.Contains(window.EligibleActorIDs, actorID) {
		return InteractionResponse{}, fmt.Errorf(
			"%w: actor is not eligible for interaction",
			ErrIllegalCommand,
		)
	}
	if response.State != InteractionResponsePending {
		return InteractionResponse{}, fmt.Errorf(
			"%w: interaction actor already responded",
			ErrIllegalCommand,
		)
	}
	return response, nil
}

func removeString(values []string, target string) ([]string, bool) {
	for index, value := range values {
		if value == target {
			return append(values[:index:index], values[index+1:]...), true
		}
	}
	return values, false
}

func uniqueStrings(values []string) bool {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if value == "" {
			return false
		}
		if _, exists := seen[value]; exists {
			return false
		}
		seen[value] = struct{}{}
	}
	return true
}

func containsAny(values, candidates []string) bool {
	for _, candidate := range candidates {
		if slices.Contains(values, candidate) {
			return true
		}
	}
	return false
}

func appendUnique(values []string, value string) []string {
	if slices.Contains(values, value) {
		return values
	}
	return append(values, value)
}

func (state *State) takeCards(
	deck DeckKind,
	count int,
	outcomes *[]RandomOutcome,
) ([]string, error) {
	result := make([]string, 0, count)
	for len(result) < count {
		var drawPile, discardPile *[]string
		switch deck {
		case DeckDoor:
			drawPile = &state.DoorDeck
			discardPile = &state.DoorDiscard
		case DeckTreasure:
			drawPile = &state.TreasureDeck
			discardPile = &state.TreasureDiscard
		default:
			return nil, fmt.Errorf("%w: unknown deck %s", ErrInvalidContent, deck)
		}
		if len(*drawPile) == 0 {
			if len(*discardPile) == 0 {
				return nil, fmt.Errorf("%w: %s deck exhausted", ErrIllegalCommand, deck)
			}
			shuffled, rngState := shuffle(*discardPile, state.RNGState)
			state.RNGState = rngState
			*drawPile = shuffled
			*discardPile = nil
			*outcomes = append(*outcomes, RandomOutcome{
				Kind:  "shuffle",
				Deck:  deck,
				Order: append([]string(nil), shuffled...),
			})
		}
		result = append(result, (*drawPile)[0])
		*drawPile = append([]string(nil), (*drawPile)[1:]...)
	}
	return result, nil
}

func appendDiscard(state *State, instanceID string, pack Pack) error {
	card, _, exists := pack.DefinitionForInstance(*state, instanceID)
	if !exists {
		return fmt.Errorf("%w: instance %s", ErrUnknownCard, instanceID)
	}
	switch card.Deck {
	case DeckDoor:
		state.DoorDiscard = append(state.DoorDiscard, instanceID)
	case DeckTreasure:
		state.TreasureDiscard = append(state.TreasureDiscard, instanceID)
	default:
		return fmt.Errorf("%w: card %s has invalid deck", ErrInvalidContent, card.ID)
	}
	return nil
}

func removeOwnedInstance(player *Player, instanceID string) bool {
	var removed bool
	zones := []*[]string{
		&player.Hand,
		&player.Carried,
		&player.Equipped,
		&player.Traits,
		&player.Attachments,
		&player.PersistentCurses,
	}
	for _, zone := range zones {
		var found bool
		*zone, found = removeString(*zone, instanceID)
		removed = removed || found
	}
	return removed
}

func ownsInstance(player Player, instanceID string) bool {
	for _, zone := range player.allOwnedZones() {
		if slices.Contains(zone, instanceID) {
			return true
		}
	}
	return false
}

func equippedItemRemainsLegal(
	state State,
	playerIndex int,
	instanceID string,
	pack Pack,
) (bool, error) {
	player := state.Players[playerIndex]
	if isCheated(player, instanceID) {
		return true, nil
	}
	card, _, exists := pack.DefinitionForInstance(state, instanceID)
	if !exists || card.Item == nil {
		return false, fmt.Errorf(
			"%w: Cheat target %s is not an item",
			ErrIllegalCommand,
			instanceID,
		)
	}
	allowed, err := itemRestrictionsSatisfied(state, player, *card.Item, pack)
	if err != nil || !allowed {
		return allowed, err
	}
	if card.Item.Slot == SlotHands {
		handsUsed := 0
		for _, equippedID := range player.Equipped {
			equipped, _, exists := pack.DefinitionForInstance(state, equippedID)
			if !exists || equipped.Item == nil {
				return false, fmt.Errorf(
					"%w: equipped card is not an item",
					ErrInvalidContent,
				)
			}
			if !isCheated(player, equippedID) &&
				equipped.Item.Slot == SlotHands {
				handsUsed += equipped.Item.Hands
			}
		}
		return handsUsed <= 2, nil
	}
	if card.Item.Slot == SlotNone {
		return true, nil
	}
	for _, equippedID := range player.Equipped {
		if equippedID == instanceID || isCheated(player, equippedID) {
			continue
		}
		equipped, _, exists := pack.DefinitionForInstance(state, equippedID)
		if !exists || equipped.Item == nil {
			return false, fmt.Errorf(
				"%w: equipped card is not an item",
				ErrInvalidContent,
			)
		}
		if equipped.Item.Slot == card.Item.Slot {
			return false, nil
		}
	}
	return true, nil
}

func discardOwnedInstance(
	state *State,
	playerIndex int,
	instanceID string,
	pack Pack,
) error {
	player := &state.Players[playerIndex]
	if !removeOwnedInstance(player, instanceID) {
		return fmt.Errorf("%w: card %s is not owned", ErrIllegalCommand, instanceID)
	}
	var attachedCheats []string
	for attachmentID, targetID := range player.CheatTargets {
		if attachmentID == instanceID {
			delete(player.CheatTargets, attachmentID)
			legal, err := equippedItemRemainsLegal(
				*state,
				playerIndex,
				targetID,
				pack,
			)
			if err != nil {
				return err
			}
			if slices.Contains(player.Equipped, targetID) && !legal {
				player.Equipped, _ = removeString(player.Equipped, targetID)
				player.Carried = appendUnique(player.Carried, targetID)
			}
			continue
		}
		if targetID == instanceID {
			attachedCheats = append(attachedCheats, attachmentID)
			delete(player.CheatTargets, attachmentID)
		}
	}
	if err := appendDiscard(state, instanceID, pack); err != nil {
		return err
	}
	for _, attachmentID := range attachedCheats {
		if !removeOwnedInstance(player, attachmentID) {
			return fmt.Errorf("%w: missing cheat attachment", ErrIllegalCommand)
		}
		if err := appendDiscard(state, attachmentID, pack); err != nil {
			return err
		}
	}
	return nil
}

func discardResolvingInstance(state *State, instanceID string, pack Pack) error {
	var removed bool
	state.Turn.Resolving, removed = removeString(state.Turn.Resolving, instanceID)
	if !removed {
		return fmt.Errorf("%w: card %s is not resolving", ErrIllegalCommand, instanceID)
	}
	return appendDiscard(state, instanceID, pack)
}

func discardEncounter(state *State, pack Pack) error {
	if state.Turn.Encounter == nil {
		return nil
	}
	instanceID := state.Turn.Encounter.MonsterInstanceID
	state.Turn.Encounter = nil
	return appendDiscard(state, instanceID, pack)
}

func playerDefinitions(
	state State,
	player Player,
	pack Pack,
	zones ...[]string,
) ([]Card, error) {
	var result []Card
	for _, zone := range zones {
		for _, instanceID := range zone {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if !exists {
				return nil, fmt.Errorf("%w: instance %s", ErrUnknownCard, instanceID)
			}
			result = append(result, card)
		}
	}
	return result, nil
}

func characterTags(state State, player Player, pack Pack) ([]string, error) {
	var tags []string
	for _, tag := range player.CharacterTags {
		if !slices.Contains(player.SuppressedTags, tag) {
			tags = appendUnique(tags, tag)
		}
	}
	cards, err := playerDefinitions(state, player, pack, player.Traits)
	if err != nil {
		return nil, err
	}
	for _, card := range cards {
		if card.Trait != nil {
			for _, tag := range card.Trait.Tags {
				if !slices.Contains(player.SuppressedTags, tag) {
					tags = appendUnique(tags, tag)
				}
			}
		}
	}
	return tags, nil
}

func modifierApplies(modifier Modifier, characterTags, monsterTags []string) bool {
	switch modifier.Condition.Kind {
	case ConditionAlways:
		return true
	case ConditionCharacterHasTag:
		return slices.Contains(characterTags, modifier.Condition.Tag)
	case ConditionCharacterLacksTag:
		return !slices.Contains(characterTags, modifier.Condition.Tag)
	case ConditionMonsterHasTag:
		return slices.Contains(monsterTags, modifier.Condition.Tag)
	default:
		return false
	}
}

func activePlayerModifiers(
	state State,
	player Player,
	pack Pack,
	target ModifierTarget,
	monsterTags []string,
) (int, error) {
	tags, err := characterTags(state, player, pack)
	if err != nil {
		return 0, err
	}
	cards, err := playerDefinitions(
		state,
		player,
		pack,
		player.Equipped,
		player.Traits,
	)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, card := range cards {
		var modifiers []Modifier
		switch {
		case card.Item != nil:
			modifiers = card.Item.Modifiers
		case card.Trait != nil:
			modifiers = card.Trait.Modifiers
		}
		for _, modifier := range modifiers {
			if modifier.Target == target && modifierApplies(modifier, tags, monsterTags) {
				total += modifier.Amount
			}
		}
	}
	for _, instanceID := range player.PersistentCurses {
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if !exists {
			return 0, fmt.Errorf("%w: persistent card %s", ErrUnknownCard, instanceID)
		}
		for _, effect := range card.Effects {
			if !effect.Persistent {
				continue
			}
			switch {
			case target == ModifierPlayerCombat &&
				effect.Kind == EffectModifyCombat &&
				effect.Target == EffectTargetPlayer:
				total += effect.Amount
			case target == ModifierMonsterCombat &&
				effect.Kind == EffectModifyCombat &&
				effect.Target == EffectTargetMonster:
				total += effect.Amount
			case target == ModifierEscape && effect.Kind == EffectModifyEscape:
				total += effect.Amount
			case target == ModifierHandLimit && effect.Kind == EffectModifyHandLimit:
				total += effect.Amount
			case target == ModifierTreasureReward && effect.Kind == EffectModifyReward:
				total += effect.Amount
			}
		}
	}
	return total, nil
}

func combatTotals(state State, playerIndex int, pack Pack) (CombatTotals, error) {
	if state.Turn.Encounter == nil {
		return CombatTotals{}, fmt.Errorf("%w: missing encounter", ErrIllegalCommand)
	}
	player := state.Players[playerIndex]
	monsterCard, _, exists := pack.DefinitionForInstance(
		state,
		state.Turn.Encounter.MonsterInstanceID,
	)
	if !exists || monsterCard.Monster == nil {
		return CombatTotals{}, fmt.Errorf("%w: invalid monster encounter", ErrInvalidContent)
	}
	tags, err := characterTags(state, player, pack)
	if err != nil {
		return CombatTotals{}, err
	}
	playerStrength := player.Level + state.Turn.Encounter.PlayerCombatModifier
	monsterStrength := monsterCard.Monster.Strength +
		state.Turn.Encounter.MonsterCombatModifier
	tieWins := false
	cards, err := playerDefinitions(
		state,
		player,
		pack,
		player.Equipped,
		player.Traits,
	)
	if err != nil {
		return CombatTotals{}, err
	}
	for _, card := range cards {
		if card.Item != nil {
			playerStrength += card.Item.Bonus
		}
		if card.Trait != nil && card.Trait.TieWins {
			tieWins = true
		}
	}
	playerModifier, err := activePlayerModifiers(
		state,
		player,
		pack,
		ModifierPlayerCombat,
		monsterCard.Monster.Tags,
	)
	if err != nil {
		return CombatTotals{}, err
	}
	monsterModifier, err := activePlayerModifiers(
		state,
		player,
		pack,
		ModifierMonsterCombat,
		monsterCard.Monster.Tags,
	)
	if err != nil {
		return CombatTotals{}, err
	}
	playerStrength += playerModifier
	monsterStrength += monsterModifier
	if help := state.Turn.Encounter.CombatHelp; help != nil &&
		help.RewardStatus == CombatHelpRewardAccepted {
		helperIndex := state.PlayerIndex(help.HelperPlayerID)
		if helperIndex < 0 {
			return CombatTotals{}, fmt.Errorf(
				"%w: combat helper is missing",
				ErrIllegalCommand,
			)
		}
		helper := state.Players[helperIndex]
		helperCards, err := playerDefinitions(
			state,
			helper,
			pack,
			helper.Equipped,
			helper.Traits,
		)
		if err != nil {
			return CombatTotals{}, err
		}
		helperStrength := helper.Level
		for _, card := range helperCards {
			if card.Item != nil {
				helperStrength += card.Item.Bonus
			}
		}
		helperPlayerModifier, err := activePlayerModifiers(
			state,
			helper,
			pack,
			ModifierPlayerCombat,
			monsterCard.Monster.Tags,
		)
		if err != nil {
			return CombatTotals{}, err
		}
		helperMonsterModifier, err := activePlayerModifiers(
			state,
			helper,
			pack,
			ModifierMonsterCombat,
			monsterCard.Monster.Tags,
		)
		if err != nil {
			return CombatTotals{}, err
		}
		playerStrength += helperStrength + helperPlayerModifier
		monsterStrength += helperMonsterModifier
	}
	for _, modifier := range monsterCard.Monster.Modifiers {
		if modifierApplies(modifier, tags, monsterCard.Monster.Tags) {
			switch modifier.Target {
			case ModifierPlayerCombat:
				playerStrength += modifier.Amount
			case ModifierMonsterCombat:
				monsterStrength += modifier.Amount
			}
		}
	}
	for _, instanceID := range player.PersistentCurses {
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if !exists {
			return CombatTotals{}, fmt.Errorf("%w: persistent card %s", ErrUnknownCard, instanceID)
		}
		for _, effect := range card.Effects {
			if effect.Kind == EffectTieWins && effect.Persistent {
				tieWins = true
			}
		}
	}
	automaticDefeat := containsAny(tags, monsterCard.Monster.AutoDefeatCharacterTags)
	playerWins := !automaticDefeat &&
		(playerStrength > monsterStrength ||
			(playerStrength == monsterStrength && tieWins))
	return CombatTotals{
		PlayerStrength:  playerStrength,
		MonsterStrength: monsterStrength,
		PlayerWins:      playerWins,
		TieWins:         tieWins,
		AutomaticDefeat: automaticDefeat,
	}, nil
}

func escapeBonus(state State, playerIndex int, pack Pack) (int, error) {
	player := state.Players[playerIndex]
	total := state.Turn.Encounter.EscapeModifier
	cards, err := playerDefinitions(state, player, pack, player.Equipped, player.Traits)
	if err != nil {
		return 0, err
	}
	for _, card := range cards {
		if card.Item != nil {
			total += card.Item.EscapeBonus
		}
	}
	modifier, err := activePlayerModifiers(
		state,
		player,
		pack,
		ModifierEscape,
		nil,
	)
	if err != nil {
		return 0, err
	}
	return total + modifier, nil
}

func handLimit(state State, playerIndex int, pack Pack) (int, error) {
	player := state.Players[playerIndex]
	profile, err := state.Profile()
	if err != nil {
		return 0, err
	}
	total := profile.HandLimit
	cards, err := playerDefinitions(state, player, pack, player.Equipped, player.Traits)
	if err != nil {
		return 0, err
	}
	for _, card := range cards {
		if card.Item != nil {
			total += card.Item.HandLimitBonus
		}
	}
	modifier, err := activePlayerModifiers(
		state,
		player,
		pack,
		ModifierHandLimit,
		nil,
	)
	if err != nil {
		return 0, err
	}
	total += modifier
	if total < 0 {
		return 0, nil
	}
	return total, nil
}

func treasureRewardModifier(
	state State,
	playerIndex int,
	pack Pack,
	monsterTags []string,
) (int, error) {
	value, err := activePlayerModifiers(
		state,
		state.Players[playerIndex],
		pack,
		ModifierTreasureReward,
		monsterTags,
	)
	if err != nil {
		return 0, err
	}
	return value + state.Turn.Encounter.TreasureRewardModifier, nil
}

func bigAllowance(state State, playerIndex int, pack Pack) (int, error) {
	player := state.Players[playerIndex]
	allowance := 1
	cards, err := playerDefinitions(state, player, pack, player.Equipped, player.Traits)
	if err != nil {
		return 0, err
	}
	for _, card := range cards {
		if card.Item != nil {
			allowance += card.Item.BigAllowance
		}
		if card.Trait != nil {
			allowance += card.Trait.BigAllowance
		}
	}
	return allowance, nil
}

func itemRestrictionsSatisfied(
	state State,
	player Player,
	item ItemSpec,
	pack Pack,
) (bool, error) {
	if item.Restrictions == nil {
		return true, nil
	}
	tags, err := characterTags(state, player, pack)
	if err != nil {
		return false, err
	}
	for _, tag := range item.Restrictions.RequiredTags {
		if !slices.Contains(tags, tag) {
			return false, nil
		}
	}
	for _, tag := range item.Restrictions.ForbiddenTags {
		if slices.Contains(tags, tag) {
			return false, nil
		}
	}
	return true, nil
}

type loadoutResolutionError struct {
	Reason  string
	Options []string
	Count   int
}

func (err *loadoutResolutionError) Error() string {
	return fmt.Sprintf(
		"%s: choose %d card(s) to restore a legal loadout",
		err.Reason,
		err.Count,
	)
}

func (err *loadoutResolutionError) Unwrap() error {
	return ErrIllegalCommand
}

func reconcileLoadout(state *State, playerIndex int, pack Pack) error {
	player := &state.Players[playerIndex]

	keptAttachments := make([]string, 0, len(player.Attachments))
	for _, instanceID := range player.Attachments {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists {
			return fmt.Errorf("%w: attachment %s", ErrUnknownCard, instanceID)
		}
		if card.Attachment == nil {
			targetID, attached := player.CheatTargets[instanceID]
			if card.Kind != CardCheat ||
				!attached ||
				(!slices.Contains(player.Carried, targetID) &&
					!slices.Contains(player.Equipped, targetID)) {
				return fmt.Errorf(
					"%w: invalid Cheat attachment %s",
					ErrIllegalCommand,
					instanceID,
				)
			}
			target, _, exists := pack.DefinitionForInstance(*state, targetID)
			if !exists || target.Item == nil {
				return fmt.Errorf(
					"%w: Cheat target %s is not an item",
					ErrIllegalCommand,
					targetID,
				)
			}
			keptAttachments = append(keptAttachments, instanceID)
			continue
		}
		count, err := traitCount(*state, *player, card.Attachment.Group, pack)
		if err != nil {
			return err
		}
		if count == 0 {
			if err := appendDiscard(state, instanceID, pack); err != nil {
				return err
			}
			continue
		}
		keptAttachments = append(keptAttachments, instanceID)
	}
	player.Attachments = keptAttachments

	for _, group := range []TraitGroup{TraitClass, TraitRace} {
		count, err := traitCount(*state, *player, group, pack)
		if err != nil {
			return err
		}
		capacity, err := traitCapacity(*state, *player, group, pack)
		if err != nil {
			return err
		}
		if count > capacity {
			var options []string
			for _, instanceID := range player.Traits {
				card, _, exists := pack.DefinitionForInstance(*state, instanceID)
				if !exists || card.Trait == nil {
					return fmt.Errorf("%w: trait %s", ErrUnknownCard, instanceID)
				}
				if card.Trait.Group == group {
					options = append(options, instanceID)
				}
			}
			return &loadoutResolutionError{
				Reason:  fmt.Sprintf("%s trait capacity exceeded", group),
				Options: options,
				Count:   count - capacity,
			}
		}
	}

	keptEquipped := make([]string, 0, len(player.Equipped))
	for _, instanceID := range player.Equipped {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists || card.Item == nil {
			return fmt.Errorf("%w: equipped card is not an item", ErrInvalidContent)
		}
		allowed, err := itemRestrictionsSatisfied(*state, *player, *card.Item, pack)
		if err != nil {
			return err
		}
		if !isCheated(*player, instanceID) && !allowed {
			player.Carried = append(player.Carried, instanceID)
			continue
		}
		keptEquipped = append(keptEquipped, instanceID)
	}
	player.Equipped = keptEquipped

	handsUsed := 0
	usedSlots := make(map[ItemSlot]bool)
	for _, instanceID := range player.Equipped {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists || card.Item == nil {
			return fmt.Errorf("%w: equipped card is not an item", ErrInvalidContent)
		}
		if isCheated(*player, instanceID) {
			continue
		}
		if card.Item.Slot == SlotHands {
			handsUsed += card.Item.Hands
			continue
		}
		if card.Item.Slot != SlotNone {
			if usedSlots[card.Item.Slot] {
				return fmt.Errorf("%w: equipment slot is occupied", ErrIllegalCommand)
			}
			usedSlots[card.Item.Slot] = true
		}
	}
	if handsUsed > 2 {
		return fmt.Errorf("%w: not enough free hands", ErrIllegalCommand)
	}

	bigItems := 0
	for _, instanceID := range append(
		append([]string(nil), player.Carried...),
		player.Equipped...,
	) {
		card, _, exists := pack.DefinitionForInstance(*state, instanceID)
		if !exists || card.Item == nil {
			return fmt.Errorf("%w: carried card is not an item", ErrInvalidContent)
		}
		if card.Item.Size == SizeBig && !isCheated(*player, instanceID) {
			bigItems++
		}
	}
	allowance, err := bigAllowance(*state, playerIndex, pack)
	if err != nil {
		return err
	}
	if bigItems > allowance {
		excess := bigItems - allowance
		var options []string
		for _, instanceID := range append(
			append([]string(nil), player.Carried...),
			player.Equipped...,
		) {
			card, _, exists := pack.DefinitionForInstance(*state, instanceID)
			if !exists || card.Item == nil {
				return fmt.Errorf("%w: Big item %s", ErrUnknownCard, instanceID)
			}
			if card.Item.Size != SizeBig || isCheated(*player, instanceID) {
				continue
			}
			if slices.Contains(player.Equipped, instanceID) &&
				card.Item.BigAllowance > 0 {
				continue
			}
			options = append(options, instanceID)
		}
		if len(options) < excess {
			return fmt.Errorf(
				"%w: Big-item overflow has no legal resolution",
				ErrInvalidContent,
			)
		}
		return &loadoutResolutionError{
			Reason:  "too many Big items",
			Options: options,
			Count:   excess,
		}
	}
	return nil
}

func isCheated(player Player, itemID string) bool {
	for _, targetID := range player.CheatTargets {
		if targetID == itemID {
			return true
		}
	}
	return false
}

func canCarryItem(state State, playerIndex int, instanceID string, pack Pack) error {
	player := state.Players[playerIndex]
	if !slices.Contains(player.Hand, instanceID) {
		return fmt.Errorf("%w: item is not in hand", ErrIllegalCommand)
	}
	card, _, exists := pack.DefinitionForInstance(state, instanceID)
	if !exists || card.Item == nil {
		return fmt.Errorf("%w: card is not an item", ErrIllegalCommand)
	}
	if card.Item.Size != SizeBig {
		return nil
	}
	allowance, err := bigAllowance(state, playerIndex, pack)
	if err != nil {
		return err
	}
	bigItems := 0
	for _, ownedID := range append(
		append([]string(nil), player.Carried...),
		player.Equipped...,
	) {
		owned, _, exists := pack.DefinitionForInstance(state, ownedID)
		if exists &&
			owned.Item != nil &&
			owned.Item.Size == SizeBig &&
			!isCheated(player, ownedID) {
			bigItems++
		}
	}
	if bigItems >= allowance {
		return fmt.Errorf("%w: too many big items", ErrIllegalCommand)
	}
	return nil
}

func canEquip(state State, playerIndex int, instanceID string, pack Pack) error {
	player := state.Players[playerIndex]
	if !slices.Contains(player.Carried, instanceID) {
		return fmt.Errorf("%w: item is not carried", ErrIllegalCommand)
	}
	card, _, exists := pack.DefinitionForInstance(state, instanceID)
	if !exists || card.Item == nil {
		return fmt.Errorf("%w: card is not an item", ErrIllegalCommand)
	}
	if isCheated(player, instanceID) {
		return nil
	}
	allowed, err := itemRestrictionsSatisfied(state, player, *card.Item, pack)
	if err != nil {
		return err
	}
	if !allowed {
		return fmt.Errorf("%w: character does not satisfy item restrictions", ErrIllegalCommand)
	}
	handsUsed := 0
	bigItems := 0
	slotUsed := map[ItemSlot]bool{}
	for _, equippedID := range player.Equipped {
		equipped, _, exists := pack.DefinitionForInstance(state, equippedID)
		if !exists || equipped.Item == nil {
			return fmt.Errorf("%w: equipped non-item", ErrInvalidContent)
		}
		if isCheated(player, equippedID) {
			continue
		}
		if equipped.Item.Slot == SlotHands {
			handsUsed += equipped.Item.Hands
		} else if equipped.Item.Slot != SlotNone {
			slotUsed[equipped.Item.Slot] = true
		}
	}
	for _, ownedID := range append(
		append([]string(nil), player.Carried...),
		player.Equipped...,
	) {
		owned, _, exists := pack.DefinitionForInstance(state, ownedID)
		if exists && owned.Item != nil && owned.Item.Size == SizeBig && !isCheated(player, ownedID) {
			bigItems++
		}
	}
	if card.Item.Slot == SlotHands && handsUsed+card.Item.Hands > 2 {
		return fmt.Errorf("%w: not enough free hands", ErrIllegalCommand)
	}
	if card.Item.Slot != SlotHands &&
		card.Item.Slot != SlotNone &&
		slotUsed[card.Item.Slot] {
		return fmt.Errorf("%w: equipment slot is occupied", ErrIllegalCommand)
	}
	allowance, err := bigAllowance(state, playerIndex, pack)
	if err != nil {
		return err
	}
	if card.Item.Size == SizeBig && bigItems > allowance {
		return fmt.Errorf("%w: too many big items", ErrIllegalCommand)
	}
	return nil
}

func traitCapacity(
	state State,
	player Player,
	group TraitGroup,
	pack Pack,
) (int, error) {
	capacity := 1
	for _, instanceID := range player.Attachments {
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if !exists {
			return 0, fmt.Errorf("%w: attachment %s", ErrUnknownCard, instanceID)
		}
		if card.Attachment != nil && card.Attachment.Group == group {
			capacity += card.Attachment.ExtraTraits
		}
	}
	return capacity, nil
}

func traitCount(state State, player Player, group TraitGroup, pack Pack) (int, error) {
	count := 0
	for _, instanceID := range player.Traits {
		card, _, exists := pack.DefinitionForInstance(state, instanceID)
		if !exists || card.Trait == nil {
			return 0, fmt.Errorf("%w: trait %s", ErrUnknownCard, instanceID)
		}
		if card.Trait.Group == group {
			count++
		}
	}
	return count, nil
}

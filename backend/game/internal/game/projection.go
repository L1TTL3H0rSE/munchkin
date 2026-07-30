package game

import (
	"crypto/sha256"
	"fmt"
	"strconv"
	"time"
)

type CardView struct {
	InstanceID     string     `json:"instance_id"`
	DefinitionID   string     `json:"definition_id"`
	Name           string     `json:"name"`
	Deck           DeckKind   `json:"deck"`
	Kind           CardKind   `json:"kind"`
	CombatStrength int        `json:"combat_strength,omitempty"`
	TreasureCount  int        `json:"treasure_count,omitempty"`
	LevelsReward   int        `json:"levels_reward,omitempty"`
	ItemSlot       ItemSlot   `json:"item_slot,omitempty"`
	ItemSize       ItemSize   `json:"item_size,omitempty"`
	Hands          int        `json:"hands,omitempty"`
	Bonus          int        `json:"bonus,omitempty"`
	Value          int        `json:"value,omitempty"`
	TraitGroup     TraitGroup `json:"trait_group,omitempty"`
	RulesText      string     `json:"rules_text,omitempty"`
	FlavorText     string     `json:"flavor_text,omitempty"`
	Image          string     `json:"image,omitempty"`
	AltText        string     `json:"alt_text,omitempty"`
}

type SelfView struct {
	PlayerID         string     `json:"player_id"`
	Name             string     `json:"name"`
	Level            int        `json:"level"`
	CombatStrength   int        `json:"combat_strength"`
	EscapeBonus      int        `json:"escape_bonus"`
	HandLimit        int        `json:"hand_limit"`
	CharacterTags    []string   `json:"character_tags"`
	Hand             []CardView `json:"hand"`
	Carried          []CardView `json:"carried"`
	Equipped         []CardView `json:"equipped"`
	Traits           []CardView `json:"traits"`
	Attachments      []CardView `json:"attachments"`
	PersistentCurses []CardView `json:"persistent_curses"`
	SetupDone        bool       `json:"setup_done"`
	Dead             bool       `json:"dead"`
	NeedsRedraw      bool       `json:"needs_redraw"`
}

type OtherPlayerView struct {
	PlayerID         string     `json:"player_id"`
	Name             string     `json:"name"`
	Level            int        `json:"level"`
	HandCount        int        `json:"hand_count"`
	Carried          []CardView `json:"carried"`
	Equipped         []CardView `json:"equipped"`
	Traits           []CardView `json:"traits"`
	Attachments      []CardView `json:"attachments"`
	PersistentCurses []CardView `json:"persistent_curses"`
	SetupDone        bool       `json:"setup_done"`
	Dead             bool       `json:"dead"`
}

type CombatView struct {
	PlayerStrength  int  `json:"player_strength"`
	MonsterStrength int  `json:"monster_strength"`
	PlayerWinning   bool `json:"player_winning"`
	TieWins         bool `json:"tie_wins"`
	CombatClosed    bool `json:"combat_closed"`
}

type DecisionView struct {
	Type             string   `json:"type"`
	SourceInstanceID string   `json:"source_instance_id,omitempty"`
	Options          []string `json:"options"`
	Minimum          int      `json:"minimum"`
	Maximum          int      `json:"maximum"`
}

type ActionView struct {
	Type              CommandType    `json:"type"`
	SourceInstanceID  string         `json:"source_instance_id,omitempty"`
	InstanceIDs       []string       `json:"instance_ids,omitempty"`
	TargetInstanceIDs []string       `json:"target_instance_ids,omitempty"`
	Minimum           int            `json:"minimum,omitempty"`
	Maximum           int            `json:"maximum,omitempty"`
	MinimumTotal      int            `json:"minimum_total,omitempty"`
	InstanceValues    map[string]int `json:"instance_values,omitempty"`
	AbilityIndex      int            `json:"ability_index,omitempty"`
}

type TurnView struct {
	PlayerID         string        `json:"player_id"`
	Phase            Phase         `json:"phase"`
	Encounter        *CardView     `json:"encounter,omitempty"`
	Resolving        []CardView    `json:"resolving"`
	Combat           *CombatView   `json:"combat,omitempty"`
	PendingDecision  *DecisionView `json:"pending_decision,omitempty"`
	AvailableActions []ActionView  `json:"available_actions"`
}

type InteractionActionView struct {
	ActionID      string            `json:"action_id"`
	InteractionID string            `json:"interaction_id"`
	Type          InteractionIntent `json:"type"`
}

type InteractionView struct {
	InteractionID          string                   `json:"interaction_id"`
	PublicKind             string                   `json:"public_kind"`
	ParentPhase            Phase                    `json:"parent_phase"`
	PublicSubject          string                   `json:"public_subject"`
	Status                 InteractionWindowStatus  `json:"status"`
	DeadlineAt             time.Time                `json:"deadline_at"`
	ServerTime             *time.Time               `json:"server_time,omitempty"`
	MyResponseState        InteractionResponseState `json:"my_response_state,omitempty"`
	ResponseRequiredForYou bool                     `json:"response_required_for_you"`
	Actions                []InteractionActionView  `json:"actions"`
}

type Projection struct {
	GameID               string            `json:"game_id"`
	Version              uint64            `json:"version"`
	Status               Status            `json:"status"`
	IsOwner              bool              `json:"is_owner"`
	You                  SelfView          `json:"you"`
	Players              []OtherPlayerView `json:"players"`
	Turn                 TurnView          `json:"turn"`
	DoorDeckCount        int               `json:"door_deck_count"`
	DoorDiscardCount     int               `json:"door_discard_count"`
	TreasureDeckCount    int               `json:"treasure_deck_count"`
	TreasureDiscardCount int               `json:"treasure_discard_count"`
	WinnerPlayerID       string            `json:"winner_player_id,omitempty"`
	ContentSetID         string            `json:"content_set_id"`
	ContentVersion       int               `json:"content_version"`
	RulesProfileID       string            `json:"rules_profile_id"`
	RulesProfileVersion  int               `json:"rules_profile_version"`
	Interaction          *InteractionView  `json:"interaction,omitempty"`
}

func ProjectForActor(state State, actorID string, pack Pack) (Projection, error) {
	playerIndex := state.PlayerIndex(actorID)
	if playerIndex < 0 {
		return Projection{}, fmt.Errorf(
			"%w: actor is not a participant",
			ErrIllegalCommand,
		)
	}
	self, err := selfView(state, playerIndex, pack)
	if err != nil {
		return Projection{}, err
	}
	projection := Projection{
		GameID:               state.GameID,
		Version:              state.Version,
		Status:               state.Status,
		IsOwner:              actorID == state.OwnerPlayerID,
		You:                  self,
		DoorDeckCount:        len(state.DoorDeck),
		DoorDiscardCount:     len(state.DoorDiscard),
		TreasureDeckCount:    len(state.TreasureDeck),
		TreasureDiscardCount: len(state.TreasureDiscard),
		WinnerPlayerID:       state.WinnerPlayerID,
		ContentSetID:         state.ContentSetID,
		ContentVersion:       state.ContentVersion,
		RulesProfileID:       state.RulesProfileID,
		RulesProfileVersion:  state.RulesProfileVersion,
		Turn: TurnView{
			PlayerID: state.Turn.PlayerID,
			Phase:    state.Turn.Phase,
		},
	}
	for index, player := range state.Players {
		view, err := otherPlayerView(state, index, player, pack)
		if err != nil {
			return Projection{}, err
		}
		projection.Players = append(projection.Players, view)
	}
	if state.Turn.Encounter != nil {
		view, err := cardViewForInstance(
			state,
			state.Turn.Encounter.MonsterInstanceID,
			pack,
		)
		if err != nil {
			return Projection{}, err
		}
		projection.Turn.Encounter = &view
		if state.Status == StatusActive {
			activeIndex := state.PlayerIndex(state.Turn.PlayerID)
			totals, err := combatTotals(state, activeIndex, pack)
			if err != nil {
				return Projection{}, err
			}
			projection.Turn.Combat = &CombatView{
				PlayerStrength:  totals.PlayerStrength,
				MonsterStrength: totals.MonsterStrength,
				PlayerWinning:   totals.PlayerWins,
				TieWins:         totals.TieWins,
				CombatClosed:    state.Turn.Encounter.CombatClosed,
			}
		}
	}
	projection.Turn.Resolving, err = cardViews(state, state.Turn.Resolving, pack)
	if err != nil {
		return Projection{}, err
	}
	if state.Turn.Pending != nil && state.Turn.Pending.ActorID == actorID {
		projection.Turn.PendingDecision = &DecisionView{
			Type:             state.Turn.Pending.Type,
			SourceInstanceID: state.Turn.Pending.SourceInstanceID,
			Options:          append([]string(nil), state.Turn.Pending.Options...),
			Minimum:          state.Turn.Pending.Minimum,
			Maximum:          state.Turn.Pending.Maximum,
		}
	}
	actions, err := projectActions(state, playerIndex, actorID, pack)
	if err != nil {
		return Projection{}, err
	}
	projection.Turn.AvailableActions = actions
	projection.Interaction = projectInteraction(state, actorID)
	return projection, nil
}

func projectInteraction(state State, actorID string) *InteractionView {
	window := state.InteractionWindow
	if window == nil || window.Status != InteractionWindowOpen {
		return nil
	}
	view := &InteractionView{
		InteractionID: window.ID,
		PublicKind:    "response_window",
		ParentPhase:   window.Parent.Phase,
		PublicSubject: publicInteractionSubject(window.Parent.SubjectKind),
		Status:        window.Status,
		DeadlineAt:    window.DeadlineAt,
		Actions:       []InteractionActionView{},
	}
	response, eligible := window.Responses[actorID]
	if !eligible {
		return view
	}
	view.MyResponseState = response.State
	view.ResponseRequiredForYou = response.State == InteractionResponsePending
	if !view.ResponseRequiredForYou {
		return view
	}
	for _, intent := range window.AllowedIntents {
		if intent == InteractionIntentAutoResolve ||
			(window.EligibilityPolicy == InteractionEligibilityOpaquePublicSet &&
				intent != InteractionIntentPass) {
			continue
		}
		view.Actions = append(view.Actions, InteractionActionView{
			ActionID:      interactionActionID(window.ID, actorID, intent, state.Version),
			InteractionID: window.ID,
			Type:          intent,
		})
	}
	return view
}

func publicInteractionSubject(kind InteractionSubjectKind) string {
	switch kind {
	case InteractionSubjectTurn:
		return "current_turn"
	case InteractionSubjectEncounter:
		return "current_encounter"
	case InteractionSubjectEffect:
		return "current_effect"
	case InteractionSubjectInteraction:
		return "parent_interaction"
	default:
		return "current_context"
	}
}

func interactionActionID(
	interactionID string,
	actorID string,
	intent InteractionIntent,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			string(intent) + "\x00" +
			strconv.FormatUint(version, 10),
	))
	return fmt.Sprintf("act_%x", digest[:16])
}

func selfView(state State, playerIndex int, pack Pack) (SelfView, error) {
	player := state.Players[playerIndex]
	tags, err := characterTags(state, player, pack)
	if err != nil {
		return SelfView{}, err
	}
	escape, err := projectedEscapeBonus(state, playerIndex, pack)
	if err != nil {
		return SelfView{}, err
	}
	limit, err := handLimit(state, playerIndex, pack)
	if err != nil {
		return SelfView{}, err
	}
	strength, err := projectedCombatStrength(state, playerIndex, pack)
	if err != nil {
		return SelfView{}, err
	}
	hand, err := cardViews(state, player.Hand, pack)
	if err != nil {
		return SelfView{}, err
	}
	carried, err := cardViews(state, player.Carried, pack)
	if err != nil {
		return SelfView{}, err
	}
	equipped, err := cardViews(state, player.Equipped, pack)
	if err != nil {
		return SelfView{}, err
	}
	traits, err := cardViews(state, player.Traits, pack)
	if err != nil {
		return SelfView{}, err
	}
	attachments, err := cardViews(state, player.Attachments, pack)
	if err != nil {
		return SelfView{}, err
	}
	curses, err := cardViews(state, player.PersistentCurses, pack)
	if err != nil {
		return SelfView{}, err
	}
	return SelfView{
		PlayerID:         player.ID,
		Name:             player.Name,
		Level:            player.Level,
		CombatStrength:   strength,
		EscapeBonus:      escape,
		HandLimit:        limit,
		CharacterTags:    tags,
		Hand:             hand,
		Carried:          carried,
		Equipped:         equipped,
		Traits:           traits,
		Attachments:      attachments,
		PersistentCurses: curses,
		SetupDone:        player.SetupDone,
		Dead:             player.Dead,
		NeedsRedraw:      player.NeedsRedraw,
	}, nil
}

func otherPlayerView(
	state State,
	_ int,
	player Player,
	pack Pack,
) (OtherPlayerView, error) {
	carried, err := cardViews(state, player.Carried, pack)
	if err != nil {
		return OtherPlayerView{}, err
	}
	equipped, err := cardViews(state, player.Equipped, pack)
	if err != nil {
		return OtherPlayerView{}, err
	}
	traits, err := cardViews(state, player.Traits, pack)
	if err != nil {
		return OtherPlayerView{}, err
	}
	attachments, err := cardViews(state, player.Attachments, pack)
	if err != nil {
		return OtherPlayerView{}, err
	}
	curses, err := cardViews(state, player.PersistentCurses, pack)
	if err != nil {
		return OtherPlayerView{}, err
	}
	return OtherPlayerView{
		PlayerID:         player.ID,
		Name:             player.Name,
		Level:            player.Level,
		HandCount:        len(player.Hand),
		Carried:          carried,
		Equipped:         equipped,
		Traits:           traits,
		Attachments:      attachments,
		PersistentCurses: curses,
		SetupDone:        player.SetupDone,
		Dead:             player.Dead,
	}, nil
}

func projectedCombatStrength(state State, playerIndex int, pack Pack) (int, error) {
	if state.Turn.Encounter != nil && state.Turn.PlayerID == state.Players[playerIndex].ID {
		totals, err := combatTotals(state, playerIndex, pack)
		if err != nil {
			return 0, err
		}
		return totals.PlayerStrength, nil
	}
	player := state.Players[playerIndex]
	total := player.Level
	cards, err := playerDefinitions(state, player, pack, player.Equipped)
	if err != nil {
		return 0, err
	}
	for _, card := range cards {
		if card.Item != nil {
			total += card.Item.Bonus
		}
	}
	modifier, err := activePlayerModifiers(
		state,
		player,
		pack,
		ModifierPlayerCombat,
		nil,
	)
	if err != nil {
		return 0, err
	}
	return total + modifier, nil
}

func projectedEscapeBonus(state State, playerIndex int, pack Pack) (int, error) {
	if state.Turn.Encounter != nil && state.Turn.PlayerID == state.Players[playerIndex].ID {
		return escapeBonus(state, playerIndex, pack)
	}
	player := state.Players[playerIndex]
	total := 0
	cards, err := playerDefinitions(state, player, pack, player.Equipped)
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

func projectActions(
	state State,
	playerIndex int,
	actorID string,
	pack Pack,
) ([]ActionView, error) {
	if state.Status == StatusLobby {
		if actorID == state.OwnerPlayerID {
			profile, err := state.Profile()
			if err != nil {
				return nil, err
			}
			if len(state.Players) >= profile.MinPlayers {
				return []ActionView{{Type: CommandStart}}, nil
			}
		}
		return []ActionView{}, nil
	}
	if state.Status != StatusActive || state.Turn.PlayerID != actorID {
		return []ActionView{}, nil
	}
	if state.Turn.Pending != nil {
		return []ActionView{{
			Type:        CommandChooseEffect,
			InstanceIDs: append([]string(nil), state.Turn.Pending.Options...),
			Minimum:     state.Turn.Pending.Minimum,
			Maximum:     state.Turn.Pending.Maximum,
		}}, nil
	}
	player := state.Players[playerIndex]
	var actions []ActionView
	addManagementActions := func(includeSell bool) error {
		for _, instanceID := range player.Hand {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if !exists {
				return fmt.Errorf("%w: hand card %s", ErrUnknownCard, instanceID)
			}
			if playableInPhase(card, state.Turn.Phase) {
				action := ActionView{
					Type:             CommandPlayCard,
					SourceInstanceID: instanceID,
				}
				if card.Kind == CardCheat {
					for _, targetID := range append(
						append(
							append([]string(nil), player.Hand...),
							player.Carried...,
						),
						player.Equipped...,
					) {
						target, _, exists := pack.DefinitionForInstance(state, targetID)
						if exists &&
							target.Item != nil &&
							!isCheated(player, targetID) &&
							commandIsLegal(state, pack, Command{
								Type:             CommandPlayCard,
								ActorID:          actorID,
								InstanceID:       instanceID,
								TargetInstanceID: targetID,
							}) {
							action.TargetInstanceIDs = append(
								action.TargetInstanceIDs,
								targetID,
							)
						}
					}
					if len(action.TargetInstanceIDs) == 0 {
						continue
					}
				} else if !commandIsLegal(state, pack, Command{
					Type:       CommandPlayCard,
					ActorID:    actorID,
					InstanceID: instanceID,
				}) {
					continue
				}
				actions = append(actions, action)
			}
		}
		for _, instanceID := range player.Carried {
			if commandIsLegal(state, pack, Command{
				Type:       CommandEquipItem,
				ActorID:    actorID,
				InstanceID: instanceID,
			}) {
				actions = append(actions, ActionView{
					Type:             CommandEquipItem,
					SourceInstanceID: instanceID,
				})
			}
		}
		for _, instanceID := range player.Equipped {
			if commandIsLegal(state, pack, Command{
				Type:       CommandUnequipItem,
				ActorID:    actorID,
				InstanceID: instanceID,
			}) {
				actions = append(actions, ActionView{
					Type:             CommandUnequipItem,
					SourceInstanceID: instanceID,
				})
			}
		}
		for _, instanceID := range append(
			append([]string(nil), player.Traits...),
			player.Attachments...,
		) {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if exists &&
				(card.Kind == CardClass ||
					card.Kind == CardRace ||
					card.Kind == CardTraitAttachment) &&
				commandIsLegal(state, pack, Command{
					Type:       CommandDiscardCard,
					ActorID:    actorID,
					InstanceID: instanceID,
				}) {
				actions = append(actions, ActionView{
					Type:             CommandDiscardCard,
					SourceInstanceID: instanceID,
				})
			}
		}
		if includeSell {
			var sellable []string
			instanceValues := make(map[string]int)
			totalValue := 0
			for _, instanceID := range append(
				append(
					append([]string(nil), player.Hand...),
					player.Carried...,
				),
				player.Equipped...,
			) {
				card, _, exists := pack.DefinitionForInstance(state, instanceID)
				if exists && card.Item != nil {
					sellable = append(sellable, instanceID)
					instanceValues[instanceID] = card.Item.Value
					totalValue += card.Item.Value
				}
			}
			profile, err := state.Profile()
			if err != nil {
				return err
			}
			if totalValue >= SaleLevelCost &&
				player.Level < profile.WinningLevel-1 {
				actions = append(actions, ActionView{
					Type:           CommandSellItems,
					InstanceIDs:    sellable,
					Minimum:        1,
					Maximum:        len(sellable),
					MinimumTotal:   SaleLevelCost,
					InstanceValues: instanceValues,
				})
			}
		}
		return nil
	}
	switch state.Turn.Phase {
	case PhaseSetup:
		if err := addManagementActions(false); err != nil {
			return nil, err
		}
		actions = append(actions, ActionView{Type: CommandFinishSetup})
	case PhasePreparation:
		if err := addManagementActions(true); err != nil {
			return nil, err
		}
		actions = append(actions, ActionView{Type: CommandOpenDoor})
	case PhaseDoorChoice:
		for _, instanceID := range player.Hand {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if exists && card.Monster != nil {
				actions = append(actions, ActionView{
					Type:             CommandLookForTrouble,
					SourceInstanceID: instanceID,
				})
			}
		}
		actions = append(actions, ActionView{Type: CommandLootRoom})
	case PhaseCombat:
		for _, instanceID := range player.Hand {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if exists && card.Kind == CardOneShot {
				actions = append(actions, ActionView{
					Type:             CommandPlayCard,
					SourceInstanceID: instanceID,
				})
			}
		}
		for _, sourceID := range append(
			append([]string(nil), player.Traits...),
			player.Equipped...,
		) {
			card, _, exists := pack.DefinitionForInstance(state, sourceID)
			if !exists {
				continue
			}
			for abilityIndex, ability := range card.Abilities {
				if ability.Kind == AbilityDiscardForCombat &&
					len(player.Hand) >= ability.DiscardCount {
					actions = append(actions, ActionView{
						Type:             CommandUseAbility,
						SourceInstanceID: sourceID,
						InstanceIDs:      append([]string(nil), player.Hand...),
						Minimum:          ability.DiscardCount,
						Maximum:          ability.DiscardCount,
						AbilityIndex:     abilityIndex,
					})
				}
			}
		}
		actions = append(actions, ActionView{Type: CommandResolveCombat})
	case PhaseRunAway:
		actions = append(actions, ActionView{Type: CommandRunAway})
	case PhaseCharity:
		if err := addManagementActions(true); err != nil {
			return nil, err
		}
		limit, err := handLimit(state, playerIndex, pack)
		if err != nil {
			return nil, err
		}
		excess := max(0, len(player.Hand)-limit)
		actions = append(actions, ActionView{
			Type:        CommandResolveCharity,
			InstanceIDs: append([]string(nil), player.Hand...),
			Minimum:     excess,
			Maximum:     excess,
		})
	case PhaseEndTurn:
		actions = append(actions, ActionView{Type: CommandEndTurn})
	}
	return actions, nil
}

func commandIsLegal(state State, pack Pack, command Command) bool {
	events, err := Handle(state, command, pack)
	return err == nil && len(events) > 0
}

func playableInPhase(card Card, phase Phase) bool {
	switch phase {
	case PhaseSetup, PhasePreparation, PhaseCharity:
		return card.Kind == CardItem ||
			card.Kind == CardClass ||
			card.Kind == CardRace ||
			card.Kind == CardTraitAttachment ||
			card.Kind == CardCheat ||
			card.Kind == CardCurse ||
			card.Kind == CardLevelUp
	case PhaseCombat:
		return card.Kind == CardOneShot
	default:
		return false
	}
}

func cardViews(state State, instanceIDs []string, pack Pack) ([]CardView, error) {
	views := make([]CardView, 0, len(instanceIDs))
	for _, instanceID := range instanceIDs {
		view, err := cardViewForInstance(state, instanceID, pack)
		if err != nil {
			return nil, err
		}
		views = append(views, view)
	}
	return views, nil
}

func cardViewForInstance(state State, instanceID string, pack Pack) (CardView, error) {
	card, instance, exists := pack.DefinitionForInstance(state, instanceID)
	if !exists {
		return CardView{}, fmt.Errorf("%w: instance %s", ErrUnknownCard, instanceID)
	}
	view := CardView{
		InstanceID:   instance.ID,
		DefinitionID: instance.DefinitionID,
		Name:         card.Name,
		Deck:         card.Deck,
		Kind:         card.Kind,
		RulesText:    card.RulesText,
		FlavorText:   card.FlavorText,
		Image:        card.Image,
		AltText:      card.AltText,
	}
	if card.Monster != nil {
		view.CombatStrength = card.Monster.Strength
		view.TreasureCount = card.Monster.Treasures
		view.LevelsReward = card.Monster.Levels
	}
	if card.Item != nil {
		view.ItemSlot = card.Item.Slot
		view.ItemSize = card.Item.Size
		view.Hands = card.Item.Hands
		view.Bonus = card.Item.Bonus
		view.Value = card.Item.Value
	}
	if card.Trait != nil {
		view.TraitGroup = card.Trait.Group
	}
	return view, nil
}

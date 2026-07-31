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
	PlayerStrength        int                         `json:"player_strength"`
	MonsterStrength       int                         `json:"monster_strength"`
	PlayerWinning         bool                        `json:"player_winning"`
	TieWins               bool                        `json:"tie_wins"`
	CombatClosed          bool                        `json:"combat_closed"`
	Monsters              []CardView                  `json:"monsters"`
	Effects               []CombatEffectView          `json:"effects"`
	HelperPlayerID        string                      `json:"helper_player_id,omitempty"`
	HelperRewardTreasures int                         `json:"helper_reward_treasures,omitempty"`
	HelperForced          bool                        `json:"helper_forced,omitempty"`
	ResolutionAction      *CombatResolutionActionView `json:"resolution_action,omitempty"`
}

type CombatEffectView struct {
	EffectID                string               `json:"effect_id"`
	Kind                    CombatCapabilityKind `json:"kind"`
	TargetMonsterInstanceID string               `json:"target_monster_instance_id,omitempty"`
	TargetEffectID          string               `json:"target_effect_id,omitempty"`
	Amount                  int                  `json:"amount,omitempty"`
	Active                  bool                 `json:"active"`
}

type CombatResolutionActionView struct {
	Type CommandType `json:"type"`
}

type DecisionView struct {
	Type             string   `json:"type"`
	SourceInstanceID string   `json:"source_instance_id,omitempty"`
	Options          []string `json:"options"`
	Minimum          int      `json:"minimum"`
	Maximum          int      `json:"maximum"`
}

type ActionView struct {
	Type                 CommandType    `json:"type"`
	SourceInstanceID     string         `json:"source_instance_id,omitempty"`
	InstanceIDs          []string       `json:"instance_ids,omitempty"`
	TargetInstanceIDs    []string       `json:"target_instance_ids,omitempty"`
	RequestedInstanceIDs []string       `json:"requested_instance_ids,omitempty"`
	TargetPlayerIDs      []string       `json:"target_player_ids,omitempty"`
	Minimum              int            `json:"minimum,omitempty"`
	Maximum              int            `json:"maximum,omitempty"`
	MinimumTotal         int            `json:"minimum_total,omitempty"`
	InstanceValues       map[string]int `json:"instance_values,omitempty"`
	AbilityIndex         int            `json:"ability_index,omitempty"`
}

type TurnView struct {
	PlayerID         string        `json:"player_id"`
	Phase            Phase         `json:"phase"`
	Encounter        *CardView     `json:"encounter,omitempty"`
	Resolving        []CardView    `json:"resolving"`
	Combat           *CombatView   `json:"combat,omitempty"`
	PendingDecision  *DecisionView `json:"pending_decision,omitempty"`
	RunAway          *RunAwayView  `json:"run_away,omitempty"`
	AvailableActions []ActionView  `json:"available_actions"`
}

type InteractionActionView struct {
	ActionID                string               `json:"action_id"`
	InteractionID           string               `json:"interaction_id"`
	Revision                uint32               `json:"revision"`
	Type                    InteractionIntent    `json:"type"`
	SourceInstanceID        string               `json:"source_instance_id,omitempty"`
	Target                  EffectTarget         `json:"target,omitempty"`
	CombatDelta             int                  `json:"combat_delta,omitempty"`
	CombatCapability        CombatCapabilityKind `json:"combat_capability,omitempty"`
	TheftCapability         TheftCapabilityKind  `json:"theft_capability,omitempty"`
	TargetMonsterInstanceID string               `json:"target_monster_instance_id,omitempty"`
	TargetEffectID          string               `json:"target_effect_id,omitempty"`
	HelperPlayerID          string               `json:"helper_player_id,omitempty"`
	RewardTreasures         int                  `json:"reward_treasures,omitempty"`
	ChoiceIDs               []string             `json:"choice_ids,omitempty"`
	EscapeDelta             int                  `json:"escape_delta,omitempty"`
}

type RunAwayEffectView struct {
	EffectID       string            `json:"effect_id"`
	Kind           RunAwayEffectKind `json:"kind"`
	TargetEffectID string            `json:"target_effect_id,omitempty"`
	Amount         int               `json:"amount,omitempty"`
	Active         bool              `json:"active"`
}

type RunAwayAttemptView struct {
	PlayerID          string `json:"player_id"`
	MonsterInstanceID string `json:"monster_instance_id"`
	Roll              int    `json:"roll,omitempty"`
	Modifier          int    `json:"modifier"`
	Total             int    `json:"total,omitempty"`
	Escaped           bool   `json:"escaped"`
	Automatic         bool   `json:"automatic,omitempty"`
	BadStuffApplied   bool   `json:"bad_stuff_applied,omitempty"`
}

type RunAwayView struct {
	CurrentPlayerID          string               `json:"current_player_id,omitempty"`
	CurrentMonsterInstanceID string               `json:"current_monster_instance_id,omitempty"`
	Effects                  []RunAwayEffectView  `json:"effects"`
	Attempts                 []RunAwayAttemptView `json:"attempts"`
	Completed                bool                 `json:"completed"`
}

type CombatHelpOfferView struct {
	HelperPlayerID  string `json:"helper_player_id"`
	RewardTreasures int    `json:"reward_treasures"`
}

type EconomyOfferView struct {
	Kind              EconomyOfferKind `json:"kind"`
	OffererPlayerID   string           `json:"offerer_player_id"`
	RecipientPlayerID string           `json:"recipient_player_id"`
	Offered           []CardView       `json:"offered"`
	Requested         []CardView       `json:"requested"`
}

type CharityTransferView struct {
	Excess               int      `json:"excess"`
	InstanceIDs          []string `json:"instance_ids"`
	EligibleRecipientIDs []string `json:"eligible_recipient_ids"`
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
	CombatHelpOffer        *CombatHelpOfferView     `json:"combat_help_offer,omitempty"`
	TargetPlayerID         string                   `json:"target_player_id,omitempty"`
	EconomyOffer           *EconomyOfferView        `json:"economy_offer,omitempty"`
	CharityTransfer        *CharityTransferView     `json:"charity_transfer,omitempty"`
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
			combat := &CombatView{
				PlayerStrength:  totals.PlayerStrength,
				MonsterStrength: totals.MonsterStrength,
				PlayerWinning:   totals.PlayerWins,
				TieWins:         totals.TieWins,
				CombatClosed:    state.Turn.Encounter.CombatClosed,
				Monsters:        []CardView{},
				Effects:         []CombatEffectView{},
			}
			for _, instanceID := range encounterMonsterInstanceIDs(
				*state.Turn.Encounter,
			) {
				monsterView, err := cardViewForInstance(
					state,
					instanceID,
					pack,
				)
				if err != nil {
					return Projection{}, err
				}
				combat.Monsters = append(combat.Monsters, monsterView)
			}
			for _, effect := range state.Turn.Encounter.CombatEffects {
				combat.Effects = append(combat.Effects, CombatEffectView{
					EffectID:                effect.ID,
					Kind:                    effect.Kind,
					TargetMonsterInstanceID: effect.TargetMonsterInstanceID,
					TargetEffectID:          effect.TargetEffectID,
					Amount:                  effect.Amount,
					Active:                  effect.Active,
				})
			}
			if help := state.Turn.Encounter.CombatHelp; help != nil {
				combat.HelperPlayerID = help.HelperPlayerID
				combat.HelperRewardTreasures = help.RewardTreasures
				combat.HelperForced = help.Forced
			}
			profile, err := state.Profile()
			if err != nil {
				return Projection{}, err
			}
			if profile.CombatResponses &&
				actorID == state.Turn.PlayerID &&
				(state.InteractionWindow == nil ||
					state.InteractionWindow.Status != InteractionWindowOpen) {
				combat.ResolutionAction = &CombatResolutionActionView{
					Type: CommandRequestCombatResolution,
				}
			}
			projection.Turn.Combat = combat
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
	if state.Turn.RunAway != nil {
		runAway := &RunAwayView{
			Effects:   []RunAwayEffectView{},
			Attempts:  []RunAwayAttemptView{},
			Completed: state.Turn.RunAway.Completed,
		}
		if !state.Turn.RunAway.Completed {
			runAway.CurrentPlayerID =
				state.Turn.RunAway.ParticipantPlayerIDs[state.Turn.RunAway.ParticipantIndex]
			runAway.CurrentMonsterInstanceID =
				state.Turn.RunAway.MonsterInstanceIDs[state.Turn.RunAway.MonsterIndex]
		}
		for _, effect := range state.Turn.RunAway.Effects {
			runAway.Effects = append(runAway.Effects, RunAwayEffectView{
				EffectID:       effect.ID,
				Kind:           effect.Kind,
				TargetEffectID: effect.TargetEffectID,
				Amount:         effect.Amount,
				Active:         effect.Active,
			})
		}
		for _, attempt := range state.Turn.RunAway.Attempts {
			runAway.Attempts = append(runAway.Attempts, RunAwayAttemptView{
				PlayerID:          attempt.PlayerID,
				MonsterInstanceID: attempt.MonsterInstanceID,
				Roll:              attempt.Roll,
				Modifier:          attempt.Modifier,
				Total:             attempt.Total,
				Escaped:           attempt.Escaped,
				Automatic:         attempt.Automatic,
				BadStuffApplied:   attempt.BadStuffApplied,
			})
		}
		projection.Turn.RunAway = runAway
	}
	actions, err := projectActions(state, playerIndex, actorID, pack)
	if err != nil {
		return Projection{}, err
	}
	projection.Turn.AvailableActions = actions
	projection.Interaction, err = projectInteraction(state, actorID, pack)
	if err != nil {
		return Projection{}, err
	}
	return projection, nil
}

func projectInteraction(
	state State,
	actorID string,
	pack Pack,
) (*InteractionView, error) {
	window := state.InteractionWindow
	if window == nil || window.Status != InteractionWindowOpen {
		return nil, nil
	}
	if state.CombatHelpOffer != nil &&
		state.SuspendedInteractionWindow != nil &&
		window.ID == state.CombatHelpOffer.ID {
		offer := state.CombatHelpOffer
		if actorID != offer.CombatantPlayerID &&
			actorID != offer.HelperPlayerID {
			parent := state.SuspendedInteractionWindow
			view := &InteractionView{
				InteractionID: parent.ID,
				PublicKind:    "combat_response",
				ParentPhase:   parent.Parent.Phase,
				PublicSubject: publicInteractionSubject(
					parent.Parent.SubjectKind,
				),
				Status:     parent.Status,
				DeadlineAt: parent.DeadlineAt,
				Actions:    []InteractionActionView{},
			}
			if response, ok := parent.Responses[actorID]; ok {
				view.MyResponseState = response.State
			}
			return view, nil
		}
	}
	publicKind := "response_window"
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	domainCombatResponse := profile.CombatResponses &&
		window.Kind == InteractionKindCombatResponse &&
		window.Parent.SubjectKind == InteractionSubjectEncounter
	if domainCombatResponse {
		publicKind = "combat_response"
	}
	domainCombatHelp := state.CombatHelpOffer != nil &&
		state.SuspendedInteractionWindow != nil &&
		window.ID == state.CombatHelpOffer.ID
	if domainCombatHelp {
		publicKind = "combat_help_offer"
	}
	domainTargetResponse := profile.TargetAndRunAway &&
		window.Kind == InteractionKindTargetResponse &&
		state.Turn.TargetEffect != nil
	if domainTargetResponse {
		publicKind = "target_response"
	}
	domainRunAwayResponse := profile.TargetAndRunAway &&
		window.Kind == InteractionKindRunAwayResponse &&
		state.Turn.RunAway != nil
	if domainRunAwayResponse {
		publicKind = "run_away_response"
	}
	domainPrivateChoice := profile.TargetAndRunAway &&
		window.Kind == InteractionKindPrivateChoice &&
		state.Turn.Pending != nil
	if domainPrivateChoice {
		publicKind = "private_choice"
	}
	domainEconomyOffer := profile.PlayerEconomy &&
		window.Kind == InteractionKindEconomyOffer &&
		state.EconomyOffer != nil
	if domainEconomyOffer {
		publicKind = "economy_offer"
	}
	domainCharityTransfer := profile.PlayerEconomy &&
		window.Kind == InteractionKindCharityTransfer &&
		state.CharityTransfer != nil &&
		!state.CharityTransfer.Completed
	if domainCharityTransfer {
		publicKind = "charity_transfer"
	}
	domainTheftResponse := profile.Theft &&
		window.Kind == InteractionKindTheftResponse &&
		state.TheftAttempt != nil
	if domainTheftResponse {
		publicKind = "theft_response"
	}
	view := &InteractionView{
		InteractionID: window.ID,
		PublicKind:    publicKind,
		ParentPhase:   window.Parent.Phase,
		PublicSubject: publicInteractionSubject(window.Parent.SubjectKind),
		Status:        window.Status,
		DeadlineAt:    window.DeadlineAt,
		Actions:       []InteractionActionView{},
	}
	if domainTargetResponse {
		view.TargetPlayerID = state.Turn.TargetEffect.TargetPlayerID
	}
	if domainEconomyOffer {
		offer := state.EconomyOffer
		if actorID == offer.OffererPlayerID ||
			actorID == offer.RecipientPlayerID {
			offered, err := cardViews(
				state,
				offer.OfferedInstanceIDs,
				pack,
			)
			if err != nil {
				return nil, err
			}
			requested, err := cardViews(
				state,
				offer.RequestedInstanceIDs,
				pack,
			)
			if err != nil {
				return nil, err
			}
			view.EconomyOffer = &EconomyOfferView{
				Kind:              offer.Kind,
				OffererPlayerID:   offer.OffererPlayerID,
				RecipientPlayerID: offer.RecipientPlayerID,
				Offered:           offered,
				Requested:         requested,
			}
		}
		if actorID == offer.OffererPlayerID {
			view.Actions = append(
				view.Actions,
				InteractionActionView{
					ActionID: interactionActionID(
						window.ID,
						actorID,
						InteractionIntentCancelOffer,
						"",
						"",
						state.Version,
					),
					InteractionID: window.ID,
					Revision:      window.DeadlineRevision,
					Type:          InteractionIntentCancelOffer,
				},
			)
			return view, nil
		}
	}
	if domainCharityTransfer &&
		actorID == state.CharityTransfer.AllocatorPlayerID {
		view.CharityTransfer = &CharityTransferView{
			Excess: state.CharityTransfer.Excess,
			InstanceIDs: append(
				[]string(nil),
				state.CharityTransfer.StableHandOrder...,
			),
			EligibleRecipientIDs: append(
				[]string(nil),
				state.CharityTransfer.EligibleRecipientIDs...,
			),
		}
	}
	if domainCombatHelp {
		offer := state.CombatHelpOffer
		view.CombatHelpOffer = &CombatHelpOfferView{
			HelperPlayerID:  offer.HelperPlayerID,
			RewardTreasures: offer.RewardTreasures,
		}
		if actorID == offer.CombatantPlayerID {
			view.Actions = append(view.Actions, InteractionActionView{
				ActionID: combatHelpActionID(
					window.ID,
					actorID,
					InteractionIntentCancelHelp,
					"",
					0,
					state.Version,
				),
				InteractionID: window.ID,
				Revision:      window.DeadlineRevision,
				Type:          InteractionIntentCancelHelp,
			})
			actions, err := projectCombatHelpOfferActions(
				state,
				actorID,
				window.ID,
				window.DeadlineRevision,
				pack,
			)
			if err != nil {
				return nil, err
			}
			view.Actions = append(view.Actions, actions...)
			return view, nil
		}
	}
	if domainCombatResponse &&
		actorID == window.InitiatorActorID &&
		state.Turn.Encounter != nil &&
		state.Turn.Encounter.CombatHelp == nil {
		actions, err := projectCombatHelpOfferActions(
			state,
			actorID,
			window.ID,
			window.DeadlineRevision,
			pack,
		)
		if err != nil {
			return nil, err
		}
		view.Actions = append(view.Actions, actions...)
	}
	response, eligible := window.Responses[actorID]
	if !eligible {
		return view, nil
	}
	view.MyResponseState = response.State
	view.ResponseRequiredForYou = response.State == InteractionResponsePending
	if !view.ResponseRequiredForYou {
		return view, nil
	}
	if domainPrivateChoice {
		if actorID != state.Turn.Pending.ActorID {
			return view, nil
		}
		for _, choiceIDs := range privateChoiceSelections(
			state.Turn.Pending.Options,
			state.Turn.Pending.Minimum,
			state.Turn.Pending.Maximum,
		) {
			view.Actions = append(view.Actions, InteractionActionView{
				ActionID: choiceInteractionActionID(
					window.ID,
					actorID,
					choiceIDs,
					state.Version,
				),
				InteractionID: window.ID,
				Revision:      window.DeadlineRevision,
				Type:          InteractionIntentRespond,
				ChoiceIDs:     choiceIDs,
			})
		}
		return view, nil
	}
	if domainCharityTransfer {
		return view, nil
	}
	if domainTheftResponse {
		playerIndex := state.PlayerIndex(actorID)
		for _, instanceID := range state.Players[playerIndex].Hand {
			card, _, exists := pack.DefinitionForInstance(
				state,
				instanceID,
			)
			if !exists {
				return nil, fmt.Errorf(
					"%w: theft counter source %s",
					ErrUnknownCard,
					instanceID,
				)
			}
			if card.TheftCapability == nil ||
				card.TheftCapability.Kind != TheftCapabilityCounter {
				continue
			}
			view.Actions = append(view.Actions, InteractionActionView{
				ActionID: theftInteractionActionID(
					window.ID,
					actorID,
					instanceID,
					card.TheftCapability.Kind,
					state.Version,
				),
				InteractionID:    window.ID,
				Revision:         window.DeadlineRevision,
				Type:             InteractionIntentRespond,
				SourceInstanceID: instanceID,
				TheftCapability:  card.TheftCapability.Kind,
			})
		}
	}
	if domainTargetResponse &&
		!state.Turn.TargetEffect.Countered {
		playerIndex := state.PlayerIndex(actorID)
		for _, instanceID := range state.Players[playerIndex].Hand {
			card, _, exists := pack.DefinitionForInstance(
				state,
				instanceID,
			)
			if !exists {
				return nil, fmt.Errorf(
					"%w: target counter source %s",
					ErrUnknownCard,
					instanceID,
				)
			}
			if card.CombatCapability == nil ||
				card.CombatCapability.Kind != CombatCapabilityCounter {
				continue
			}
			view.Actions = append(view.Actions, InteractionActionView{
				ActionID: advancedCombatActionID(
					window.ID,
					actorID,
					instanceID,
					CombatCapabilityCounter,
					state.Turn.TargetEffect.ID,
					state.Version,
				),
				InteractionID:    window.ID,
				Revision:         window.DeadlineRevision,
				Type:             InteractionIntentRespond,
				SourceInstanceID: instanceID,
				CombatCapability: CombatCapabilityCounter,
				TargetEffectID:   state.Turn.TargetEffect.ID,
			})
		}
	}
	if domainRunAwayResponse {
		sequence, playerIndex, _, err := currentRunAwayStep(state)
		if err != nil {
			return nil, err
		}
		actorIndex := state.PlayerIndex(actorID)
		for _, instanceID := range state.Players[actorIndex].Hand {
			card, _, exists := pack.DefinitionForInstance(
				state,
				instanceID,
			)
			if !exists {
				return nil, fmt.Errorf(
					"%w: Run Away response source %s",
					ErrUnknownCard,
					instanceID,
				)
			}
			if actorIndex == playerIndex {
				if effect, legal := runAwayModifierEffect(card); legal {
					view.Actions = append(
						view.Actions,
						InteractionActionView{
							ActionID: runAwayActionID(
								window.ID,
								actorID,
								instanceID,
								"",
								effect.Amount,
								state.Version,
							),
							InteractionID:    window.ID,
							Revision:         window.DeadlineRevision,
							Type:             InteractionIntentRespond,
							SourceInstanceID: instanceID,
							EscapeDelta:      effect.Amount,
						},
					)
				}
			}
			if card.CombatCapability == nil ||
				card.CombatCapability.Kind != CombatCapabilityCounter {
				continue
			}
			for _, effect := range sequence.Effects {
				if effect.Kind != RunAwayEffectModifier || !effect.Active {
					continue
				}
				view.Actions = append(view.Actions, InteractionActionView{
					ActionID: runAwayActionID(
						window.ID,
						actorID,
						instanceID,
						effect.ID,
						0,
						state.Version,
					),
					InteractionID:    window.ID,
					Revision:         window.DeadlineRevision,
					Type:             InteractionIntentRespond,
					SourceInstanceID: instanceID,
					CombatCapability: CombatCapabilityCounter,
					TargetEffectID:   effect.ID,
				})
			}
		}
	}
	for _, intent := range window.AllowedIntents {
		if intent == InteractionIntentAutoResolve {
			continue
		}
		if intent == InteractionIntentRespond && domainCombatResponse {
			playerIndex := state.PlayerIndex(actorID)
			for _, instanceID := range state.Players[playerIndex].Hand {
				card, _, exists := pack.DefinitionForInstance(
					state,
					instanceID,
				)
				if !exists {
					return nil, fmt.Errorf(
						"%w: interaction source %s",
						ErrUnknownCard,
						instanceID,
					)
				}
				if profile.AdvancedCombat &&
					card.CombatCapability != nil {
					actions, err := projectAdvancedCombatActions(
						state,
						actorID,
						instanceID,
						*card.CombatCapability,
					)
					if err != nil {
						return nil, err
					}
					view.Actions = append(view.Actions, actions...)
					continue
				}
				effect, legal := combatInterventionEffect(card)
				if legal {
					view.Actions = append(view.Actions, InteractionActionView{
						ActionID: interactionActionID(
							window.ID,
							actorID,
							intent,
							instanceID,
							effect.Target,
							state.Version,
						),
						InteractionID:    window.ID,
						Revision:         window.DeadlineRevision,
						Type:             intent,
						SourceInstanceID: instanceID,
						Target:           effect.Target,
						CombatDelta:      effect.Amount,
					})
				}
			}
			continue
		}
		if window.EligibilityPolicy == InteractionEligibilityOpaquePublicSet &&
			intent != InteractionIntentPass {
			continue
		}
		view.Actions = append(view.Actions, InteractionActionView{
			ActionID: interactionActionID(
				window.ID,
				actorID,
				intent,
				"",
				"",
				state.Version,
			),
			InteractionID: window.ID,
			Revision:      window.DeadlineRevision,
			Type:          intent,
		})
	}
	return view, nil
}

func projectAdvancedCombatActions(
	state State,
	actorID string,
	sourceInstanceID string,
	capability CombatCapability,
) ([]InteractionActionView, error) {
	window := state.InteractionWindow
	if window == nil || state.Turn.Encounter == nil {
		return nil, fmt.Errorf(
			"%w: advanced combat projection lacks context",
			ErrIllegalCommand,
		)
	}
	build := func(
		targetMonsterInstanceID string,
		targetEffectID string,
		helperPlayerID string,
	) InteractionActionView {
		targetKey := targetMonsterInstanceID + "\x00" +
			targetEffectID + "\x00" +
			helperPlayerID
		return InteractionActionView{
			ActionID: advancedCombatActionID(
				window.ID,
				actorID,
				sourceInstanceID,
				capability.Kind,
				targetKey,
				state.Version,
			),
			InteractionID:           window.ID,
			Revision:                window.DeadlineRevision,
			Type:                    InteractionIntentRespond,
			SourceInstanceID:        sourceInstanceID,
			CombatCapability:        capability.Kind,
			TargetMonsterInstanceID: targetMonsterInstanceID,
			TargetEffectID:          targetEffectID,
			HelperPlayerID:          helperPlayerID,
			CombatDelta:             capability.Amount,
		}
	}
	switch capability.Kind {
	case CombatCapabilityAddMonster:
		return []InteractionActionView{build("", "", "")}, nil
	case CombatCapabilityEnhance:
		instanceIDs := encounterMonsterInstanceIDs(*state.Turn.Encounter)
		actions := make([]InteractionActionView, 0, len(instanceIDs))
		for _, instanceID := range instanceIDs {
			actions = append(actions, build(instanceID, "", ""))
		}
		return actions, nil
	case CombatCapabilityCounter:
		actions := make([]InteractionActionView, 0)
		for _, effect := range state.Turn.Encounter.CombatEffects {
			if effect.Kind == CombatCapabilityEnhance && effect.Active {
				actions = append(actions, build("", effect.ID, ""))
			}
		}
		return actions, nil
	case CombatCapabilityForceHelper:
		if state.Turn.Encounter.CombatHelp != nil {
			return []InteractionActionView{}, nil
		}
		actions := make([]InteractionActionView, 0)
		for _, player := range state.Players {
			if player.ID == state.Turn.PlayerID || player.Dead {
				continue
			}
			actions = append(actions, build("", "", player.ID))
		}
		return actions, nil
	default:
		return nil, fmt.Errorf(
			"%w: unknown advanced combat capability",
			ErrInvalidContent,
		)
	}
}

func projectCombatHelpOfferActions(
	state State,
	actorID string,
	interactionID string,
	revision uint32,
	pack Pack,
) ([]InteractionActionView, error) {
	maxReward, err := combatHelpRewardMaximumSelected(state, pack)
	if err != nil {
		return nil, err
	}
	actions := make([]InteractionActionView, 0)
	for _, player := range state.Players {
		if player.ID == state.Turn.PlayerID || player.Dead {
			continue
		}
		for reward := 1; reward <= maxReward; reward++ {
			actions = append(actions, InteractionActionView{
				ActionID: combatHelpActionID(
					interactionID,
					actorID,
					InteractionIntentOfferHelp,
					player.ID,
					reward,
					state.Version,
				),
				InteractionID:   interactionID,
				Revision:        revision,
				Type:            InteractionIntentOfferHelp,
				HelperPlayerID:  player.ID,
				RewardTreasures: reward,
			})
		}
	}
	return actions, nil
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
	sourceInstanceID string,
	target EffectTarget,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			string(intent) + "\x00" +
			sourceInstanceID + "\x00" +
			string(target) + "\x00" +
			strconv.FormatUint(version, 10),
	))
	return fmt.Sprintf("act_%x", digest[:16])
}

func advancedCombatActionID(
	interactionID string,
	actorID string,
	sourceInstanceID string,
	capability CombatCapabilityKind,
	targetKey string,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			sourceInstanceID + "\x00" +
			string(capability) + "\x00" +
			targetKey + "\x00" +
			strconv.FormatUint(version, 10),
	))
	return fmt.Sprintf("act_%x", digest[:16])
}

func theftInteractionActionID(
	interactionID string,
	actorID string,
	sourceInstanceID string,
	capability TheftCapabilityKind,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			sourceInstanceID + "\x00" +
			string(capability) + "\x00" +
			strconv.FormatUint(version, 10),
	))
	return fmt.Sprintf("act_%x", digest[:16])
}

func privateChoiceSelections(
	options []string,
	minimum int,
	maximum int,
) [][]string {
	if minimum < 0 ||
		maximum < minimum ||
		maximum > len(options) {
		return nil
	}
	const maximumProjectedChoices = 256
	selections := make([][]string, 0)
	var visit func(start int, remaining int, current []string)
	visit = func(start int, remaining int, current []string) {
		if len(selections) >= maximumProjectedChoices {
			return
		}
		if remaining == 0 {
			selections = append(
				selections,
				append([]string(nil), current...),
			)
			return
		}
		for index := start; index <= len(options)-remaining; index++ {
			visit(
				index+1,
				remaining-1,
				append(current, options[index]),
			)
		}
	}
	for count := minimum; count <= maximum; count++ {
		visit(0, count, nil)
	}
	return selections
}

func choiceInteractionActionID(
	interactionID string,
	actorID string,
	choiceIDs []string,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			fmt.Sprintf("%q", choiceIDs) + "\x00" +
			strconv.FormatUint(version, 10),
	))
	return fmt.Sprintf("act_%x", digest[:16])
}

func runAwayActionID(
	interactionID string,
	actorID string,
	sourceInstanceID string,
	targetEffectID string,
	amount int,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			sourceInstanceID + "\x00" +
			targetEffectID + "\x00" +
			strconv.Itoa(amount) + "\x00" +
			strconv.FormatUint(version, 10),
	))
	return fmt.Sprintf("act_%x", digest[:16])
}

func combatHelpActionID(
	interactionID string,
	actorID string,
	intent InteractionIntent,
	helperPlayerID string,
	rewardTreasures int,
	version uint64,
) string {
	digest := sha256.Sum256([]byte(
		interactionID + "\x00" +
			actorID + "\x00" +
			string(intent) + "\x00" +
			helperPlayerID + "\x00" +
			strconv.Itoa(rewardTreasures) + "\x00" +
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
	if state.InteractionWindow != nil &&
		state.InteractionWindow.Status == InteractionWindowOpen {
		return []ActionView{}, nil
	}
	player := state.Players[playerIndex]
	profile, err := state.Profile()
	if err != nil {
		return nil, err
	}
	var actions []ActionView
	targetPlayerIDs := func() []string {
		targets := make([]string, 0, len(state.Players)-1)
		for _, candidate := range state.Players {
			if candidate.ID != actorID && !candidate.Dead {
				targets = append(targets, candidate.ID)
			}
		}
		return targets
	}
	addManagementActions := func(includeSell bool) error {
		for _, instanceID := range player.Hand {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if !exists {
				return fmt.Errorf("%w: hand card %s", ErrUnknownCard, instanceID)
			}
			if profile.TargetAndRunAway &&
				targetableEffectCard(card) {
				targets := targetPlayerIDs()
				if len(targets) > 0 {
					actions = append(actions, ActionView{
						Type:             CommandPlayTargetEffect,
						SourceInstanceID: instanceID,
						TargetPlayerIDs:  targets,
					})
				}
				continue
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
	addEconomyActions := func() error {
		if !profile.PlayerEconomy {
			return nil
		}
		offered, err := transferableCarriedInstances(
			state,
			playerIndex,
			pack,
		)
		if err != nil {
			return err
		}
		if len(offered) == 0 {
			return nil
		}
		for recipientIndex, recipient := range state.Players {
			if recipientIndex == playerIndex || recipient.Dead {
				continue
			}
			requested, err := transferableCarriedInstances(
				state,
				recipientIndex,
				pack,
			)
			if err != nil {
				return err
			}
			actions = append(actions, ActionView{
				Type:            CommandProposeGift,
				InstanceIDs:     append([]string(nil), offered...),
				TargetPlayerIDs: []string{recipient.ID},
				Minimum:         1,
				Maximum:         len(offered),
			})
			if len(requested) > 0 {
				actions = append(actions, ActionView{
					Type:        CommandProposeTrade,
					InstanceIDs: append([]string(nil), offered...),
					RequestedInstanceIDs: append(
						[]string(nil),
						requested...,
					),
					TargetPlayerIDs: []string{recipient.ID},
					Minimum:         1,
					Maximum:         len(offered),
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
		if err := addEconomyActions(); err != nil {
			return nil, err
		}
		if profile.Theft && !state.Turn.TheftUsed && len(player.Hand) > 0 {
			targets := make([]string, 0, len(state.Players)-1)
			for index, candidate := range state.Players {
				if index != playerIndex &&
					!candidate.Dead &&
					len(candidate.Hand) > 0 {
					targets = append(targets, candidate.ID)
				}
			}
			if len(targets) > 0 {
				for _, sourceID := range player.Traits {
					card, _, exists := pack.DefinitionForInstance(
						state,
						sourceID,
					)
					if !exists {
						return nil, fmt.Errorf(
							"%w: theft source %s",
							ErrUnknownCard,
							sourceID,
						)
					}
					for abilityIndex, ability := range card.Abilities {
						if ability.Kind != AbilityStealRandomCard ||
							ability.DiscardCount != 1 ||
							ability.CooldownTurns != 1 {
							continue
						}
						actions = append(actions, ActionView{
							Type:             CommandAttemptTheft,
							SourceInstanceID: sourceID,
							InstanceIDs: append(
								[]string(nil),
								player.Hand...,
							),
							TargetPlayerIDs: append(
								[]string(nil),
								targets...,
							),
							Minimum:      1,
							Maximum:      1,
							AbilityIndex: abilityIndex,
						})
					}
				}
			}
		}
		actions = append(actions, ActionView{Type: CommandOpenDoor})
	case PhaseDoorChoice:
		for _, instanceID := range player.Hand {
			card, _, exists := pack.DefinitionForInstance(state, instanceID)
			if exists &&
				profile.TargetAndRunAway &&
				targetableEffectCard(card) {
				targets := targetPlayerIDs()
				if len(targets) > 0 {
					actions = append(actions, ActionView{
						Type:             CommandPlayTargetEffect,
						SourceInstanceID: instanceID,
						TargetPlayerIDs:  targets,
					})
				}
			} else if exists && card.Monster != nil {
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
		if !profile.CombatResponses {
			actions = append(actions, ActionView{Type: CommandResolveCombat})
		}
	case PhaseRunAway:
		if !profile.TargetAndRunAway {
			actions = append(actions, ActionView{Type: CommandRunAway})
		}
	case PhaseCharity:
		if err := addManagementActions(true); err != nil {
			return nil, err
		}
		if err := addEconomyActions(); err != nil {
			return nil, err
		}
		limit, err := handLimit(state, playerIndex, pack)
		if err != nil {
			return nil, err
		}
		excess := max(0, len(player.Hand)-limit)
		charityAction := ActionView{
			Type:        CommandResolveCharity,
			InstanceIDs: append([]string(nil), player.Hand...),
			Minimum:     excess,
			Maximum:     excess,
		}
		if profile.PlayerEconomy {
			charityAction.TargetPlayerIDs = charityRecipientIDs(
				state,
				playerIndex,
			)
		}
		actions = append(actions, charityAction)
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

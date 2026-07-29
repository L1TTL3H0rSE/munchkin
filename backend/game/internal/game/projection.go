package game

import "fmt"

type CardView struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Kind           CardKind `json:"kind"`
	CombatStrength int      `json:"combat_strength,omitempty"`
	TreasureCount  int      `json:"treasure_count,omitempty"`
	RulesText      string   `json:"rules_text,omitempty"`
	FlavorText     string   `json:"flavor_text,omitempty"`
	Image          string   `json:"image,omitempty"`
	AltText        string   `json:"alt_text,omitempty"`
}

type SelfView struct {
	PlayerID    string     `json:"player_id"`
	Name        string     `json:"name"`
	Level       int        `json:"level"`
	CombatBonus int        `json:"combat_bonus"`
	Hand        []CardView `json:"hand"`
}

type OtherPlayerView struct {
	PlayerID    string `json:"player_id"`
	Name        string `json:"name"`
	Level       int    `json:"level"`
	CombatBonus int    `json:"combat_bonus"`
	HandCount   int    `json:"hand_count"`
}

type TurnView struct {
	PlayerID         string    `json:"player_id"`
	Phase            Phase     `json:"phase"`
	Encounter        *CardView `json:"encounter,omitempty"`
	AvailableActions []string  `json:"available_actions"`
}

type Projection struct {
	GameID            string            `json:"game_id"`
	Version           uint64            `json:"version"`
	Status            Status            `json:"status"`
	IsOwner           bool              `json:"is_owner"`
	You               SelfView          `json:"you"`
	Players           []OtherPlayerView `json:"players"`
	Turn              TurnView          `json:"turn"`
	DoorDeckCount     int               `json:"door_deck_count"`
	TreasureDeckCount int               `json:"treasure_deck_count"`
	WinnerPlayerID    string            `json:"winner_player_id,omitempty"`
	ContentSetID      string            `json:"content_set_id"`
	ContentVersion    int               `json:"content_version"`
}

func ProjectForActor(state State, actorID string, pack Pack) (Projection, error) {
	index := state.PlayerIndex(actorID)
	if index < 0 {
		return Projection{}, fmt.Errorf("%w: actor is not a participant", ErrIllegalCommand)
	}
	self := state.Players[index]
	projection := Projection{
		GameID:            state.GameID,
		Version:           state.Version,
		Status:            state.Status,
		IsOwner:           actorID == state.OwnerPlayerID,
		You:               SelfView{PlayerID: self.ID, Name: self.Name, Level: self.Level, CombatBonus: self.CombatBonus},
		DoorDeckCount:     len(state.DoorDeck),
		TreasureDeckCount: len(state.TreasureDeck),
		WinnerPlayerID:    state.WinnerPlayerID,
		ContentSetID:      state.ContentSetID,
		ContentVersion:    state.ContentVersion,
		Turn:              TurnView{PlayerID: state.Turn.PlayerID, Phase: state.Turn.Phase},
	}
	for _, cardID := range self.Hand {
		card, exists := pack.Card(cardID)
		if !exists {
			return Projection{}, fmt.Errorf("%w: hand card %s", ErrUnknownCard, cardID)
		}
		projection.You.Hand = append(projection.You.Hand, cardView(card))
	}
	for _, player := range state.Players {
		projection.Players = append(projection.Players, OtherPlayerView{
			PlayerID:    player.ID,
			Name:        player.Name,
			Level:       player.Level,
			CombatBonus: player.CombatBonus,
			HandCount:   len(player.Hand),
		})
	}
	if state.Turn.Encounter != nil {
		card, exists := pack.Card(state.Turn.Encounter.CardID)
		if !exists {
			return Projection{}, fmt.Errorf("%w: encounter card", ErrUnknownCard)
		}
		view := cardView(card)
		projection.Turn.Encounter = &view
	}
	if actorID == state.Turn.PlayerID && state.Status == StatusActive {
		switch state.Turn.Phase {
		case PhaseOpenDoor:
			projection.Turn.AvailableActions = []string{"open_door"}
		case PhaseCombatDecision:
			projection.Turn.AvailableActions = []string{"fight", "run_away"}
		case PhaseLootDecision:
			projection.Turn.AvailableActions = []string{"loot"}
		case PhaseEndTurn:
			projection.Turn.AvailableActions = []string{"end_turn"}
		}
	}
	return projection, nil
}

func cardView(card Card) CardView {
	return CardView{
		ID:             card.ID,
		Name:           card.Name,
		Kind:           card.Kind,
		CombatStrength: card.CombatStrength,
		TreasureCount:  card.TreasureCount,
		RulesText:      card.RulesText,
		FlavorText:     card.FlavorText,
		Image:          card.Image,
		AltText:        card.AltText,
	}
}

package game

import (
	"fmt"
	"strings"
)

type CommandType string

const (
	CommandJoin     CommandType = "join"
	CommandStart    CommandType = "start"
	CommandOpenDoor CommandType = "open_door"
	CommandFight    CommandType = "fight"
	CommandRunAway  CommandType = "run_away"
	CommandLoot     CommandType = "loot"
	CommandEndTurn  CommandType = "end_turn"
)

type Command struct {
	Type           CommandType
	ActorID        string
	PlayerID       string
	DisplayName    string
	CredentialHash string
}

func CreateLobby(gameID string, owner Player, pack Pack, seed uint64) (DomainEvent, error) {
	if gameID == "" || owner.ID == "" || strings.TrimSpace(owner.Name) == "" || owner.CredentialHash == "" {
		return DomainEvent{}, fmt.Errorf("%w: create lobby fields", ErrIllegalCommand)
	}
	return newEvent(EventLobbyCreated, lobbyCreatedPayload{
		GameID:         gameID,
		Owner:          owner,
		Seed:           seed,
		ContentSetID:   pack.SetID,
		ContentVersion: pack.Version,
		ContentDigest:  pack.ContentDigest,
	})
}

func Handle(state State, command Command, pack Pack) ([]DomainEvent, error) {
	if state.Status == StatusFinished {
		return nil, fmt.Errorf("%w: game is finished", ErrIllegalCommand)
	}
	if state.ContentSetID != pack.SetID || state.ContentVersion != pack.Version || state.ContentDigest != pack.ContentDigest {
		return nil, fmt.Errorf("%w: content identity drift", ErrInvalidContent)
	}
	switch command.Type {
	case CommandJoin:
		return handleJoin(state, command)
	case CommandStart:
		return handleStart(state, command, pack)
	case CommandOpenDoor:
		return handleOpenDoor(state, command, pack)
	case CommandFight:
		return handleFight(state, command, pack)
	case CommandRunAway:
		return handleRunAway(state, command, pack)
	case CommandLoot:
		return handleLoot(state, command)
	case CommandEndTurn:
		return handleEndTurn(state, command)
	default:
		return nil, fmt.Errorf("%w: unknown command %s", ErrIllegalCommand, command.Type)
	}
}

func requireTurn(state State, command Command, phase Phase) error {
	if state.Status != StatusActive || command.ActorID == "" || command.ActorID != state.Turn.PlayerID {
		return fmt.Errorf("%w: actor does not own turn", ErrIllegalCommand)
	}
	if state.Turn.Phase != phase {
		return fmt.Errorf("%w: phase %s requires %s", ErrIllegalCommand, state.Turn.Phase, phase)
	}
	return nil
}

func handleJoin(state State, command Command) ([]DomainEvent, error) {
	if state.Status != StatusLobby || len(state.Players) >= MaxPlayers {
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
	event, err := newEvent(EventPlayerJoined, playerJoinedPayload{Player: Player{
		ID:             command.PlayerID,
		Name:           name,
		Level:          1,
		CredentialHash: command.CredentialHash,
	}})
	return []DomainEvent{event}, err
}

func handleStart(state State, command Command, pack Pack) ([]DomainEvent, error) {
	if state.Status != StatusLobby || command.ActorID != state.OwnerPlayerID {
		return nil, fmt.Errorf("%w: only owner starts lobby", ErrIllegalCommand)
	}
	if len(state.Players) < MinPlayers {
		return nil, fmt.Errorf("%w: at least %d players required", ErrIllegalCommand, MinPlayers)
	}
	doors, treasures := pack.Decks()
	doors, rngState := shuffle(doors, state.RNGState)
	treasures, rngState = shuffle(treasures, rngState)
	hands := make(map[string][]string, len(state.Players))
	for _, player := range state.Players {
		if len(doors) < 2 || len(treasures) < 2 {
			return nil, fmt.Errorf("%w: deck exhausted during deal", ErrInvalidContent)
		}
		hands[player.ID] = []string{doors[0], doors[1], treasures[0], treasures[1]}
		doors = doors[2:]
		treasures = treasures[2:]
	}
	event, err := newEvent(EventGameStarted, gameStartedPayload{
		DoorDeck:     doors,
		TreasureDeck: treasures,
		Hands:        hands,
		TurnPlayerID: state.Players[0].ID,
		RNGState:     rngState,
	})
	return []DomainEvent{event}, err
}

func handleOpenDoor(state State, command Command, pack Pack) ([]DomainEvent, error) {
	if err := requireTurn(state, command, PhaseOpenDoor); err != nil {
		return nil, err
	}
	if len(state.DoorDeck) == 0 {
		return nil, fmt.Errorf("%w: door deck exhausted", ErrIllegalCommand)
	}
	cardID := state.DoorDeck[0]
	card, exists := pack.Card(cardID)
	if !exists {
		return nil, fmt.Errorf("%w: %s", ErrUnknownCard, cardID)
	}
	index := state.PlayerIndex(command.ActorID)
	player := state.Players[index]
	payload := doorResolvedPayload{
		PlayerID:    player.ID,
		CardID:      cardID,
		DoorDeck:    append([]string(nil), state.DoorDeck[1:]...),
		DoorDiscard: append([]string(nil), state.DoorDiscard...),
		Hand:        append([]string(nil), player.Hand...),
		Level:       player.Level,
	}
	switch card.Kind {
	case CardMonster:
		payload.Phase = PhaseCombatDecision
		payload.EncounterID = cardID
	case CardCurse:
		payload.Level = max(1, player.Level-card.LevelLoss)
		payload.DoorDiscard = append(payload.DoorDiscard, cardID)
		payload.Phase = PhaseLootDecision
	case CardDoor:
		payload.Hand = append(payload.Hand, cardID)
		payload.Phase = PhaseLootDecision
	default:
		return nil, fmt.Errorf("%w: door deck contains %s", ErrInvalidContent, card.Kind)
	}
	event, err := newEvent(EventDoorResolved, payload)
	return []DomainEvent{event}, err
}

func handleFight(state State, command Command, pack Pack) ([]DomainEvent, error) {
	if err := requireTurn(state, command, PhaseCombatDecision); err != nil {
		return nil, err
	}
	if state.Turn.Encounter == nil {
		return nil, fmt.Errorf("%w: missing encounter", ErrIllegalCommand)
	}
	card, exists := pack.Card(state.Turn.Encounter.CardID)
	if !exists || card.Kind != CardMonster {
		return nil, fmt.Errorf("%w: invalid monster encounter", ErrInvalidContent)
	}
	index := state.PlayerIndex(command.ActorID)
	player := state.Players[index]
	won := player.Level+player.CombatBonus >= card.CombatStrength
	payload := combatResolvedPayload{
		PlayerID:     player.ID,
		MonsterID:    card.ID,
		Won:          won,
		Level:        player.Level,
		Hand:         append([]string(nil), player.Hand...),
		TreasureDeck: append([]string(nil), state.TreasureDeck...),
		DoorDiscard:  append(append([]string(nil), state.DoorDiscard...), card.ID),
		Status:       StatusActive,
	}
	if won {
		if len(payload.TreasureDeck) < card.TreasureCount {
			return nil, fmt.Errorf("%w: treasure deck exhausted", ErrIllegalCommand)
		}
		payload.Hand = append(payload.Hand, payload.TreasureDeck[:card.TreasureCount]...)
		payload.TreasureDeck = payload.TreasureDeck[card.TreasureCount:]
		payload.Level++
		payload.Phase = PhaseLootDecision
		if payload.Level >= WinningLevel {
			payload.Status = StatusFinished
			payload.WinnerPlayerID = player.ID
			payload.Phase = ""
		}
	} else {
		payload.Level = max(1, payload.Level-card.LevelLoss)
		payload.Phase = PhaseEndTurn
	}
	event, err := newEvent(EventCombatResolved, payload)
	return []DomainEvent{event}, err
}

func handleRunAway(state State, command Command, pack Pack) ([]DomainEvent, error) {
	if err := requireTurn(state, command, PhaseCombatDecision); err != nil {
		return nil, err
	}
	if state.Turn.Encounter == nil {
		return nil, fmt.Errorf("%w: missing encounter", ErrIllegalCommand)
	}
	card, exists := pack.Card(state.Turn.Encounter.CardID)
	if !exists || card.Kind != CardMonster {
		return nil, fmt.Errorf("%w: invalid monster encounter", ErrInvalidContent)
	}
	index := state.PlayerIndex(command.ActorID)
	player := state.Players[index]
	roll, rngState := rollD6(state.RNGState)
	succeeded := roll >= 5
	level := player.Level
	if !succeeded {
		level = max(1, level-card.LevelLoss)
	}
	event, err := newEvent(EventRunAwayResolved, runAwayResolvedPayload{
		PlayerID:    player.ID,
		MonsterID:   card.ID,
		Roll:        roll,
		Succeeded:   succeeded,
		Level:       level,
		RNGState:    rngState,
		DoorDiscard: append(append([]string(nil), state.DoorDiscard...), card.ID),
	})
	return []DomainEvent{event}, err
}

func handleLoot(state State, command Command) ([]DomainEvent, error) {
	if err := requireTurn(state, command, PhaseLootDecision); err != nil {
		return nil, err
	}
	if len(state.TreasureDeck) == 0 {
		return nil, fmt.Errorf("%w: treasure deck exhausted", ErrIllegalCommand)
	}
	index := state.PlayerIndex(command.ActorID)
	hand := append(append([]string(nil), state.Players[index].Hand...), state.TreasureDeck[0])
	event, err := newEvent(EventLooted, lootedPayload{
		PlayerID:     command.ActorID,
		CardID:       state.TreasureDeck[0],
		Hand:         hand,
		TreasureDeck: append([]string(nil), state.TreasureDeck[1:]...),
	})
	return []DomainEvent{event}, err
}

func handleEndTurn(state State, command Command) ([]DomainEvent, error) {
	if err := requireTurn(state, command, PhaseEndTurn); err != nil {
		return nil, err
	}
	current := state.PlayerIndex(command.ActorID)
	next := state.Players[(current+1)%len(state.Players)].ID
	event, err := newEvent(EventTurnAdvanced, turnAdvancedPayload{PlayerID: next})
	return []DomainEvent{event}, err
}

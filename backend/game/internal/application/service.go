package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/telemetry"
)

type SystemClock struct{}

func (SystemClock) Now() int64 { return time.Now().UTC().UnixNano() }

type NoopPublisher struct{}

func (NoopPublisher) Publish(context.Context, Invalidation) error { return nil }

type Service struct {
	store     Store
	pack      game.Pack
	clock     Clock
	publisher Publisher
	telemetry telemetry.Recorder
	random    func([]byte) error
}

type LobbyResult struct {
	GameID     string          `json:"game_id"`
	PlayerID   string          `json:"player_id"`
	Credential string          `json:"credential"`
	Projection game.Projection `json:"projection"`
}

type CommandResult struct {
	GameID     string          `json:"game_id"`
	CommandID  string          `json:"command_id"`
	Version    uint64          `json:"version"`
	Replayed   bool            `json:"replayed"`
	Projection game.Projection `json:"projection"`
}

type LobbySummary struct {
	GameID              string      `json:"game_id"`
	Version             uint64      `json:"version"`
	Status              game.Status `json:"status"`
	PlayerCount         int         `json:"player_count"`
	MinPlayers          int         `json:"min_players"`
	MaxPlayers          int         `json:"max_players"`
	RulesProfileID      string      `json:"rules_profile_id"`
	RulesProfileVersion int         `json:"rules_profile_version"`
}

func NewService(store Store, pack game.Pack, clock Clock, publisher Publisher) *Service {
	if clock == nil {
		clock = SystemClock{}
	}
	if publisher == nil {
		publisher = NoopPublisher{}
	}
	return &Service{
		store:     store,
		pack:      pack,
		clock:     clock,
		publisher: publisher,
		telemetry: telemetry.Noop(),
		random: func(buffer []byte) error {
			_, err := rand.Read(buffer)
			return err
		},
	}
}

func (service *Service) SetTelemetry(recorder telemetry.Recorder) {
	if recorder == nil {
		recorder = telemetry.Noop()
	}
	service.telemetry = recorder
}

func (service *Service) observeInteraction(
	ctx context.Context,
	kind game.InteractionKind,
	closeReason game.InteractionCloseReason,
	outcome string,
	response string,
	startedAt time.Time,
	completedAt time.Time,
	timeout bool,
	extended bool,
	stale bool,
	retry bool,
) {
	telemetry.SafeRecordInteraction(
		service.telemetry,
		ctx,
		telemetry.InteractionSignal{
			Kind:        string(kind),
			CloseReason: string(closeReason),
			Outcome:     outcome,
			Response:    response,
			StartedAt:   startedAt,
			CompletedAt: completedAt,
			Timeout:     timeout,
			Extended:    extended,
			Stale:       stale,
			Retry:       retry,
		},
	)
}

func interactionOutcome(err error, replay bool) string {
	if replay {
		return telemetry.OutcomeReplay
	}
	switch {
	case err == nil:
		return telemetry.OutcomeSuccess
	case errors.Is(err, ErrVersionConflict):
		return telemetry.OutcomeVersionConflict
	case errors.Is(err, ErrIdempotencyConflict):
		return telemetry.OutcomeIdempotencyConflict
	case errors.Is(err, ErrInteractionExpired):
		return telemetry.OutcomeExpired
	case errors.Is(err, ErrInteractionAction),
		errors.Is(err, ErrInteractionClosed),
		errors.Is(err, ErrUnauthorized):
		return telemetry.OutcomeRejected
	case IsRuleError(err):
		return telemetry.OutcomeRuleViolation
	default:
		return telemetry.OutcomeInternalError
	}
}

func telemetryOutcomeNoop() string {
	return telemetry.OutcomeNoop
}

func interactionResponseClass(
	intent game.InteractionIntent,
	timeout bool,
) string {
	if timeout {
		return telemetry.ResponseTimeout
	}
	switch intent {
	case game.InteractionIntentPass:
		return telemetry.ResponsePass
	case game.InteractionIntentAccept:
		return telemetry.ResponseAccept
	case game.InteractionIntentDecline:
		return telemetry.ResponseDecline
	case game.InteractionIntentCancelHelp,
		game.InteractionIntentCancelOffer:
		return telemetry.ResponseCancel
	case game.InteractionIntentRespond,
		game.InteractionIntentOfferHelp:
		return telemetry.ResponseMaterial
	default:
		return telemetry.ResponseNone
	}
}

func (service *Service) CreateLobby(ctx context.Context, displayName string) (LobbyResult, error) {
	gameID, err := service.randomID("game")
	if err != nil {
		return LobbyResult{}, err
	}
	playerID, err := service.randomID("player")
	if err != nil {
		return LobbyResult{}, err
	}
	token, tokenHash, err := service.credential()
	if err != nil {
		return LobbyResult{}, err
	}
	seedBytes := make([]byte, 8)
	if err := service.random(seedBytes); err != nil {
		return LobbyResult{}, err
	}
	var seed uint64
	for _, value := range seedBytes {
		seed = seed<<8 | uint64(value)
	}
	domainEvent, err := game.CreateLobby(gameID, game.Player{
		ID:             playerID,
		Name:           strings.TrimSpace(displayName),
		Level:          1,
		CredentialHash: tokenHash,
	}, service.pack, seed)
	if err != nil {
		return LobbyResult{}, err
	}
	envelope := service.envelope(gameID, "create", 1, domainEvent)
	state, err := game.Apply(game.State{}, domainEvent)
	if err != nil {
		return LobbyResult{}, err
	}
	if err := service.store.Create(ctx, state, []game.EventEnvelope{envelope}); err != nil {
		return LobbyResult{}, err
	}
	projection, err := service.projectForActor(state, playerID, time.Time{})
	if err != nil {
		return LobbyResult{}, err
	}
	return LobbyResult{GameID: gameID, PlayerID: playerID, Credential: token, Projection: projection}, nil
}

func (service *Service) JoinLobby(
	ctx context.Context,
	gameID string,
	credential string,
	commandID string,
	expectedVersion uint64,
	displayName string,
) (LobbyResult, error) {
	if gameID == "" || credential == "" || commandID == "" {
		return LobbyResult{}, ErrUnauthorized
	}
	tokenHash := hashCredential(credential)
	fingerprint := joinFingerprint(displayName, expectedVersion)
	var result LobbyResult
	var publish *Invalidation
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		if actorID, exists := state.ActorByCredentialHash(tokenHash); exists {
			receipt, found := tx.FindReceipt(actorID, commandID)
			if !found {
				return ErrUnauthorized
			}
			if receipt.Fingerprint != fingerprint {
				return ErrIdempotencyConflict
			}
			var projection game.Projection
			if err := json.Unmarshal(receipt.Projection, &projection); err != nil {
				return err
			}
			result = LobbyResult{
				GameID:     gameID,
				PlayerID:   actorID,
				Credential: credential,
				Projection: projection,
			}
			return nil
		}
		if state.Version != expectedVersion {
			return ErrVersionConflict
		}
		playerID, err := service.randomID("player")
		if err != nil {
			return err
		}
		events, err := game.Handle(state, game.Command{
			Type:           game.CommandJoin,
			PlayerID:       playerID,
			DisplayName:    displayName,
			CredentialHash: tokenHash,
		}, service.pack)
		if err != nil {
			return err
		}
		envelopes, next, err := service.apply(state, "join:"+playerID, events)
		if err != nil {
			return err
		}
		projection, err := service.projectForActor(next, playerID, time.Time{})
		if err != nil {
			return err
		}
		rawProjection, err := json.Marshal(projection)
		if err != nil {
			return err
		}
		receipt := Receipt{
			ActorID:     playerID,
			CommandID:   commandID,
			Fingerprint: fingerprint,
			Version:     next.Version,
			Projection:  rawProjection,
		}
		if err := tx.Save(expectedVersion, next, envelopes, &receipt); err != nil {
			return err
		}
		result = LobbyResult{
			GameID:     gameID,
			PlayerID:   playerID,
			Credential: credential,
			Projection: projection,
		}
		publish = &Invalidation{
			Type:       "game.v1.version_advanced",
			OccurredAt: time.Unix(0, service.clock.Now()).UTC().Format(time.RFC3339Nano),
			GameID:     gameID,
			Version:    next.Version,
			Reason:     string(game.CommandJoin),
		}
		return nil
	})
	if err == nil && publish != nil {
		_ = service.publisher.Publish(ctx, *publish)
	}
	return result, err
}

func (service *Service) GetLobby(ctx context.Context, gameID string) (LobbySummary, error) {
	var summary LobbySummary
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		summary = LobbySummary{
			GameID:              gameID,
			Version:             state.Version,
			Status:              state.Status,
			PlayerCount:         len(state.Players),
			MinPlayers:          game.MinPlayers,
			MaxPlayers:          game.MaxPlayers,
			RulesProfileID:      state.RulesProfileID,
			RulesProfileVersion: state.RulesProfileVersion,
		}
		return nil
	})
	return summary, err
}

func (service *Service) Execute(
	ctx context.Context,
	gameID string,
	credential string,
	commandID string,
	expectedVersion uint64,
	command game.Command,
) (CommandResult, error) {
	if gameID == "" || commandID == "" || credential == "" {
		return CommandResult{}, ErrUnauthorized
	}
	tokenHash := hashCredential(credential)
	command = normalizeCommand(command)
	fingerprint := commandFingerprint(command, expectedVersion)
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
		command.ActorID = actorID
		events, err := game.Handle(state, command, service.pack)
		if err != nil {
			return err
		}
		envelopes, next, err := service.apply(state, commandID, events)
		if err != nil {
			return err
		}
		projection, err := service.projectForActor(next, actorID, time.Time{})
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
		if err := tx.Save(expectedVersion, next, envelopes, &receipt); err != nil {
			return err
		}
		result = CommandResult{
			GameID:     gameID,
			CommandID:  commandID,
			Version:    next.Version,
			Projection: projection,
		}
		publish = &Invalidation{
			Type:       "game.v1.version_advanced",
			OccurredAt: time.Unix(0, service.clock.Now()).UTC().Format(time.RFC3339Nano),
			GameID:     gameID,
			Version:    next.Version,
			Reason:     string(command.Type),
		}
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

func (service *Service) Get(ctx context.Context, gameID, credential string) (game.Projection, error) {
	if credential == "" {
		return game.Projection{}, ErrUnauthorized
	}
	tokenHash := hashCredential(credential)
	var projection game.Projection
	err := service.store.WithinGame(ctx, gameID, func(tx Tx) error {
		state := tx.State()
		if err := service.ensureContentIdentity(state); err != nil {
			return err
		}
		actorID, exists := state.ActorByCredentialHash(tokenHash)
		if !exists {
			return ErrUnauthorized
		}
		var err error
		projection, err = service.projectForActor(state, actorID, time.Time{})
		return err
	})
	return projection, err
}

func (service *Service) apply(
	state game.State,
	commandID string,
	events []game.DomainEvent,
) ([]game.EventEnvelope, game.State, error) {
	return service.applyAt(state, commandID, events, time.Time{})
}

func (service *Service) applyAt(
	state game.State,
	commandID string,
	events []game.DomainEvent,
	occurredAt time.Time,
) ([]game.EventEnvelope, game.State, error) {
	next := state
	envelopes := make([]game.EventEnvelope, 0, len(events))
	for _, event := range events {
		sequence := next.Version + 1
		var envelope game.EventEnvelope
		if occurredAt.IsZero() {
			envelope = service.envelope(
				state.GameID,
				commandID,
				sequence,
				event,
			)
		} else {
			envelope = service.envelopeAt(
				state.GameID,
				commandID,
				sequence,
				event,
				occurredAt,
			)
		}
		applied, err := game.Apply(next, event)
		if err != nil {
			return nil, game.State{}, err
		}
		if applied.Version != sequence {
			return nil, game.State{}, fmt.Errorf("event version mismatch")
		}
		envelopes = append(envelopes, envelope)
		next = applied
	}
	return envelopes, next, nil
}

func (service *Service) envelope(
	gameID, commandID string,
	sequence uint64,
	event game.DomainEvent,
) game.EventEnvelope {
	return service.envelopeAt(
		gameID,
		commandID,
		sequence,
		event,
		time.Unix(0, service.clock.Now()).UTC(),
	)
}

func (service *Service) envelopeAt(
	gameID, commandID string,
	sequence uint64,
	event game.DomainEvent,
	occurredAt time.Time,
) game.EventEnvelope {
	return game.EventEnvelope{
		GameID:     gameID,
		Sequence:   sequence,
		EventID:    fmt.Sprintf("%s:%d", commandID, sequence),
		CommandID:  commandID,
		Type:       event.Type,
		Schema:     1,
		OccurredAt: occurredAt.UTC(),
		Payload:    event.Payload,
	}
}

func (service *Service) randomID(prefix string) (string, error) {
	buffer := make([]byte, 16)
	if err := service.random(buffer); err != nil {
		return "", err
	}
	return prefix + "_" + hex.EncodeToString(buffer), nil
}

func (service *Service) credential() (token, hash string, err error) {
	buffer := make([]byte, 32)
	if err := service.random(buffer); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(buffer)
	return token, hashCredential(token), nil
}

func hashCredential(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func commandFingerprint(command game.Command, expectedVersion uint64) string {
	payload := struct {
		Type             game.CommandType `json:"type"`
		ExpectedVersion  uint64           `json:"expected_version"`
		InstanceID       string           `json:"instance_id"`
		TargetInstanceID string           `json:"target_instance_id"`
		InstanceIDs      []string         `json:"instance_ids"`
		ChoiceIDs        []string         `json:"choice_ids"`
		AbilityIndex     int              `json:"ability_index"`
	}{
		Type:             command.Type,
		ExpectedVersion:  expectedVersion,
		InstanceID:       command.InstanceID,
		TargetInstanceID: command.TargetInstanceID,
		InstanceIDs:      command.InstanceIDs,
		ChoiceIDs:        command.ChoiceIDs,
		AbilityIndex:     command.AbilityIndex,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		panic(fmt.Sprintf("marshal command fingerprint: %v", err))
	}
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}

func normalizeCommand(command game.Command) game.Command {
	command.ActorID = ""
	command.PlayerID = ""
	command.DisplayName = ""
	command.CredentialHash = ""
	command.InstanceID = strings.TrimSpace(command.InstanceID)
	command.TargetInstanceID = strings.TrimSpace(command.TargetInstanceID)
	command.InstanceIDs = append([]string(nil), command.InstanceIDs...)
	command.ChoiceIDs = append([]string(nil), command.ChoiceIDs...)
	for index := range command.InstanceIDs {
		command.InstanceIDs[index] = strings.TrimSpace(command.InstanceIDs[index])
	}
	for index := range command.ChoiceIDs {
		command.ChoiceIDs[index] = strings.TrimSpace(command.ChoiceIDs[index])
	}
	slices.Sort(command.InstanceIDs)
	slices.Sort(command.ChoiceIDs)
	return command
}

func joinFingerprint(displayName string, expectedVersion uint64) string {
	digest := sha256.Sum256([]byte(fmt.Sprintf(
		"%s\n%d\n%s",
		game.CommandJoin,
		expectedVersion,
		strings.TrimSpace(displayName),
	)))
	return hex.EncodeToString(digest[:])
}

func (service *Service) ensureContentIdentity(state game.State) error {
	if state.ContentSetID != service.pack.SetID ||
		state.ContentVersion != service.pack.Version ||
		state.ContentDigest != service.pack.ContentDigest {
		return fmt.Errorf("%w: content identity drift", game.ErrInvalidContent)
	}
	if _, err := state.Profile(); err != nil {
		return err
	}
	return nil
}

func (service *Service) projectForActor(
	state game.State,
	actorID string,
	serverTime time.Time,
) (game.Projection, error) {
	projection, err := game.ProjectForActor(state, actorID, service.pack)
	if err != nil {
		return game.Projection{}, err
	}
	if projection.Interaction != nil {
		if serverTime.IsZero() {
			serverTime = time.Unix(0, service.clock.Now()).UTC()
		}
		projection.Interaction.ServerTime = &serverTime
	}
	return projection, nil
}

func IsRuleError(err error) bool {
	return errors.Is(err, game.ErrIllegalCommand) ||
		errors.Is(err, game.ErrInvalidContent) ||
		errors.Is(err, game.ErrUnknownCard) ||
		errors.Is(err, game.ErrIncompatibleState)
}

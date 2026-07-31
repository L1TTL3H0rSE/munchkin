package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
)

type Router struct {
	service        *application.Service
	subscriber     Subscriber
	contentSetID   string
	assetDirectory string
}

type Subscriber interface {
	Subscribe(
		context.Context,
		string,
	) (<-chan application.Invalidation, func())
}

type Options struct {
	Subscriber     Subscriber
	ContentSetID   string
	AssetDirectory string
}

func New(service *application.Service, subscribers ...Subscriber) http.Handler {
	options := Options{}
	if len(subscribers) > 0 {
		options.Subscriber = subscribers[0]
	}
	return NewWithOptions(service, options)
}

func NewWithOptions(service *application.Service, options Options) http.Handler {
	router := &Router{
		service: service, subscriber: options.Subscriber,
		contentSetID: options.ContentSetID, assetDirectory: options.AssetDirectory,
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", router.health)
	mux.HandleFunc("POST /api/v1/lobbies", router.createLobby)
	mux.HandleFunc("GET /api/v1/lobbies/{gameID}", router.getLobby)
	if router.contentSetID != "" && router.assetDirectory != "" {
		mux.HandleFunc("GET /api/v1/content/{setID}/assets/{assetPath...}", router.contentAsset)
	}
	mux.HandleFunc("POST /api/v1/games/{gameID}/players", router.joinLobby)
	mux.HandleFunc("GET /api/v1/games/{gameID}", router.getGame)
	mux.HandleFunc("GET /api/v1/games/{gameID}/events", router.events)
	mux.HandleFunc("POST /api/v1/games/{gameID}/start", router.command(game.CommandStart))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/finish-setup", router.command(game.CommandFinishSetup))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/play-card", router.command(game.CommandPlayCard))
	mux.HandleFunc(
		"POST /api/v1/games/{gameID}/commands/play-target-effect",
		router.playTargetEffect,
	)
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/equip-item", router.command(game.CommandEquipItem))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/unequip-item", router.command(game.CommandUnequipItem))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/discard-card", router.command(game.CommandDiscardCard))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/sell-items", router.command(game.CommandSellItems))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/open-door", router.command(game.CommandOpenDoor))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/look-for-trouble", router.command(game.CommandLookForTrouble))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/loot-room", router.command(game.CommandLootRoom))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/use-ability", router.command(game.CommandUseAbility))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/resolve-combat", router.command(game.CommandResolveCombat))
	mux.HandleFunc(
		"POST /api/v1/games/{gameID}/commands/request-combat-resolution",
		router.requestCombatResolution,
	)
	mux.HandleFunc(
		"POST /api/v1/games/{gameID}/commands/combat-help",
		router.combatHelp,
	)
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/run-away", router.command(game.CommandRunAway))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/choose-effect", router.command(game.CommandChooseEffect))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/resolve-charity", router.command(game.CommandResolveCharity))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/end-turn", router.command(game.CommandEndTurn))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/fight", router.command(game.CommandFight))
	mux.HandleFunc("POST /api/v1/games/{gameID}/commands/loot", router.command(game.CommandLoot))
	mux.HandleFunc(
		"POST /api/v1/games/{gameID}/commands/respond-interaction",
		router.interaction(false),
	)
	mux.HandleFunc(
		"POST /api/v1/games/{gameID}/commands/pass-interaction",
		router.interaction(true),
	)
	return withMiddleware(mux, allowedOrigins())
}

type createRequest struct {
	DisplayName string `json:"display_name"`
}

type joinRequest struct {
	DisplayName     string `json:"display_name"`
	ExpectedVersion uint64 `json:"expected_version"`
}

type commandRequest struct {
	ExpectedVersion  uint64   `json:"expected_version"`
	InstanceID       string   `json:"instance_id,omitempty"`
	TargetInstanceID string   `json:"target_instance_id,omitempty"`
	TargetPlayerID   string   `json:"target_player_id,omitempty"`
	InstanceIDs      []string `json:"instance_ids,omitempty"`
	ChoiceIDs        []string `json:"choice_ids,omitempty"`
	AbilityIndex     int      `json:"ability_index,omitempty"`
}

type interactionRequest struct {
	ExpectedVersion uint64                 `json:"expected_version"`
	InteractionID   string                 `json:"interaction_id"`
	ActionID        string                 `json:"action_id"`
	Intent          game.InteractionIntent `json:"intent"`
}

type versionedRequest struct {
	ExpectedVersion uint64 `json:"expected_version"`
}

type combatHelpRequest struct {
	ExpectedVersion uint64 `json:"expected_version"`
	ActionID        string `json:"action_id"`
}

func (router *Router) health(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}

func (router *Router) createLobby(writer http.ResponseWriter, request *http.Request) {
	var body createRequest
	if err := decodeJSON(writer, request, &body); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	result, err := router.service.CreateLobby(request.Context(), body.DisplayName)
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusCreated, result)
}

func (router *Router) contentAsset(writer http.ResponseWriter, request *http.Request) {
	relative := request.PathValue("assetPath")
	if request.PathValue("setID") != router.contentSetID ||
		relative == "" ||
		path.Clean(relative) != relative ||
		strings.Contains(relative, `\`) {
		http.NotFound(writer, request)
		return
	}
	root, err := os.OpenRoot(router.assetDirectory)
	if err != nil {
		http.NotFound(writer, request)
		return
	}
	defer root.Close()
	file, err := root.Open(relative)
	if err != nil {
		http.NotFound(writer, request)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(writer, request)
		return
	}
	writer.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeContent(writer, request, info.Name(), info.ModTime(), file)
}

func (router *Router) getLobby(writer http.ResponseWriter, request *http.Request) {
	result, err := router.service.GetLobby(request.Context(), request.PathValue("gameID"))
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (router *Router) joinLobby(writer http.ResponseWriter, request *http.Request) {
	var body joinRequest
	if err := decodeJSON(writer, request, &body); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	commandID := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
	if commandID == "" || len(commandID) > 128 {
		writeError(writer, http.StatusBadRequest, "idempotency_key_required", "Idempotency-Key is required")
		return
	}
	result, err := router.service.JoinLobby(
		request.Context(),
		request.PathValue("gameID"),
		bearerToken(request),
		commandID,
		body.ExpectedVersion,
		body.DisplayName,
	)
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusCreated, result)
}

func (router *Router) getGame(writer http.ResponseWriter, request *http.Request) {
	projection, err := router.service.Get(
		request.Context(),
		request.PathValue("gameID"),
		bearerToken(request),
	)
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, projection)
}

func (router *Router) events(writer http.ResponseWriter, request *http.Request) {
	if router.subscriber == nil {
		writeError(writer, http.StatusNotImplemented, "realtime_unavailable", "realtime is not configured")
		return
	}
	gameID := request.PathValue("gameID")
	if _, err := router.service.Get(request.Context(), gameID, bearerToken(request)); err != nil {
		router.mapError(writer, err)
		return
	}
	flusher, ok := writer.(http.Flusher)
	if !ok {
		writeError(writer, http.StatusInternalServerError, "stream_unsupported", "streaming is unavailable")
		return
	}
	events, cancel := router.subscriber.Subscribe(request.Context(), gameID)
	defer cancel()

	controller := http.NewResponseController(writer)
	writer.Header().Set("Content-Type", "text/event-stream")
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("X-Accel-Buffering", "no")
	writer.WriteHeader(http.StatusOK)
	_, _ = fmt.Fprint(writer, ": connected\n\n")
	flusher.Flush()

	heartbeat := time.NewTicker(10 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-request.Context().Done():
			return
		case <-heartbeat.C:
			if _, err := fmt.Fprint(writer, ": heartbeat\n\n"); err != nil {
				return
			}
			if err := controller.Flush(); err != nil {
				return
			}
		case event, open := <-events:
			if !open {
				return
			}
			raw, err := json.Marshal(event)
			if err != nil {
				return
			}
			if _, err := fmt.Fprintf(writer, "event: version\ndata: %s\n\n", raw); err != nil {
				return
			}
			if err := controller.Flush(); err != nil {
				return
			}
		}
	}
}

func (router *Router) command(commandType game.CommandType) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var body commandRequest
		if err := decodeJSON(writer, request, &body); err != nil {
			writeError(writer, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		commandID := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
		if commandID == "" || len(commandID) > 128 {
			writeError(writer, http.StatusBadRequest, "idempotency_key_required", "Idempotency-Key is required")
			return
		}
		result, err := router.service.Execute(
			request.Context(),
			request.PathValue("gameID"),
			bearerToken(request),
			commandID,
			body.ExpectedVersion,
			game.Command{
				Type:             commandType,
				InstanceID:       body.InstanceID,
				TargetInstanceID: body.TargetInstanceID,
				InstanceIDs:      body.InstanceIDs,
				ChoiceIDs:        body.ChoiceIDs,
				AbilityIndex:     body.AbilityIndex,
			},
		)
		if err != nil {
			router.mapError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, result)
	}
}

func (router *Router) requestCombatResolution(
	writer http.ResponseWriter,
	request *http.Request,
) {
	var body versionedRequest
	if err := decodeJSON(writer, request, &body); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	commandID := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
	if commandID == "" || len(commandID) > 128 {
		writeError(
			writer,
			http.StatusBadRequest,
			"idempotency_key_required",
			"Idempotency-Key is required",
		)
		return
	}
	result, err := router.service.RequestCombatResolution(
		request.Context(),
		request.PathValue("gameID"),
		bearerToken(request),
		commandID,
		body.ExpectedVersion,
	)
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (router *Router) playTargetEffect(
	writer http.ResponseWriter,
	request *http.Request,
) {
	var body commandRequest
	if err := decodeJSON(writer, request, &body); err != nil {
		writeError(
			writer,
			http.StatusBadRequest,
			"invalid_request",
			err.Error(),
		)
		return
	}
	commandID := strings.TrimSpace(
		request.Header.Get("Idempotency-Key"),
	)
	if commandID == "" || len(commandID) > 128 {
		writeError(
			writer,
			http.StatusBadRequest,
			"idempotency_key_required",
			"Idempotency-Key is required",
		)
		return
	}
	result, err := router.service.PlayTargetEffect(
		request.Context(),
		request.PathValue("gameID"),
		bearerToken(request),
		commandID,
		body.ExpectedVersion,
		body.InstanceID,
		body.TargetPlayerID,
	)
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func (router *Router) interaction(pass bool) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		var body interactionRequest
		if err := decodeJSON(writer, request, &body); err != nil {
			writeError(writer, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		if (pass && body.Intent != game.InteractionIntentPass) ||
			(!pass && !respondInteractionIntent(body.Intent)) {
			writeError(
				writer,
				http.StatusBadRequest,
				"invalid_interaction_intent",
				"interaction intent does not match route",
			)
			return
		}
		commandID := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
		if commandID == "" || len(commandID) > 128 {
			writeError(
				writer,
				http.StatusBadRequest,
				"idempotency_key_required",
				"Idempotency-Key is required",
			)
			return
		}
		result, err := router.service.ExecuteInteraction(
			request.Context(),
			request.PathValue("gameID"),
			bearerToken(request),
			commandID,
			body.ExpectedVersion,
			body.InteractionID,
			body.ActionID,
			body.Intent,
		)
		if err != nil {
			router.mapError(writer, err)
			return
		}
		writeJSON(writer, http.StatusOK, result)
	}
}

func (router *Router) combatHelp(
	writer http.ResponseWriter,
	request *http.Request,
) {
	var body combatHelpRequest
	if err := decodeJSON(writer, request, &body); err != nil {
		writeError(writer, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	commandID := strings.TrimSpace(request.Header.Get("Idempotency-Key"))
	if commandID == "" || len(commandID) > 128 {
		writeError(
			writer,
			http.StatusBadRequest,
			"idempotency_key_required",
			"Idempotency-Key is required",
		)
		return
	}
	result, err := router.service.ExecuteCombatHelpAction(
		request.Context(),
		request.PathValue("gameID"),
		bearerToken(request),
		commandID,
		body.ExpectedVersion,
		body.ActionID,
	)
	if err != nil {
		router.mapError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, result)
}

func respondInteractionIntent(intent game.InteractionIntent) bool {
	switch intent {
	case game.InteractionIntentRespond,
		game.InteractionIntentAccept,
		game.InteractionIntentDecline:
		return true
	default:
		return false
	}
}

func (router *Router) mapError(writer http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, application.ErrNotFound):
		writeError(writer, http.StatusNotFound, "not_found", "game not found")
	case errors.Is(err, application.ErrUnauthorized):
		writeError(writer, http.StatusForbidden, "forbidden", "invalid game credential")
	case errors.Is(err, application.ErrVersionConflict):
		writeError(writer, http.StatusConflict, "version_conflict", "reload the current projection")
	case errors.Is(err, application.ErrIdempotencyConflict):
		writeError(writer, http.StatusConflict, "idempotency_key_reused", "key was used with another request")
	case errors.Is(err, application.ErrInteractionExpired):
		writeError(writer, http.StatusConflict, "interaction_expired", "reload the current projection")
	case errors.Is(err, application.ErrInteractionClosed):
		writeError(writer, http.StatusConflict, "interaction_closed", "reload the current projection")
	case errors.Is(err, application.ErrInteractionAction):
		writeError(writer, http.StatusUnprocessableEntity, "illegal_interaction_action", "interaction action is not available")
	case application.IsRuleError(err):
		writeError(writer, http.StatusUnprocessableEntity, "rule_violation", err.Error())
	default:
		writeError(writer, http.StatusInternalServerError, "internal_error", "request failed")
	}
}

func decodeJSON(writer http.ResponseWriter, request *http.Request, target any) error {
	decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err != nil {
			return err
		}
		return errors.New("multiple JSON values")
	}
	return nil
}

func bearerToken(request *http.Request) string {
	value := request.Header.Get("Authorization")
	scheme, token, found := strings.Cut(value, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeError(writer http.ResponseWriter, status int, code, message string) {
	writeJSON(writer, status, map[string]any{
		"error":   true,
		"code":    code,
		"message": message,
	})
}

func allowedOrigins() map[string]struct{} {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if raw == "" {
		raw = "http://localhost:3000"
	}
	origins := make(map[string]struct{})
	for _, origin := range strings.Split(raw, ",") {
		if value := strings.TrimSpace(origin); value != "" {
			origins[value] = struct{}{}
		}
	}
	return origins
}

func withMiddleware(next http.Handler, origins map[string]struct{}) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		writer.Header().Set("Cache-Control", "no-store")
		origin := request.Header.Get("Origin")
		if origin != "" {
			writer.Header().Add("Vary", "Origin")
			if _, allowed := origins[origin]; !allowed {
				writeError(writer, http.StatusForbidden, "origin_forbidden", "origin is not allowed")
				return
			}
			writer.Header().Set("Access-Control-Allow-Origin", origin)
			writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			writer.Header().Set(
				"Access-Control-Allow-Headers",
				"Authorization, Content-Type, Idempotency-Key",
			)
			writer.Header().Set("Access-Control-Max-Age", "600")
		}
		if request.Method == http.MethodOptions {
			if origin == "" {
				writeError(writer, http.StatusBadRequest, "origin_required", "preflight origin is required")
				return
			}
			writer.WriteHeader(http.StatusNoContent)
			return
		}
		if request.ContentLength > 1<<20 {
			writeError(writer, http.StatusRequestEntityTooLarge, "body_too_large", strconv.FormatInt(request.ContentLength, 10))
			return
		}
		next.ServeHTTP(writer, request)
	})
}

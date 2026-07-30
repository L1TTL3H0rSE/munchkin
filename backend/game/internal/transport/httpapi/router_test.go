package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
)

func routerPack(t *testing.T) game.Pack {
	t.Helper()
	pack, err := game.LoadPack(filepath.Join(
		"..",
		"..",
		"..",
		"..",
		"..",
		"content",
		"sets",
		"demo",
		"cards.json",
	))
	if err != nil {
		t.Fatal(err)
	}
	return pack
}

func testRouter(t *testing.T) (*application.Service, *httptest.Server) {
	t.Helper()
	service := application.NewService(
		memory.New(),
		routerPack(t),
		application.SystemClock{},
		application.NoopPublisher{},
	)
	server := httptest.NewServer(New(service))
	t.Cleanup(server.Close)
	return service, server
}

func TestCreateGetAndForgedCredential(t *testing.T) {
	_, server := testRouter(t)
	createResponse := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/lobbies",
		"",
		"",
		map[string]any{"display_name": "Alice"},
	)
	if createResponse.StatusCode != http.StatusCreated {
		t.Fatalf("create status %d", createResponse.StatusCode)
	}
	var created application.LobbyResult
	decodeResponse(t, createResponse, &created)
	if created.Credential == "" ||
		created.GameID == "" ||
		created.Projection.RulesProfileID != game.FirstEditionCoreProfileID {
		t.Fatalf("missing identity result: %#v", created)
	}

	getResponse := requestJSON(
		t,
		server.Client(),
		http.MethodGet,
		server.URL+"/api/v1/games/"+created.GameID,
		created.Credential,
		"",
		nil,
	)
	if getResponse.StatusCode != http.StatusOK {
		t.Fatalf("get status %d", getResponse.StatusCode)
	}
	var projection game.Projection
	decodeResponse(t, getResponse, &projection)
	if projection.You.PlayerID != created.PlayerID {
		t.Fatalf("wrong actor projection: %#v", projection.You)
	}

	forged := requestJSON(
		t,
		server.Client(),
		http.MethodGet,
		server.URL+"/api/v1/games/"+created.GameID,
		"forged",
		"",
		nil,
	)
	if forged.StatusCode != http.StatusForbidden {
		t.Fatalf("forged status %d", forged.StatusCode)
	}
	forged.Body.Close()
}

func TestLobbySummaryAndJoinAreBrowserSafe(t *testing.T) {
	_, server := testRouter(t)
	createResponse := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/lobbies",
		"",
		"",
		map[string]any{"display_name": "Alice"},
	)
	var created application.LobbyResult
	decodeResponse(t, createResponse, &created)

	summaryResponse := requestJSON(
		t,
		server.Client(),
		http.MethodGet,
		server.URL+"/api/v1/lobbies/"+created.GameID,
		"",
		"",
		nil,
	)
	if summaryResponse.StatusCode != http.StatusOK {
		t.Fatalf("summary status %d", summaryResponse.StatusCode)
	}
	var summary application.LobbySummary
	decodeResponse(t, summaryResponse, &summary)
	if summary.MinPlayers != 1 ||
		summary.MaxPlayers != 6 ||
		summary.RulesProfileID != game.FirstEditionCoreProfileID {
		t.Fatalf("rules profile missing from summary: %#v", summary)
	}

	joined := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/players",
		"join-client-credential",
		"join-http-1",
		map[string]any{
			"display_name":     "Bob",
			"expected_version": summary.Version,
		},
	)
	if joined.StatusCode != http.StatusCreated {
		t.Fatalf("join status %d", joined.StatusCode)
	}
	var result application.LobbyResult
	decodeResponse(t, joined, &result)
	if result.Credential != "join-client-credential" || result.Projection.IsOwner {
		t.Fatalf("unexpected join result: %#v", result)
	}
}

func TestTypedCommandRoutesAndUnknownPayloadFailClosed(t *testing.T) {
	_, server := testRouter(t)
	createResponse := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/lobbies",
		"",
		"",
		map[string]any{"display_name": "Alice"},
	)
	var created application.LobbyResult
	decodeResponse(t, createResponse, &created)

	started := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/start",
		created.Credential,
		"start-http-1",
		map[string]any{"expected_version": created.Projection.Version},
	)
	if started.StatusCode != http.StatusOK {
		t.Fatalf("start status %d", started.StatusCode)
	}
	var startResult application.CommandResult
	decodeResponse(t, started, &startResult)
	if startResult.Projection.Turn.Phase != game.PhaseSetup {
		t.Fatalf("unexpected setup projection: %#v", startResult.Projection.Turn)
	}

	finished := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/commands/finish-setup",
		created.Credential,
		"setup-http-1",
		map[string]any{"expected_version": startResult.Version},
	)
	if finished.StatusCode != http.StatusOK {
		t.Fatalf("finish setup status %d", finished.StatusCode)
	}
	var setupResult application.CommandResult
	decodeResponse(t, finished, &setupResult)

	opened := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/commands/open-door",
		created.Credential,
		"open-http-1",
		map[string]any{"expected_version": setupResult.Version},
	)
	if opened.StatusCode != http.StatusOK {
		t.Fatalf("open door status %d", opened.StatusCode)
	}
	var openResult application.CommandResult
	decodeResponse(t, opened, &openResult)
	if openResult.Projection.Version <= setupResult.Projection.Version {
		t.Fatal("typed command did not advance version")
	}

	unknown := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/commands/play-card",
		created.Credential,
		"unknown-http-1",
		map[string]any{
			"expected_version": openResult.Version,
			"instance_id":      "forged",
			"player_id":        created.PlayerID,
		},
	)
	if unknown.StatusCode != http.StatusBadRequest {
		t.Fatalf("authority field was not rejected: %d", unknown.StatusCode)
	}
	unknown.Body.Close()

	forgedSelection := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/commands/play-card",
		created.Credential,
		"forged-http-1",
		map[string]any{
			"expected_version": openResult.Version,
			"instance_id":      "forged",
		},
	)
	if forgedSelection.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("forged selection status %d", forgedSelection.StatusCode)
	}
	forgedSelection.Body.Close()
}

func TestCORSPreflightUsesExactAllowlistOrigin(t *testing.T) {
	service := application.NewService(
		memory.New(),
		routerPack(t),
		application.SystemClock{},
		application.NoopPublisher{},
	)
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/lobbies", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Method", "POST")
	request.Header.Set("Access-Control-Request-Headers", "Content-Type")
	response := httptest.NewRecorder()
	New(service).ServeHTTP(response, request)
	if response.Code != http.StatusNoContent ||
		response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf(
			"preflight response: status=%d headers=%v",
			response.Code,
			response.Header(),
		)
	}
}

func TestCommandRequiresIdempotencyKey(t *testing.T) {
	service, server := testRouter(t)
	created, err := service.CreateLobby(context.Background(), "Alice")
	if err != nil {
		t.Fatal(err)
	}
	response := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/start",
		created.Credential,
		"",
		map[string]any{"expected_version": created.Projection.Version},
	)
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("status %d", response.StatusCode)
	}
	response.Body.Close()
}

func TestInteractionRoutesUseActorProjectionAndRejectAuthorityFields(t *testing.T) {
	service, server := testRouter(t)
	ctx := context.Background()
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	joined, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"interaction-http-credential",
		"interaction-http-join",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil {
		t.Fatal(err)
	}
	started, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"interaction-http-start",
		joined.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	interactionID, err := service.OpenInteraction(
		ctx,
		owner.GameID,
		"interaction-http-open",
		started.Version,
		application.InteractionOpenSpec{
			Kind: game.InteractionKindCombatResponse,
			Parent: game.InteractionParent{
				Phase:       started.Projection.Turn.Phase,
				SubjectKind: game.InteractionSubjectTurn,
				SubjectID:   started.Projection.Turn.PlayerID,
			},
			InitiatorActorID:  owner.PlayerID,
			EligibilityPolicy: game.InteractionEligibilityPublicPredicate,
			AllowedIntents: []game.InteractionIntent{
				game.InteractionIntentPass,
				game.InteractionIntentRespond,
			},
			Participants: []application.InteractionParticipant{{
				ActorID:       joined.PlayerID,
				Requirement:   game.InteractionResponseOptional,
				TimeoutIntent: game.InteractionIntentPass,
			}},
			DeadlinePolicy: game.CollectiveInteractionDeadlinePolicy(),
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	projection, err := service.Get(ctx, owner.GameID, joined.Credential)
	if err != nil || projection.Interaction == nil {
		t.Fatalf("interaction projection=%#v err=%v", projection.Interaction, err)
	}
	action := projection.Interaction.Actions[0]
	for _, candidate := range projection.Interaction.Actions {
		if candidate.Type == game.InteractionIntentPass {
			action = candidate
			break
		}
	}
	forged := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+"/commands/pass-interaction",
		"forged",
		"interaction-http-forged-credential",
		map[string]any{
			"expected_version": projection.Version,
			"interaction_id":   interactionID,
			"action_id":        action.ActionID,
			"intent":           game.InteractionIntentPass,
		},
	)
	if forged.StatusCode != http.StatusForbidden {
		t.Fatalf("forged interaction credential status %d", forged.StatusCode)
	}
	forged.Body.Close()
	response := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+"/commands/pass-interaction",
		joined.Credential,
		"interaction-http-pass",
		map[string]any{
			"expected_version": projection.Version,
			"interaction_id":   interactionID,
			"action_id":        action.ActionID,
			"intent":           game.InteractionIntentPass,
		},
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("interaction pass status %d", response.StatusCode)
	}
	var result application.CommandResult
	decodeResponse(t, response, &result)
	if result.Projection.Interaction != nil {
		t.Fatalf("closed interaction remained projected: %#v", result.Projection.Interaction)
	}

	unknownAuthority := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+"/commands/respond-interaction",
		joined.Credential,
		"interaction-http-forged",
		map[string]any{
			"expected_version":  projection.Version,
			"interaction_id":    interactionID,
			"action_id":         action.ActionID,
			"intent":            game.InteractionIntentRespond,
			"deadline_revision": 1,
		},
	)
	if unknownAuthority.StatusCode != http.StatusBadRequest {
		t.Fatalf("authority field status %d", unknownAuthority.StatusCode)
	}
	unknownAuthority.Body.Close()
}

func TestInteractionProjectionFixtureIsStrictGoContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/interaction-projection-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var projection game.Projection
	if err := decoder.Decode(&projection); err != nil {
		t.Fatal(err)
	}
	if projection.Interaction == nil ||
		projection.Interaction.InteractionID == "" ||
		len(projection.Interaction.Actions) != 2 {
		t.Fatalf("invalid interaction fixture: %#v", projection.Interaction)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"deadline_revision",
		"responses",
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("fixture leaked %q", forbidden)
		}
	}
}

func requestJSON(
	t *testing.T,
	client *http.Client,
	method, url, credential, idempotencyKey string,
	body any,
) *http.Response {
	t.Helper()
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	request, err := http.NewRequest(method, url, bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	if credential != "" {
		request.Header.Set("Authorization", "Bearer "+credential)
	}
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func decodeResponse(t *testing.T, response *http.Response, target any) {
	t.Helper()
	defer response.Body.Close()
	if err := json.NewDecoder(response.Body).Decode(target); err != nil {
		t.Fatal(err)
	}
}

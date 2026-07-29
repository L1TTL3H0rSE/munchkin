package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/leinodev/munchkin/backend/game/internal/application"
	"github.com/leinodev/munchkin/backend/game/internal/game"
	"github.com/leinodev/munchkin/backend/game/internal/repository/memory"
)

func routerPack(t *testing.T) game.Pack {
	t.Helper()
	cards := make([]game.Card, 0, 24)
	for index := 0; index < 12; index++ {
		cards = append(cards, game.Card{ID: "door-" + string(rune('a'+index)), Name: "Door", Kind: game.CardDoor})
	}
	for index := 0; index < 12; index++ {
		cards = append(cards, game.Card{ID: "treasure-" + string(rune('a'+index)), Name: "Treasure", Kind: game.CardTreasure})
	}
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "http-test",
		Version:       1,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "test-fixture",
		ContentDigest: game.CardsDigest(cards),
		Cards:         cards,
	}
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func TestCreateGetAndForgedCredential(t *testing.T) {
	service := application.NewService(
		memory.New(),
		routerPack(t),
		application.SystemClock{},
		application.NoopPublisher{},
	)
	server := httptest.NewServer(New(service))
	defer server.Close()

	createResponse := requestJSON(t, server.Client(), http.MethodPost, server.URL+"/api/v1/lobbies", "", "", map[string]any{
		"display_name": "Alice",
	})
	if createResponse.StatusCode != http.StatusCreated {
		t.Fatalf("create status %d", createResponse.StatusCode)
	}
	var created application.LobbyResult
	decodeResponse(t, createResponse, &created)
	if created.Credential == "" || created.GameID == "" {
		t.Fatalf("missing credential result: %#v", created)
	}

	getResponse := requestJSON(t, server.Client(), http.MethodGet, server.URL+"/api/v1/games/"+created.GameID, created.Credential, "", nil)
	if getResponse.StatusCode != http.StatusOK {
		t.Fatalf("get status %d", getResponse.StatusCode)
	}
	var projection game.Projection
	decodeResponse(t, getResponse, &projection)
	if projection.You.PlayerID != created.PlayerID {
		t.Fatalf("wrong actor projection: %#v", projection.You)
	}

	forged := requestJSON(t, server.Client(), http.MethodGet, server.URL+"/api/v1/games/"+created.GameID, "forged", "", nil)
	if forged.StatusCode != http.StatusForbidden {
		t.Fatalf("forged status %d", forged.StatusCode)
	}
	forged.Body.Close()
}

func TestLobbySummaryAndJoinAreBrowserSafe(t *testing.T) {
	service := application.NewService(
		memory.New(),
		routerPack(t),
		application.SystemClock{},
		application.NoopPublisher{},
	)
	server := httptest.NewServer(New(service))
	defer server.Close()

	createResponse := requestJSON(t, server.Client(), http.MethodPost, server.URL+"/api/v1/lobbies", "", "", map[string]any{
		"display_name": "Alice",
	})
	var created application.LobbyResult
	decodeResponse(t, createResponse, &created)

	summaryResponse := requestJSON(t, server.Client(), http.MethodGet, server.URL+"/api/v1/lobbies/"+created.GameID, "", "", nil)
	if summaryResponse.StatusCode != http.StatusOK {
		t.Fatalf("summary status %d", summaryResponse.StatusCode)
	}
	var summary application.LobbySummary
	decodeResponse(t, summaryResponse, &summary)

	joined := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+created.GameID+"/players",
		"join-client-credential",
		"join-http-1",
		map[string]any{"display_name": "Bob", "expected_version": summary.Version},
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

func TestCORSPreflightUsesExactAllowlistOrigin(t *testing.T) {
	service := application.NewService(memory.New(), routerPack(t), application.SystemClock{}, application.NoopPublisher{})
	request := httptest.NewRequest(http.MethodOptions, "/api/v1/lobbies", nil)
	request.Header.Set("Origin", "http://localhost:3000")
	request.Header.Set("Access-Control-Request-Method", "POST")
	request.Header.Set("Access-Control-Request-Headers", "Content-Type")
	response := httptest.NewRecorder()
	New(service).ServeHTTP(response, request)
	if response.Code != http.StatusNoContent ||
		response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Fatalf("preflight response: status=%d headers=%v", response.Code, response.Header())
	}
}

func TestCommandRequiresIdempotencyKey(t *testing.T) {
	service := application.NewService(memory.New(), routerPack(t), application.SystemClock{}, application.NoopPublisher{})
	created, err := service.CreateLobby(context.Background(), "Alice")
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(New(service))
	defer server.Close()

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

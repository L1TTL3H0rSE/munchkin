package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
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
	return testRouterWithPack(t, routerPack(t))
}

func testRouterWithPack(
	t *testing.T,
	pack game.Pack,
) (*application.Service, *httptest.Server) {
	t.Helper()
	service := application.NewService(
		memory.New(),
		pack,
		application.SystemClock{},
		application.NoopPublisher{},
	)
	server := httptest.NewServer(New(service))
	t.Cleanup(server.Close)
	return service, server
}

func routerCombatPack(t *testing.T) game.Pack {
	t.Helper()
	cards := make([]game.Card, 0, 13)
	for index := 0; index < 6; index++ {
		cards = append(cards, game.Card{
			ID:               fmt.Sprintf("router-monster-%d", index),
			Name:             fmt.Sprintf("Router Monster %d", index),
			Deck:             game.DeckDoor,
			Kind:             game.CardMonster,
			Copies:           5,
			InteractionScope: game.InteractionNone,
			Monster: &game.MonsterSpec{
				Strength:  2,
				Treasures: 1,
				Levels:    1,
				BadStuff: []game.Effect{{
					Kind:   game.EffectLoseLevel,
					Amount: 1,
				}},
			},
		})
		cards = append(cards, game.Card{
			ID:               fmt.Sprintf("router-item-%d", index),
			Name:             fmt.Sprintf("Router Item %d", index),
			Deck:             game.DeckTreasure,
			Kind:             game.CardItem,
			Copies:           5,
			InteractionScope: game.InteractionSelf,
			Item: &game.ItemSpec{
				Slot:  game.SlotNone,
				Size:  game.SizeSmall,
				Value: 100,
			},
		})
	}
	cards = append(cards, game.Card{
		ID:               "router-intervention",
		Name:             "Router Intervention",
		Deck:             game.DeckTreasure,
		Kind:             game.CardOneShot,
		Copies:           2,
		InteractionScope: game.InteractionOtherPlayers,
		Effects: []game.Effect{{
			Kind:   game.EffectModifyCombat,
			Amount: 2,
			Target: game.EffectTargetPlayer,
		}},
	})
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "router-combat-test",
		Version:       1,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "test-fixture",
		Cards:         cards,
	}
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
}

func routerTargetPack(t *testing.T) game.Pack {
	t.Helper()
	cards := make([]game.Card, 0, 12)
	for index := 0; index < 10; index++ {
		cards = append(cards, game.Card{
			ID: fmt.Sprintf(
				"router-target-curse-%d",
				index,
			),
			Name:             "Router target curse",
			Deck:             game.DeckDoor,
			Kind:             game.CardCurse,
			Copies:           30,
			InteractionScope: game.InteractionOtherPlayers,
			Effects: []game.Effect{{
				Kind:     game.EffectDiscard,
				Selector: game.SelectorOwnedCard,
				Count:    1,
			}},
		})
	}
	cards = append(
		cards,
		game.Card{
			ID:               "router-target-monster",
			Name:             "Router target filler monster",
			Deck:             game.DeckDoor,
			Kind:             game.CardMonster,
			Copies:           25,
			InteractionScope: game.InteractionNone,
			Monster: &game.MonsterSpec{
				Strength:  2,
				Treasures: 1,
				Levels:    1,
				BadStuff: []game.Effect{{
					Kind:   game.EffectLoseLevel,
					Amount: 1,
				}},
			},
		},
		game.Card{
			ID:               "router-target-item",
			Name:             "Router target filler item",
			Deck:             game.DeckTreasure,
			Kind:             game.CardItem,
			Copies:           25,
			InteractionScope: game.InteractionSelf,
			Item: &game.ItemSpec{
				Slot:  game.SlotNone,
				Size:  game.SizeSmall,
				Value: 100,
			},
		},
	)
	pack := game.Pack{
		SchemaVersion: 1,
		SetID:         "moscow-core",
		Version:       3,
		Author:        "tests",
		License:       "CC0-1.0",
		Source:        "router-target-test",
		Cards:         cards,
	}
	pack.ContentDigest = game.CardsDigest(pack.Cards)
	if err := pack.Validate(); err != nil {
		t.Fatal(err)
	}
	return pack
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
		created.Projection.RulesProfileID != game.LobbyMultiplayerProfileID {
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

func TestEconomyHTTPRejectsForeignClauseAndHidesOfferFromObserver(
	t *testing.T,
) {
	ctx := context.Background()
	service, server := testRouterWithPack(t, routerTargetPack(t))
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	bob, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"router-economy-bob-credential-0001",
		"router-economy-join-bob",
		owner.Projection.Version,
		"Bob",
	)
	if err != nil {
		t.Fatal(err)
	}
	cara, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"router-economy-cara-credential-001",
		"router-economy-join-cara",
		bob.Projection.Version,
		"Cara",
	)
	if err != nil {
		t.Fatal(err)
	}
	current, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"router-economy-start",
		cara.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	for index, participant := range []application.LobbyResult{
		owner,
		bob,
		cara,
	} {
		current, err = service.Execute(
			ctx,
			owner.GameID,
			participant.Credential,
			fmt.Sprintf("router-economy-setup-%d", index),
			current.Version,
			game.Command{Type: game.CommandFinishSetup},
		)
		if err != nil {
			t.Fatal(err)
		}
	}
	ownerProjection, err := service.Get(
		ctx,
		owner.GameID,
		owner.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	giftCandidateID := ""
	for _, card := range ownerProjection.You.Hand {
		if card.Kind == game.CardItem {
			giftCandidateID = card.InstanceID
			break
		}
	}
	if giftCandidateID == "" {
		t.Fatal("owner has no gift candidate")
	}
	played, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"router-economy-carry",
		current.Version,
		game.Command{
			Type:       game.CommandPlayCard,
			InstanceID: giftCandidateID,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	bobProjection, err := service.Get(
		ctx,
		owner.GameID,
		bob.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	foreign := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/propose-gift",
		owner.Credential,
		"router-economy-foreign",
		map[string]any{
			"expected_version":    played.Version,
			"recipient_player_id": bob.PlayerID,
			"offered_instance_ids": []string{
				bobProjection.You.Hand[0].InstanceID,
			},
		},
	)
	if foreign.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("foreign economy status=%d", foreign.StatusCode)
	}
	valid := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/propose-gift",
		owner.Credential,
		"router-economy-valid",
		map[string]any{
			"expected_version":    played.Version,
			"recipient_player_id": bob.PlayerID,
			"offered_instance_ids": []string{
				played.Projection.You.Carried[0].InstanceID,
			},
		},
	)
	if valid.StatusCode != http.StatusOK {
		t.Fatalf("valid economy status=%d", valid.StatusCode)
	}
	var opened application.CommandResult
	decodeResponse(t, valid, &opened)
	observer := requestJSON(
		t,
		server.Client(),
		http.MethodGet,
		server.URL+"/api/v1/games/"+owner.GameID,
		cara.Credential,
		"",
		nil,
	)
	if observer.StatusCode != http.StatusOK {
		t.Fatalf("observer economy status=%d", observer.StatusCode)
	}
	var observerProjection game.Projection
	decodeResponse(t, observer, &observerProjection)
	if observerProjection.Interaction == nil ||
		observerProjection.Interaction.PublicKind != "economy_offer" ||
		observerProjection.Interaction.EconomyOffer != nil {
		t.Fatalf(
			"observer economy leak=%#v",
			observerProjection.Interaction,
		)
	}
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
		summary.RulesProfileID != game.LobbyMultiplayerProfileID {
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
	allowedHeaders := response.Header().Get("Access-Control-Allow-Headers")
	if response.Code != http.StatusNoContent ||
		response.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" ||
		!strings.Contains(allowedHeaders, "Traceparent") ||
		!strings.Contains(allowedHeaders, "Tracestate") ||
		strings.Contains(allowedHeaders, "Baggage") {
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

func TestPlayTargetEffectRouteUsesServerTargetAndOpaqueWindow(t *testing.T) {
	ctx := context.Background()
	service, server := testRouterWithPack(t, routerTargetPack(t))
	var (
		owner          application.LobbyResult
		target         application.LobbyResult
		setupCompleted application.CommandResult
		sourceID       string
	)
	for attempt := 0; attempt < 8 && sourceID == ""; attempt++ {
		var err error
		owner, err = service.CreateLobby(ctx, "Alice")
		if err != nil {
			t.Fatal(err)
		}
		target, err = service.JoinLobby(
			ctx,
			owner.GameID,
			fmt.Sprintf(
				"router-target-bob-credential-%02d",
				attempt,
			),
			"router-target-join",
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
			"router-target-start",
			target.Projection.Version,
			game.Command{Type: game.CommandStart},
		)
		if err != nil {
			t.Fatal(err)
		}
		ownerSetup, err := service.Execute(
			ctx,
			owner.GameID,
			owner.Credential,
			"router-target-owner-setup",
			started.Version,
			game.Command{Type: game.CommandFinishSetup},
		)
		if err != nil {
			t.Fatal(err)
		}
		setupCompleted, err = service.Execute(
			ctx,
			owner.GameID,
			target.Credential,
			"router-target-other-setup",
			ownerSetup.Version,
			game.Command{Type: game.CommandFinishSetup},
		)
		if err != nil {
			t.Fatal(err)
		}
		projection, err := service.Get(
			ctx,
			owner.GameID,
			owner.Credential,
		)
		if err != nil {
			t.Fatal(err)
		}
		for _, card := range projection.You.Hand {
			if card.Kind == game.CardCurse {
				sourceID = card.InstanceID
				break
			}
		}
	}
	if sourceID == "" {
		t.Fatal("target route fixture did not deal a target source")
	}

	forged := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/play-target-effect",
		owner.Credential,
		"router-target-forged",
		map[string]any{
			"expected_version": setupCompleted.Version,
			"instance_id":      sourceID,
			"target_player_id": target.PlayerID,
			"player_id":        target.PlayerID,
		},
	)
	if forged.StatusCode != http.StatusBadRequest {
		t.Fatalf("forged target authority status %d", forged.StatusCode)
	}
	forged.Body.Close()

	selfTarget := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/play-target-effect",
		owner.Credential,
		"router-target-self",
		map[string]any{
			"expected_version": setupCompleted.Version,
			"instance_id":      sourceID,
			"target_player_id": owner.PlayerID,
		},
	)
	if selfTarget.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("invalid server target status %d", selfTarget.StatusCode)
	}
	selfTarget.Body.Close()

	response := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/play-target-effect",
		owner.Credential,
		"router-target-play",
		map[string]any{
			"expected_version": setupCompleted.Version,
			"instance_id":      sourceID,
			"target_player_id": target.PlayerID,
		},
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("play target status %d", response.StatusCode)
	}
	var result application.CommandResult
	decodeResponse(t, response, &result)
	if result.Projection.Interaction == nil ||
		result.Projection.Interaction.PublicKind != "target_response" ||
		result.Projection.Interaction.TargetPlayerID != target.PlayerID {
		t.Fatalf("target route result: %#v", result.Projection.Interaction)
	}

	targetProjection, err := service.Get(
		ctx,
		owner.GameID,
		target.Credential,
	)
	if err != nil {
		t.Fatal(err)
	}
	if targetProjection.Interaction == nil ||
		!targetProjection.Interaction.ResponseRequiredForYou ||
		len(targetProjection.Interaction.Actions) != 1 ||
		targetProjection.Interaction.Actions[0].Type !=
			game.InteractionIntentPass {
		t.Fatalf(
			"opaque target response projection: %#v",
			targetProjection.Interaction,
		)
	}

	replay := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/play-target-effect",
		owner.Credential,
		"router-target-play",
		map[string]any{
			"expected_version": setupCompleted.Version,
			"instance_id":      sourceID,
			"target_player_id": target.PlayerID,
		},
	)
	if replay.StatusCode != http.StatusOK {
		t.Fatalf("target replay status %d", replay.StatusCode)
	}
	var replayed application.CommandResult
	decodeResponse(t, replay, &replayed)
	if !replayed.Replayed || replayed.Version != result.Version {
		t.Fatalf("target route replay: %#v", replayed)
	}
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
	hiddenLootAuthority := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/respond-interaction",
		joined.Credential,
		"interaction-http-hidden-loot",
		map[string]any{
			"expected_version": projection.Version,
			"interaction_id":   interactionID,
			"action_id":        action.ActionID,
			"intent":           game.InteractionIntentRespond,
			"instance_id":      "foreign-hidden-loot-card",
		},
	)
	if hiddenLootAuthority.StatusCode != http.StatusBadRequest {
		t.Fatalf(
			"hidden loot authority status %d",
			hiddenLootAuthority.StatusCode,
		)
	}
	hiddenLootAuthority.Body.Close()
}

func TestCombatResolutionRequestRouteIsStrictAndServerAuthoritative(t *testing.T) {
	service, server := testRouterWithPack(t, routerCombatPack(t))
	ctx := context.Background()
	owner, err := service.CreateLobby(ctx, "Alice")
	if err != nil {
		t.Fatal(err)
	}
	responder, err := service.JoinLobby(
		ctx,
		owner.GameID,
		"router-combat-responder-credential",
		"router-combat-join",
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
		"router-combat-start",
		responder.Projection.Version,
		game.Command{Type: game.CommandStart},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupOwner, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"router-combat-setup-owner",
		started.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	setupResponder, err := service.Execute(
		ctx,
		owner.GameID,
		responder.Credential,
		"router-combat-setup-responder",
		setupOwner.Version,
		game.Command{Type: game.CommandFinishSetup},
	)
	if err != nil {
		t.Fatal(err)
	}
	opened, err := service.Execute(
		ctx,
		owner.GameID,
		owner.Credential,
		"router-combat-open",
		setupResponder.Version,
		game.Command{Type: game.CommandOpenDoor},
	)
	if err != nil {
		t.Fatal(err)
	}
	if opened.Projection.Turn.Phase != game.PhaseCombat {
		t.Fatalf("fixture phase: %s", opened.Projection.Turn.Phase)
	}

	direct := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+"/commands/resolve-combat",
		owner.Credential,
		"router-combat-direct",
		map[string]any{"expected_version": opened.Version},
	)
	if direct.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("direct resolve status %d", direct.StatusCode)
	}
	direct.Body.Close()

	forged := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/request-combat-resolution",
		owner.Credential,
		"router-combat-forged",
		map[string]any{
			"expected_version":   opened.Version,
			"source_instance_id": "forged",
		},
	)
	if forged.StatusCode != http.StatusBadRequest {
		t.Fatalf("forged combat request status %d", forged.StatusCode)
	}
	forged.Body.Close()

	response := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/request-combat-resolution",
		owner.Credential,
		"router-combat-request",
		map[string]any{"expected_version": opened.Version},
	)
	if response.StatusCode != http.StatusOK {
		t.Fatalf("combat request status %d", response.StatusCode)
	}
	var result application.CommandResult
	decodeResponse(t, response, &result)
	if result.Projection.Interaction == nil ||
		result.Projection.Interaction.PublicKind != "combat_response" ||
		result.Projection.RulesProfileID != game.LobbyMultiplayerProfileID {
		t.Fatalf("combat response result: %#v", result.Projection)
	}
	var offer game.InteractionActionView
	for _, action := range result.Projection.Interaction.Actions {
		if action.Type == game.InteractionIntentOfferHelp {
			offer = action
			break
		}
	}
	if offer.ActionID == "" ||
		offer.HelperPlayerID != responder.PlayerID ||
		offer.RewardTreasures != 1 {
		t.Fatalf("server-owned helper action: %#v", result.Projection.Interaction)
	}
	unknownAuthority := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+"/commands/combat-help",
		owner.Credential,
		"router-combat-help-forged",
		map[string]any{
			"expected_version": result.Version,
			"action_id":        offer.ActionID,
			"helper_player_id": responder.PlayerID,
			"reward_treasures": 99,
		},
	)
	if unknownAuthority.StatusCode != http.StatusBadRequest {
		t.Fatalf("combat-help authority status %d", unknownAuthority.StatusCode)
	}
	unknownAuthority.Body.Close()
	offeredResponse := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+"/commands/combat-help",
		owner.Credential,
		"router-combat-help-offer",
		map[string]any{
			"expected_version": result.Version,
			"action_id":        offer.ActionID,
		},
	)
	if offeredResponse.StatusCode != http.StatusOK {
		t.Fatalf("combat-help offer status %d", offeredResponse.StatusCode)
	}
	var offered application.CommandResult
	decodeResponse(t, offeredResponse, &offered)
	if offered.Projection.Interaction == nil ||
		offered.Projection.Interaction.PublicKind != "combat_help_offer" ||
		offered.Projection.Interaction.CombatHelpOffer == nil {
		t.Fatalf("combat-help owner result: %#v", offered.Projection.Interaction)
	}
	helperProjectionResponse := requestJSON(
		t,
		server.Client(),
		http.MethodGet,
		server.URL+"/api/v1/games/"+owner.GameID,
		responder.Credential,
		"",
		nil,
	)
	if helperProjectionResponse.StatusCode != http.StatusOK {
		t.Fatalf("helper projection status %d", helperProjectionResponse.StatusCode)
	}
	var helperProjection game.Projection
	decodeResponse(t, helperProjectionResponse, &helperProjection)
	var accept game.InteractionActionView
	for _, action := range helperProjection.Interaction.Actions {
		if action.Type == game.InteractionIntentAccept {
			accept = action
			break
		}
	}
	if accept.ActionID == "" ||
		helperProjection.Interaction.CombatHelpOffer == nil ||
		helperProjection.Interaction.CombatHelpOffer.RewardTreasures != 1 {
		t.Fatalf("helper private offer: %#v", helperProjection.Interaction)
	}
	forgedAccept := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/respond-interaction",
		responder.Credential,
		"router-combat-help-accept-forged",
		map[string]any{
			"expected_version": offered.Version,
			"interaction_id":   helperProjection.Interaction.InteractionID,
			"action_id":        accept.ActionID,
			"intent":           game.InteractionIntentAccept,
			"reward_treasures": 1,
		},
	)
	if forgedAccept.StatusCode != http.StatusBadRequest {
		t.Fatalf("forged helper accept status %d", forgedAccept.StatusCode)
	}
	forgedAccept.Body.Close()
	acceptedResponse := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/"+owner.GameID+
			"/commands/respond-interaction",
		responder.Credential,
		"router-combat-help-accept",
		map[string]any{
			"expected_version": offered.Version,
			"interaction_id":   helperProjection.Interaction.InteractionID,
			"action_id":        accept.ActionID,
			"intent":           game.InteractionIntentAccept,
		},
	)
	if acceptedResponse.StatusCode != http.StatusOK {
		t.Fatalf("helper accept status %d", acceptedResponse.StatusCode)
	}
	var accepted application.CommandResult
	decodeResponse(t, acceptedResponse, &accepted)
	if accepted.Projection.Turn.Combat == nil ||
		accepted.Projection.Turn.Combat.HelperPlayerID != responder.PlayerID ||
		accepted.Projection.Turn.Combat.HelperRewardTreasures != 1 {
		t.Fatalf("accepted helper combat projection: %#v", accepted.Projection.Turn.Combat)
	}
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

func TestCombatResponseProjectionFixtureIsStrictGoContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/combat-response-projection-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var projection game.Projection
	if err := decoder.Decode(&projection); err != nil {
		t.Fatal(err)
	}
	if projection.RulesProfileID != game.LobbyMultiplayerProfileID ||
		projection.Interaction == nil ||
		projection.Interaction.PublicKind != "combat_response" ||
		len(projection.Interaction.Actions) != 2 ||
		projection.Interaction.Actions[1].SourceInstanceID == "" ||
		projection.Interaction.Actions[1].Target != game.EffectTargetPlayer {
		t.Fatalf("invalid combat fixture: %#v", projection.Interaction)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"deadline_revision",
		"responses",
		"credential_hash",
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("combat fixture leaked %q", forbidden)
		}
	}
}

func TestAdvancedCombatProjectionFixtureIsStrictActorContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/advanced-combat-projection-v1.json")
	if err != nil {
		t.Fatal(err)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var projection game.Projection
	if err := decoder.Decode(&projection); err != nil {
		t.Fatal(err)
	}
	if projection.RulesProfileID != game.AdvancedCombatProfileID ||
		projection.Turn.Combat == nil ||
		len(projection.Turn.Combat.Monsters) != 2 ||
		len(projection.Turn.Combat.Effects) != 1 ||
		projection.Interaction == nil ||
		len(projection.Interaction.Actions) != 2 {
		t.Fatalf("invalid advanced combat fixture: %#v", projection)
	}
	action := projection.Interaction.Actions[1]
	if action.CombatCapability != game.CombatCapabilityCounter ||
		action.TargetEffectID != projection.Turn.Combat.Effects[0].EffectID ||
		action.TargetEffectID == action.SourceInstanceID {
		t.Fatalf("invalid opaque counter descriptor: %#v", action)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"deadline_revision",
		"responses",
		"credential_hash",
		"sudden-traffic-jam",
		"source_event",
		"target_path",
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("advanced combat fixture leaked %q", forbidden)
		}
	}
}

func TestTargetEffectProjectionFixtureIsStrictActorContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/target-effect-projection-v1.json")
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
		projection.Interaction.PublicKind != "target_response" ||
		projection.Interaction.TargetPlayerID != "player_b" ||
		len(projection.Interaction.Actions) != 2 {
		t.Fatalf("invalid target fixture: %#v", projection.Interaction)
	}
	counter := projection.Interaction.Actions[1]
	if counter.CombatCapability != game.CombatCapabilityCounter ||
		!strings.HasPrefix(counter.TargetEffectID, "tfx_") ||
		counter.SourceInstanceID == "" {
		t.Fatalf("invalid target counter descriptor: %#v", counter)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"deadline_revision",
		"responses",
		"credential_hash",
		"pending_finalize",
		"target_effect_source",
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("target fixture leaked %q", forbidden)
		}
	}
}

func TestRunAwayProjectionFixtureIsStrictActorContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/run-away-projection-v1.json")
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
		projection.Interaction.PublicKind != "run_away_response" ||
		projection.Turn.RunAway == nil ||
		len(projection.Turn.RunAway.Attempts) != 1 ||
		projection.Turn.RunAway.Attempts[0].Roll != 2 ||
		len(projection.Interaction.Actions) != 2 ||
		projection.Interaction.Actions[1].EscapeDelta != 2 {
		t.Fatalf("invalid Run Away fixture: %#v", projection)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"deadline_revision",
		"responses",
		"credential_hash",
		"rng_state",
		"participant_player_ids",
		"monster_instance_ids",
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("Run Away fixture leaked %q", forbidden)
		}
	}
}

func TestCombatHelpProjectionFixtureIsStrictPartyContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/combat-help-projection-v1.json")
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
		projection.Interaction.PublicKind != "combat_help_offer" ||
		projection.Interaction.CombatHelpOffer == nil ||
		projection.Interaction.CombatHelpOffer.HelperPlayerID !=
			projection.You.PlayerID ||
		projection.Interaction.CombatHelpOffer.RewardTreasures != 1 ||
		len(projection.Interaction.Actions) != 2 ||
		projection.Interaction.Actions[0].Type !=
			game.InteractionIntentAccept {
		t.Fatalf("invalid combat-help fixture: %#v", projection.Interaction)
	}
	for _, forbidden := range []string{
		"eligible_actor_ids",
		"initiator_actor_id",
		"deadline_revision",
		"responses",
		"credential_hash",
		"parent_deadline_at",
	} {
		if strings.Contains(string(raw), forbidden) {
			t.Fatalf("combat-help fixture leaked %q", forbidden)
		}
	}
}

func TestTheftRouteRejectsClientSelectedHiddenTarget(t *testing.T) {
	_, server := testRouter(t)
	response := requestJSON(
		t,
		server.Client(),
		http.MethodPost,
		server.URL+"/api/v1/games/game/commands/attempt-theft",
		"",
		"theft-hidden-target",
		map[string]any{
			"expected_version":   1,
			"source_instance_id": "source-1",
			"ability_index":      0,
			"cost_instance_ids":  []string{"own-cost-1"},
			"victim_player_id":   "player-b",
			"target_instance_id": "foreign-hidden-1",
		},
	)
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf(
			"hidden theft target status=%d",
			response.StatusCode,
		)
	}
	var body map[string]any
	decodeResponse(t, response, &body)
	if body["code"] != "invalid_request" {
		t.Fatalf("hidden theft target response=%#v", body)
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

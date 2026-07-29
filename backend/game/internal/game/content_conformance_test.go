package game

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestCanonicalDigestMatchesNodeForUnicodeAndHTMLEdges(t *testing.T) {
	card := Card{
		ID:               "digest-edge",
		Name:             "A & B < C > D\u2028E\u2029F",
		Deck:             DeckDoor,
		Kind:             CardCurse,
		Copies:           1,
		InteractionScope: InteractionSelf,
		Effects: []Effect{{
			Kind:   EffectLoseLevel,
			Amount: 1,
		}},
		RulesText: "A & B < C > D\u2028E\u2029F",
	}
	const expected = "sha256:c4b62b7a740da357057fdeda83caed6814d605ef99cf7c575074ba70b24a1b10"
	if actual := CardsDigest([]Card{card}); actual != expected {
		t.Fatalf("cross-runtime digest mismatch: got %s", actual)
	}
}

func TestMoscowPackDigestMaterializationAndGoNodeConformance(t *testing.T) {
	// The fixture lives outside this Go module. Use go test -count=1 when
	// verifying content-only edits so the Go test cache cannot hide drift.
	pack := loadMoscowPack(t)
	const expectedDigest = "sha256:e87f280cc53667659c38308dc213510749c8c87495c38cefc07f58f8bb094854"
	if pack.SetID != "moscow-core" ||
		pack.Version != 1 ||
		pack.Author != "L1TTL3H0rSE" ||
		pack.License != "All-Rights-Reserved" ||
		pack.Source != "original-moscow-core-2026" ||
		pack.ContentDigest != expectedDigest ||
		CardsDigest(pack.Cards) != expectedDigest {
		t.Fatalf(
			"unexpected Moscow identity: %s@%d %s",
			pack.SetID,
			pack.Version,
			pack.ContentDigest,
		)
	}

	var slots, doors, treasures, active, deferred int
	var activeDoors, activeTreasures int
	for _, card := range pack.Cards {
		if card.Copies != 1 {
			t.Fatalf("Moscow slot %s has copies=%d", card.ID, card.Copies)
		}
		if card.Image != "" || card.AltText != "" {
			t.Fatalf("text-only Moscow v1 has image metadata on %s", card.ID)
		}
		slots += card.Copies
		switch card.Deck {
		case DeckDoor:
			doors += card.Copies
		case DeckTreasure:
			treasures += card.Copies
		default:
			t.Fatalf("Moscow slot %s has unknown deck %q", card.ID, card.Deck)
		}
		if card.InteractionScope == InteractionOtherPlayers {
			deferred += card.Copies
			continue
		}
		active += card.Copies
		if card.Deck == DeckDoor {
			activeDoors += card.Copies
		} else {
			activeTreasures += card.Copies
		}
	}
	if len(pack.Cards) != 168 ||
		slots != 168 ||
		doors != 95 ||
		treasures != 73 ||
		active != 152 ||
		deferred != 16 ||
		activeDoors != 84 ||
		activeTreasures != 68 {
		t.Fatalf(
			"unexpected Moscow matrix: definitions=%d slots=%d doors=%d treasures=%d active=%d deferred=%d activeDoors=%d activeTreasures=%d",
			len(pack.Cards),
			slots,
			doors,
			treasures,
			active,
			deferred,
			activeDoors,
			activeTreasures,
		)
	}

	instances, materializedDoors, materializedTreasures, err := pack.Materialize()
	if err != nil {
		t.Fatal(err)
	}
	if len(instances) != 152 ||
		len(materializedDoors) != 84 ||
		len(materializedTreasures) != 68 {
		t.Fatalf(
			"unexpected materialized Moscow decks: instances=%d doors=%d treasures=%d",
			len(instances),
			len(materializedDoors),
			len(materializedTreasures),
		)
	}
	for _, instance := range instances {
		card, exists := pack.Card(instance.DefinitionID)
		if !exists {
			t.Fatalf("materialized definition %s is missing", instance.DefinitionID)
		}
		if card.InteractionScope == InteractionOtherPlayers {
			t.Fatalf("interaction-only card %s was materialized", card.ID)
		}
	}
}

func TestMoscowPursuitBoundaryMatchesRulesText(t *testing.T) {
	pack := loadMoscowPack(t)
	cases := []struct {
		name      string
		level     int
		wantPhase Phase
	}{
		{name: "level one is not pursued", level: 1, wantPhase: PhaseCharity},
		{name: "level two is not pursued", level: 2, wantPhase: PhaseCharity},
		{name: "level three is pursued", level: 3, wantPhase: PhaseRunAway},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			state, _ := startedState(t, pack, 1)
			state, _ = finishSetup(t, state, pack)
			state.Players[0].Level = test.level
			forceDoorTop(t, &state, "service-window-forty-seven")
			state, _ = applyCommand(
				t,
				state,
				Command{Type: CommandOpenDoor},
				pack,
			)
			state, _ = applyCommand(
				t,
				state,
				Command{Type: CommandResolveCombat},
				pack,
			)
			if state.Turn.Phase != test.wantPhase {
				t.Fatalf(
					"level %d resolved to %s, want %s",
					test.level,
					state.Turn.Phase,
					test.wantPhase,
				)
			}
		})
	}
}

func TestMoscowPackLoadsFromIsolatedContentDirectory(t *testing.T) {
	raw, err := os.ReadFile(moscowPackPath())
	if err != nil {
		t.Fatal(err)
	}
	checkout := t.TempDir()
	packPath := filepath.Join(
		checkout,
		"content",
		"sets",
		"moscow",
		"v1",
		"cards.json",
	)
	if err := os.MkdirAll(filepath.Dir(packPath), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(packPath, raw, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(
		filepath.Join(checkout, "content", "reference-local"),
	); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("isolated content unexpectedly has local references: %v", err)
	}

	pack, err := LoadPack(packPath)
	if err != nil {
		t.Fatal(err)
	}
	instances, doors, treasures, err := pack.Materialize()
	if err != nil {
		t.Fatal(err)
	}
	if len(instances) != 152 || len(doors) != 84 || len(treasures) != 68 {
		t.Fatalf(
			"isolated materialization mismatch: instances=%d doors=%d treasures=%d",
			len(instances),
			len(doors),
			len(treasures),
		)
	}
}

func TestLoadPackRejectsNonCanonicalJSONSources(t *testing.T) {
	sourcePath := filepath.Join(
		"..",
		"..",
		"..",
		"..",
		"content",
		"sets",
		"demo",
		"cards.json",
	)
	raw, err := os.ReadFile(sourcePath)
	if err != nil {
		t.Fatal(err)
	}
	cases := map[string][]byte{
		"trailing JSON":       append(append([]byte(nil), raw...), []byte("\n{}")...),
		"invalid UTF-8":       append(append([]byte(nil), raw...), byte(0xff)),
		"literal replacement": append(append([]byte(nil), raw...), []byte("\uFFFD")...),
		"escaped replacement": bytes.Replace(
			raw,
			[]byte(`"name": "Дворовый голубь"`),
			[]byte(`"name": "\uFFFD"`),
			1,
		),
		"null optional": bytes.Replace(
			raw,
			[]byte(`"rules_text": "Сильнее против туриста."`),
			[]byte(`"rules_text": null`),
			1,
		),
		"case-insensitive alias": bytes.Replace(
			raw,
			[]byte(`"id": "courtyard-pigeon"`),
			[]byte(`"ID": "courtyard-pigeon"`),
			1,
		),
		"empty optional array": bytes.Replace(
			raw,
			[]byte(`"interaction_scope": "none",`),
			[]byte("\"interaction_scope\": \"none\",\n      \"abilities\": [],"),
			1,
		),
	}
	for name, candidate := range cases {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "cards.json")
			if err := os.WriteFile(path, candidate, 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := LoadPack(path); !errors.Is(err, ErrInvalidContent) {
				t.Fatalf("expected invalid content, got %v", err)
			}
		})
	}
}

func TestGoSemanticValidationMatchesClosedNodeRegistry(t *testing.T) {
	cases := map[string]func(*Pack){
		"temporary Curse modifier": func(pack *Pack) {
			card := cardForMutation(t, pack, "wet-documents")
			card.Effects = []Effect{{
				Kind:   EffectModifyCombat,
				Amount: 2,
				Target: EffectTargetPlayer,
			}}
		},
		"persistent one-shot": func(pack *Pack) {
			card := cardForMutation(t, pack, "pocket-sand")
			card.Effects[0].Persistent = true
		},
		"irrelevant effect field": func(pack *Pack) {
			card := cardForMutation(t, pack, "wet-documents")
			card.Effects = []Effect{{
				Kind:   EffectLoseLevel,
				Amount: 1,
				Target: EffectTargetPlayer,
			}}
		},
		"duplicate trait tag": func(pack *Pack) {
			card := cardForMutation(t, pack, "swift-courier")
			card.Trait.Tags = append(card.Trait.Tags, card.Trait.Tags[0])
		},
		"restricted allowance item": func(pack *Pack) {
			card := cardForMutation(t, pack, "two-handed-sign")
			card.Item.BigAllowance = 1
		},
		"ability on Curse": func(pack *Pack) {
			card := cardForMutation(t, pack, "wet-documents")
			card.Abilities = []Ability{{
				Kind:         AbilityDiscardForCombat,
				Amount:       1,
				DiscardCount: 1,
			}}
		},
		"missing Curse effects": func(pack *Pack) {
			card := cardForMutation(t, pack, "wet-documents")
			card.Effects = nil
		},
		"invalid Bad Stuff modifier": func(pack *Pack) {
			card := cardForMutation(t, pack, "courtyard-pigeon")
			card.Monster.BadStuff = []Effect{{
				Kind:   EffectModifyEscape,
				Amount: -1,
			}}
		},
		"winning level-up": func(pack *Pack) {
			card := cardForMutation(t, pack, "late-train-lesson")
			card.Effects[0].CanWin = true
		},
		"unsafe content version": func(pack *Pack) {
			pack.Version = maxSafeContentVersion + 1
		},
		"blank rules text": func(pack *Pack) {
			card := cardForMutation(t, pack, "courtyard-pigeon")
			card.RulesText = "   "
		},
		"blank flavor text": func(pack *Pack) {
			card := cardForMutation(t, pack, "courtyard-pigeon")
			card.FlavorText = "\t"
		},
		"NEL-only rules text": func(pack *Pack) {
			card := cardForMutation(t, pack, "courtyard-pigeon")
			card.RulesText = "\u0085"
		},
		"BOM-only flavor text": func(pack *Pack) {
			card := cardForMutation(t, pack, "courtyard-pigeon")
			card.FlavorText = "\uFEFF"
		},
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			pack := testPack(t)
			mutate(&pack)
			pack.ContentDigest = CardsDigest(pack.Cards)
			if err := pack.Validate(); !errors.Is(err, ErrInvalidContent) {
				t.Fatalf("expected invalid content, got %v", err)
			}
		})
	}
}

func cardForMutation(t *testing.T, pack *Pack, cardID string) *Card {
	t.Helper()
	for index := range pack.Cards {
		if pack.Cards[index].ID == cardID {
			return &pack.Cards[index]
		}
	}
	t.Fatalf("card %s is missing", cardID)
	return nil
}

func loadMoscowPack(t *testing.T) Pack {
	t.Helper()
	pack, err := LoadPack(moscowPackPath())
	if err != nil {
		t.Fatal(err)
	}
	return pack
}

func moscowPackPath() string {
	return filepath.Join(
		"..",
		"..",
		"..",
		"..",
		"content",
		"sets",
		"moscow",
		"v1",
		"cards.json",
	)
}

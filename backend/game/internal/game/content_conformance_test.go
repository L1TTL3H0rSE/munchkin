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

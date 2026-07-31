package game

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

type DeckKind string

const (
	DeckDoor     DeckKind = "door"
	DeckTreasure DeckKind = "treasure"
)

const maxSafeContentVersion = 1<<53 - 1

type CardKind string

const (
	CardMonster         CardKind = "monster"
	CardCurse           CardKind = "curse"
	CardClass           CardKind = "class"
	CardRace            CardKind = "race"
	CardTraitAttachment CardKind = "trait_attachment"
	CardItem            CardKind = "item"
	CardOneShot         CardKind = "one_shot"
	CardLevelUp         CardKind = "level_up"
	CardCheat           CardKind = "cheat"
)

type InteractionScope string

const (
	InteractionSelf         InteractionScope = "self"
	InteractionNone         InteractionScope = "none"
	InteractionOtherPlayers InteractionScope = "other_players"
)

type ItemSlot string

const (
	SlotNone     ItemSlot = "none"
	SlotHeadgear ItemSlot = "headgear"
	SlotArmor    ItemSlot = "armor"
	SlotFootgear ItemSlot = "footgear"
	SlotHands    ItemSlot = "hands"
)

type ItemSize string

const (
	SizeSmall ItemSize = "small"
	SizeBig   ItemSize = "big"
)

type TraitGroup string

const (
	TraitClass TraitGroup = "class"
	TraitRace  TraitGroup = "race"
)

type ConditionKind string

const (
	ConditionAlways            ConditionKind = "always"
	ConditionCharacterHasTag   ConditionKind = "character_has_tag"
	ConditionCharacterLacksTag ConditionKind = "character_lacks_tag"
	ConditionMonsterHasTag     ConditionKind = "monster_has_tag"
)

type ModifierTarget string

const (
	ModifierPlayerCombat   ModifierTarget = "player_combat"
	ModifierMonsterCombat  ModifierTarget = "monster_combat"
	ModifierEscape         ModifierTarget = "escape"
	ModifierHandLimit      ModifierTarget = "hand_limit"
	ModifierTreasureReward ModifierTarget = "treasure_reward"
)

type Condition struct {
	Kind ConditionKind `json:"kind"`
	Tag  string        `json:"tag,omitempty"`
}

type Modifier struct {
	Target    ModifierTarget `json:"target"`
	Amount    int            `json:"amount"`
	Condition Condition      `json:"condition"`
}

type Restrictions struct {
	RequiredTags  []string `json:"required_tags,omitempty"`
	ForbiddenTags []string `json:"forbidden_tags,omitempty"`
}

type ItemSpec struct {
	Slot           ItemSlot      `json:"slot"`
	Hands          int           `json:"hands,omitempty"`
	Size           ItemSize      `json:"size"`
	Value          int           `json:"value"`
	Bonus          int           `json:"bonus,omitempty"`
	EscapeBonus    int           `json:"escape_bonus,omitempty"`
	HandLimitBonus int           `json:"hand_limit_bonus,omitempty"`
	BigAllowance   int           `json:"big_allowance,omitempty"`
	Restrictions   *Restrictions `json:"restrictions,omitempty"`
	Modifiers      []Modifier    `json:"modifiers,omitempty"`
}

type TraitSpec struct {
	Group        TraitGroup `json:"group"`
	Tags         []string   `json:"tags,omitempty"`
	TieWins      bool       `json:"tie_wins,omitempty"`
	BigAllowance int        `json:"big_allowance,omitempty"`
	Modifiers    []Modifier `json:"modifiers,omitempty"`
}

type AttachmentSpec struct {
	Group       TraitGroup `json:"group"`
	ExtraTraits int        `json:"extra_traits"`
}

type AbilityKind string

const (
	AbilityDiscardForCombat AbilityKind = "discard_for_combat"
)

type Ability struct {
	Kind         AbilityKind `json:"kind"`
	Amount       int         `json:"amount"`
	DiscardCount int         `json:"discard_count"`
}

type SelectorKind string

const (
	SelectorHand      SelectorKind = "hand"
	SelectorEquipment SelectorKind = "equipment"
	SelectorTrait     SelectorKind = "trait"
	SelectorOwnedCard SelectorKind = "owned_card"
)

type EffectKind string

const (
	EffectGainLevel       EffectKind = "gain_level"
	EffectLoseLevel       EffectKind = "lose_level"
	EffectModifyCombat    EffectKind = "modify_combat"
	EffectModifyEscape    EffectKind = "modify_escape"
	EffectModifyHandLimit EffectKind = "modify_hand_limit"
	EffectModifyReward    EffectKind = "modify_treasure_reward"
	EffectDiscard         EffectKind = "discard"
	EffectChangeTag       EffectKind = "change_character_tag"
	EffectDeath           EffectKind = "death"
	EffectDraw            EffectKind = "draw"
	EffectTieWins         EffectKind = "tie_wins"
)

type EffectTarget string

const (
	EffectTargetPlayer  EffectTarget = "player"
	EffectTargetMonster EffectTarget = "monster"
)

type Effect struct {
	Kind       EffectKind   `json:"kind"`
	Amount     int          `json:"amount,omitempty"`
	Selector   SelectorKind `json:"selector,omitempty"`
	Count      int          `json:"count,omitempty"`
	Tag        string       `json:"tag,omitempty"`
	ReplaceTag string       `json:"replace_tag,omitempty"`
	Target     EffectTarget `json:"target,omitempty"`
	Deck       DeckKind     `json:"deck,omitempty"`
	Persistent bool         `json:"persistent,omitempty"`
	CanWin     bool         `json:"can_win,omitempty"`
}

type CombatCapabilityKind string

const (
	CombatCapabilityAddMonster  CombatCapabilityKind = "add_monster"
	CombatCapabilityEnhance     CombatCapabilityKind = "enhance_monster"
	CombatCapabilityCounter     CombatCapabilityKind = "counter_combat_effect"
	CombatCapabilityForceHelper CombatCapabilityKind = "force_combat_helper"
)

type CombatCapability struct {
	Kind   CombatCapabilityKind `json:"kind"`
	Amount int                  `json:"amount,omitempty"`
}

type MonsterSpec struct {
	Strength                int        `json:"strength"`
	Treasures               int        `json:"treasures"`
	Levels                  int        `json:"levels"`
	PursuitMinLevel         int        `json:"pursuit_min_level,omitempty"`
	Tags                    []string   `json:"tags,omitempty"`
	Modifiers               []Modifier `json:"modifiers,omitempty"`
	AutoDefeatCharacterTags []string   `json:"auto_defeat_character_tags,omitempty"`
	AutoEscapeCharacterTags []string   `json:"auto_escape_character_tags,omitempty"`
	BadStuff                []Effect   `json:"bad_stuff"`
}

type Card struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Deck             DeckKind          `json:"deck"`
	Kind             CardKind          `json:"kind"`
	Copies           int               `json:"copies"`
	InteractionScope InteractionScope  `json:"interaction_scope"`
	Monster          *MonsterSpec      `json:"monster,omitempty"`
	Item             *ItemSpec         `json:"item,omitempty"`
	Trait            *TraitSpec        `json:"trait,omitempty"`
	Attachment       *AttachmentSpec   `json:"attachment,omitempty"`
	Effects          []Effect          `json:"effects,omitempty"`
	Abilities        []Ability         `json:"abilities,omitempty"`
	CombatCapability *CombatCapability `json:"combat_capability,omitempty"`
	RulesText        string            `json:"rules_text,omitempty"`
	FlavorText       string            `json:"flavor_text,omitempty"`
	Image            string            `json:"image,omitempty"`
	AltText          string            `json:"alt_text,omitempty"`
}

type Pack struct {
	SchemaVersion int    `json:"schema_version"`
	SetID         string `json:"set_id"`
	Version       int    `json:"version"`
	Author        string `json:"author"`
	License       string `json:"license"`
	Source        string `json:"source"`
	ContentDigest string `json:"content_digest"`
	Cards         []Card `json:"cards"`
	index         map[string]Card
}

func LoadPack(filePath string) (Pack, error) {
	raw, err := os.ReadFile(filePath)
	if err != nil {
		return Pack{}, err
	}
	if !utf8.Valid(raw) || bytes.Contains(raw, []byte("\uFFFD")) {
		return Pack{}, fmt.Errorf("%w: content must be strict UTF-8 without U+FFFD", ErrInvalidContent)
	}
	if err := validateCanonicalSource(raw); err != nil {
		return Pack{}, err
	}
	var pack Pack
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&pack); err != nil {
		return Pack{}, fmt.Errorf("%w: %v", ErrInvalidContent, err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); err != io.EOF {
		if err == nil {
			err = fmt.Errorf("multiple JSON values")
		}
		return Pack{}, fmt.Errorf("%w: trailing content: %v", ErrInvalidContent, err)
	}
	if err := pack.Validate(); err != nil {
		return Pack{}, err
	}
	if err := validateAssetFiles(pack.Cards, filepath.Dir(filePath)); err != nil {
		return Pack{}, err
	}
	return pack, nil
}

func validateCanonicalSource(raw []byte) error {
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidContent, err)
	}
	return validateCanonicalValue(value, "$")
}

func validateCanonicalValue(value any, location string) error {
	switch typed := value.(type) {
	case nil:
		return fmt.Errorf("%w: null is not allowed at %s", ErrInvalidContent, location)
	case map[string]any:
		zeroMustBeOmitted := map[string]struct{}{
			"amount":            {},
			"big_allowance":     {},
			"bonus":             {},
			"count":             {},
			"escape_bonus":      {},
			"hand_limit_bonus":  {},
			"hands":             {},
			"pursuit_min_level": {},
		}
		for key, entry := range typed {
			child := location + "." + key
			if key != strings.ToLower(key) {
				return fmt.Errorf(
					"%w: content keys must use exact lowercase spelling at %s",
					ErrInvalidContent,
					child,
				)
			}
			switch current := entry.(type) {
			case string:
				if strings.ContainsRune(current, '\uFFFD') {
					return fmt.Errorf(
						"%w: U+FFFD is not allowed at %s",
						ErrInvalidContent,
						child,
					)
				}
				if current == "" {
					return fmt.Errorf(
						"%w: default empty string must be omitted at %s",
						ErrInvalidContent,
						child,
					)
				}
			case bool:
				if !current {
					return fmt.Errorf(
						"%w: default false must be omitted at %s",
						ErrInvalidContent,
						child,
					)
				}
			case json.Number:
				if _, tracked := zeroMustBeOmitted[key]; tracked {
					integer, err := current.Int64()
					if err == nil && integer == 0 {
						return fmt.Errorf(
							"%w: default zero must be omitted at %s",
							ErrInvalidContent,
							child,
						)
					}
				}
			case []any:
				if len(current) == 0 {
					return fmt.Errorf(
						"%w: empty array must be omitted at %s",
						ErrInvalidContent,
						child,
					)
				}
			}
			if err := validateCanonicalValue(entry, child); err != nil {
				return err
			}
		}
	case []any:
		for index, entry := range typed {
			if err := validateCanonicalValue(
				entry,
				fmt.Sprintf("%s[%d]", location, index),
			); err != nil {
				return err
			}
		}
	}
	return nil
}

func CardsDigest(cards []Card) string {
	hash := sha256.New()
	_, _ = hash.Write([]byte("munchkin-cards-v2\n"))
	for _, card := range cards {
		raw, err := canonicalJSON(card)
		if err != nil {
			panic(fmt.Sprintf("canonical card JSON: %v", err))
		}
		_, _ = fmt.Fprintf(hash, "%d:", len(raw))
		_, _ = hash.Write(raw)
		_, _ = hash.Write([]byte{'\n'})
	}
	return "sha256:" + hex.EncodeToString(hash.Sum(nil))
}

func canonicalJSON(value any) ([]byte, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	var decoded any
	if err := decoder.Decode(&decoded); err != nil {
		return nil, err
	}
	var result bytes.Buffer
	if err := writeCanonicalJSON(&result, decoded); err != nil {
		return nil, err
	}
	return result.Bytes(), nil
}

func writeCanonicalJSON(buffer *bytes.Buffer, value any) error {
	switch typed := value.(type) {
	case nil:
		buffer.WriteString("null")
	case bool:
		if typed {
			buffer.WriteString("true")
		} else {
			buffer.WriteString("false")
		}
	case string:
		if err := writeJSONString(buffer, typed); err != nil {
			return err
		}
	case json.Number:
		buffer.WriteString(typed.String())
	case []any:
		buffer.WriteByte('[')
		for index, entry := range typed {
			if index > 0 {
				buffer.WriteByte(',')
			}
			if err := writeCanonicalJSON(buffer, entry); err != nil {
				return err
			}
		}
		buffer.WriteByte(']')
	case map[string]any:
		keys := make([]string, 0, len(typed))
		for key := range typed {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		buffer.WriteByte('{')
		for index, key := range keys {
			if index > 0 {
				buffer.WriteByte(',')
			}
			if err := writeJSONString(buffer, key); err != nil {
				return err
			}
			buffer.WriteByte(':')
			if err := writeCanonicalJSON(buffer, typed[key]); err != nil {
				return err
			}
		}
		buffer.WriteByte('}')
	default:
		return fmt.Errorf("unsupported canonical JSON value %T", value)
	}
	return nil
}

func writeJSONString(buffer *bytes.Buffer, value string) error {
	var encoded bytes.Buffer
	encoder := json.NewEncoder(&encoded)
	encoder.SetEscapeHTML(false)
	if err := encoder.Encode(value); err != nil {
		return err
	}
	raw := bytes.TrimSuffix(encoded.Bytes(), []byte{'\n'})
	raw = bytes.ReplaceAll(raw, []byte(`\u2028`), []byte("\u2028"))
	raw = bytes.ReplaceAll(raw, []byte(`\u2029`), []byte("\u2029"))
	buffer.Write(raw)
	return nil
}

func (pack *Pack) Validate() error {
	if pack.SchemaVersion != 1 ||
		!identityPattern.MatchString(pack.SetID) ||
		pack.Version < 1 ||
		pack.Version > maxSafeContentVersion {
		return fmt.Errorf("%w: invalid identity", ErrInvalidContent)
	}
	if !hasVisibleText(pack.Author) ||
		!hasVisibleText(pack.License) ||
		!hasVisibleText(pack.Source) {
		return fmt.Errorf("%w: author, license and source are required", ErrInvalidContent)
	}
	expected := CardsDigest(pack.Cards)
	if pack.ContentDigest != expected {
		return fmt.Errorf("%w: digest mismatch: expected %s", ErrInvalidContent, expected)
	}
	if len(pack.Cards) < 12 {
		return fmt.Errorf("%w: pack needs at least 12 definitions", ErrInvalidContent)
	}
	pack.index = make(map[string]Card, len(pack.Cards))
	for _, card := range pack.Cards {
		if err := validateCard(card); err != nil {
			return err
		}
		if _, exists := pack.index[card.ID]; exists {
			return fmt.Errorf("%w: duplicate card %s", ErrInvalidContent, card.ID)
		}
		pack.index[card.ID] = card
	}
	_, doors, treasures, err := pack.Materialize()
	if err != nil {
		return err
	}
	required := MaxPlayers*FirstEditionCoreProfile().InitialDoorCards + 1
	if len(doors) < required || len(treasures) < required {
		return fmt.Errorf(
			"%w: core profile needs at least %d enabled cards per deck",
			ErrInvalidContent,
			required,
		)
	}
	return nil
}

func hasVisibleText(value string) bool {
	for _, current := range value {
		if !unicode.IsSpace(current) && current != '\uFEFF' {
			return true
		}
	}
	return false
}

func validateCard(card Card) error {
	if !identityPattern.MatchString(card.ID) ||
		!hasVisibleText(card.Name) ||
		utf8.RuneCountInString(card.Name) > 120 ||
		utf8.RuneCountInString(card.RulesText) > 800 ||
		(card.RulesText != "" && !hasVisibleText(card.RulesText)) ||
		utf8.RuneCountInString(card.FlavorText) > 300 ||
		(card.FlavorText != "" && !hasVisibleText(card.FlavorText)) ||
		utf8.RuneCountInString(card.AltText) > 200 ||
		card.Copies < 1 ||
		card.Copies > 30 {
		return fmt.Errorf("%w: invalid card %s", ErrInvalidContent, card.ID)
	}
	switch card.InteractionScope {
	case InteractionSelf, InteractionNone, InteractionOtherPlayers:
	default:
		return fmt.Errorf("%w: card %s has invalid interaction scope", ErrInvalidContent, card.ID)
	}
	if card.Image != "" {
		if !validAssetPath(card.Image) || !hasVisibleText(card.AltText) {
			return fmt.Errorf("%w: card %s has invalid image metadata", ErrInvalidContent, card.ID)
		}
	} else if card.AltText != "" {
		return fmt.Errorf("%w: card %s has alt_text without image", ErrInvalidContent, card.ID)
	}
	if err := validateEffects(card.ID, card.Effects); err != nil {
		return err
	}
	if err := validateCombatCapability(card); err != nil {
		return err
	}
	for _, ability := range card.Abilities {
		if ability.Kind != AbilityDiscardForCombat ||
			ability.Amount < 1 ||
			ability.Amount > 20 ||
			ability.DiscardCount < 1 ||
			ability.DiscardCount > 5 {
			return fmt.Errorf("%w: card %s has invalid ability", ErrInvalidContent, card.ID)
		}
	}
	switch card.Kind {
	case CardMonster:
		if card.Deck != DeckDoor ||
			card.Monster == nil ||
			card.Item != nil ||
			card.Trait != nil ||
			card.Attachment != nil ||
			len(card.Effects) > 0 ||
			len(card.Abilities) > 0 {
			return fmt.Errorf("%w: invalid monster definition %s", ErrInvalidContent, card.ID)
		}
		return validateMonster(card.ID, *card.Monster)
	case CardCurse:
		if card.Deck != DeckDoor ||
			card.Monster != nil ||
			card.Item != nil ||
			card.Trait != nil ||
			card.Attachment != nil ||
			len(card.Effects) == 0 ||
			len(card.Abilities) > 0 ||
			card.CombatCapability != nil {
			return fmt.Errorf("%w: invalid curse definition %s", ErrInvalidContent, card.ID)
		}
		if err := validateCurseEffects(card.ID, card.Effects); err != nil {
			return err
		}
	case CardClass, CardRace:
		expectedGroup := TraitClass
		if card.Kind == CardRace {
			expectedGroup = TraitRace
		}
		if card.Deck != DeckDoor ||
			card.Trait == nil ||
			card.Trait.Group != expectedGroup ||
			card.Monster != nil ||
			card.Item != nil ||
			card.Attachment != nil ||
			len(card.Effects) > 0 ||
			card.CombatCapability != nil {
			return fmt.Errorf("%w: invalid trait definition %s", ErrInvalidContent, card.ID)
		}
		if err := validateTrait(card.ID, *card.Trait); err != nil {
			return err
		}
	case CardTraitAttachment:
		if card.Deck != DeckDoor ||
			card.Attachment == nil ||
			card.Attachment.ExtraTraits != 1 ||
			(card.Attachment.Group != TraitClass && card.Attachment.Group != TraitRace) ||
			card.Monster != nil ||
			card.Item != nil ||
			card.Trait != nil ||
			len(card.Effects) > 0 ||
			len(card.Abilities) > 0 ||
			card.CombatCapability != nil {
			return fmt.Errorf("%w: invalid trait attachment %s", ErrInvalidContent, card.ID)
		}
	case CardItem:
		if card.Deck != DeckTreasure ||
			card.Item == nil ||
			card.Monster != nil ||
			card.Trait != nil ||
			card.Attachment != nil ||
			len(card.Effects) > 0 ||
			card.CombatCapability != nil {
			return fmt.Errorf("%w: invalid item definition %s", ErrInvalidContent, card.ID)
		}
		if err := validateItem(card.ID, *card.Item); err != nil {
			return err
		}
	case CardOneShot:
		if card.Deck != DeckTreasure ||
			card.Monster != nil ||
			card.Item != nil ||
			card.Trait != nil ||
			card.Attachment != nil ||
			len(card.Effects) == 0 ||
			len(card.Abilities) > 0 {
			return fmt.Errorf("%w: invalid one-shot definition %s", ErrInvalidContent, card.ID)
		}
		if err := validateOneShotEffects(card.ID, card.Effects); err != nil {
			return err
		}
	case CardLevelUp:
		if card.Deck != DeckTreasure ||
			card.Monster != nil ||
			card.Item != nil ||
			card.Trait != nil ||
			card.Attachment != nil ||
			len(card.Effects) != 1 ||
			card.Effects[0].Kind != EffectGainLevel ||
			card.Effects[0].CanWin ||
			len(card.Abilities) > 0 ||
			card.CombatCapability != nil {
			return fmt.Errorf("%w: invalid level-up definition %s", ErrInvalidContent, card.ID)
		}
	case CardCheat:
		if card.Deck != DeckTreasure ||
			card.Monster != nil ||
			card.Item != nil ||
			card.Trait != nil ||
			card.Attachment != nil ||
			len(card.Effects) > 0 ||
			len(card.Abilities) > 0 ||
			card.CombatCapability != nil {
			return fmt.Errorf("%w: invalid cheat definition %s", ErrInvalidContent, card.ID)
		}
	default:
		return fmt.Errorf("%w: unknown card kind %q", ErrInvalidContent, card.Kind)
	}
	return nil
}

func validateCombatCapability(card Card) error {
	capability := card.CombatCapability
	if capability == nil {
		return nil
	}
	if card.InteractionScope != InteractionOtherPlayers {
		return fmt.Errorf(
			"%w: combat capability on %s requires other_players scope",
			ErrInvalidContent,
			card.ID,
		)
	}
	switch capability.Kind {
	case CombatCapabilityAddMonster:
		if card.Kind != CardMonster ||
			card.Deck != DeckDoor ||
			capability.Amount != 0 {
			return fmt.Errorf(
				"%w: invalid add-monster capability on %s",
				ErrInvalidContent,
				card.ID,
			)
		}
	case CombatCapabilityEnhance:
		if card.Kind != CardOneShot ||
			card.Deck != DeckTreasure ||
			capability.Amount < 1 ||
			capability.Amount > 10 {
			return fmt.Errorf(
				"%w: invalid enhancer capability on %s",
				ErrInvalidContent,
				card.ID,
			)
		}
	case CombatCapabilityCounter, CombatCapabilityForceHelper:
		if card.Kind != CardOneShot ||
			card.Deck != DeckTreasure ||
			capability.Amount != 0 {
			return fmt.Errorf(
				"%w: invalid %s capability on %s",
				ErrInvalidContent,
				capability.Kind,
				card.ID,
			)
		}
	default:
		return fmt.Errorf(
			"%w: unknown combat capability %q on %s",
			ErrInvalidContent,
			capability.Kind,
			card.ID,
		)
	}
	return nil
}

func validateMonster(cardID string, monster MonsterSpec) error {
	if monster.Strength < 1 ||
		monster.Strength > 99 ||
		monster.Treasures < 1 ||
		monster.Treasures > 10 ||
		monster.Levels < 1 ||
		monster.Levels > 2 ||
		monster.PursuitMinLevel < 0 ||
		monster.PursuitMinLevel > 9 ||
		len(monster.BadStuff) == 0 {
		return fmt.Errorf("%w: invalid monster %s", ErrInvalidContent, cardID)
	}
	if err := validateTags(cardID, "monster tags", monster.Tags); err != nil {
		return err
	}
	if err := validateTags(
		cardID,
		"automatic-defeat tags",
		monster.AutoDefeatCharacterTags,
	); err != nil {
		return err
	}
	if err := validateTags(
		cardID,
		"automatic-escape tags",
		monster.AutoEscapeCharacterTags,
	); err != nil {
		return err
	}
	if err := validateModifiers(cardID, monster.Modifiers); err != nil {
		return err
	}
	if err := validateEffects(cardID, monster.BadStuff); err != nil {
		return err
	}
	return validateBadStuffEffects(cardID, monster.BadStuff)
}

func validateTrait(cardID string, trait TraitSpec) error {
	if trait.Group != TraitClass && trait.Group != TraitRace {
		return fmt.Errorf("%w: invalid trait group on %s", ErrInvalidContent, cardID)
	}
	if trait.BigAllowance < 0 || trait.BigAllowance > 3 {
		return fmt.Errorf("%w: invalid trait big allowance on %s", ErrInvalidContent, cardID)
	}
	if err := validateTags(cardID, "trait tags", trait.Tags); err != nil {
		return err
	}
	return validateModifiers(cardID, trait.Modifiers)
}

func validateItem(cardID string, item ItemSpec) error {
	switch item.Slot {
	case SlotNone, SlotHeadgear, SlotArmor, SlotFootgear, SlotHands:
	default:
		return fmt.Errorf("%w: invalid item slot on %s", ErrInvalidContent, cardID)
	}
	if item.Size != SizeSmall && item.Size != SizeBig {
		return fmt.Errorf("%w: invalid item size on %s", ErrInvalidContent, cardID)
	}
	if item.Value < 0 ||
		item.Value > 10000 ||
		item.Bonus < 0 ||
		item.Bonus > 20 ||
		item.EscapeBonus < -5 ||
		item.EscapeBonus > 5 ||
		item.HandLimitBonus < -5 ||
		item.HandLimitBonus > 10 ||
		item.BigAllowance < 0 ||
		item.BigAllowance > 3 {
		return fmt.Errorf("%w: invalid item values on %s", ErrInvalidContent, cardID)
	}
	if item.Slot == SlotHands {
		if item.Hands < 1 || item.Hands > 2 {
			return fmt.Errorf("%w: hand item %s needs one or two hands", ErrInvalidContent, cardID)
		}
	} else if item.Hands != 0 {
		return fmt.Errorf("%w: non-hand item %s declares hands", ErrInvalidContent, cardID)
	}
	if item.Restrictions != nil {
		if item.BigAllowance > 0 {
			return fmt.Errorf(
				"%w: restricted item %s cannot grant Big allowance",
				ErrInvalidContent,
				cardID,
			)
		}
		if err := validateTags(
			cardID,
			"required restriction tags",
			item.Restrictions.RequiredTags,
		); err != nil {
			return err
		}
		if err := validateTags(
			cardID,
			"forbidden restriction tags",
			item.Restrictions.ForbiddenTags,
		); err != nil {
			return err
		}
	}
	return validateModifiers(cardID, item.Modifiers)
}

func validateTags(cardID, label string, tags []string) error {
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		if !tagPattern.MatchString(tag) {
			return fmt.Errorf("%w: invalid %s on %s", ErrInvalidContent, label, cardID)
		}
		if _, exists := seen[tag]; exists {
			return fmt.Errorf("%w: duplicate %s on %s", ErrInvalidContent, label, cardID)
		}
		seen[tag] = struct{}{}
	}
	return nil
}

func validateModifiers(cardID string, modifiers []Modifier) error {
	for _, modifier := range modifiers {
		switch modifier.Target {
		case ModifierPlayerCombat,
			ModifierMonsterCombat,
			ModifierEscape,
			ModifierHandLimit,
			ModifierTreasureReward:
		default:
			return fmt.Errorf("%w: card %s has invalid modifier target", ErrInvalidContent, cardID)
		}
		if modifier.Amount < -20 || modifier.Amount > 20 || modifier.Amount == 0 {
			return fmt.Errorf("%w: card %s has invalid modifier amount", ErrInvalidContent, cardID)
		}
		switch modifier.Condition.Kind {
		case ConditionAlways:
			if modifier.Condition.Tag != "" {
				return fmt.Errorf("%w: always condition on %s has tag", ErrInvalidContent, cardID)
			}
		case ConditionCharacterHasTag,
			ConditionCharacterLacksTag,
			ConditionMonsterHasTag:
			if !tagPattern.MatchString(modifier.Condition.Tag) {
				return fmt.Errorf("%w: invalid modifier tag on %s", ErrInvalidContent, cardID)
			}
		default:
			return fmt.Errorf("%w: card %s has invalid condition", ErrInvalidContent, cardID)
		}
	}
	return nil
}

func validateEffects(cardID string, effects []Effect) error {
	for _, effect := range effects {
		if effect.Persistent &&
			effect.Kind != EffectModifyCombat &&
			effect.Kind != EffectModifyEscape &&
			effect.Kind != EffectModifyHandLimit &&
			effect.Kind != EffectModifyReward &&
			effect.Kind != EffectTieWins {
			return fmt.Errorf(
				"%w: card %s has unsupported persistent effect %s",
				ErrInvalidContent,
				cardID,
				effect.Kind,
			)
		}
		if effect.CanWin && effect.Kind != EffectGainLevel {
			return fmt.Errorf("%w: card %s has misplaced can_win", ErrInvalidContent, cardID)
		}
		switch effect.Kind {
		case EffectGainLevel, EffectLoseLevel:
			if effect.Amount < 1 || effect.Amount > 9 {
				return fmt.Errorf("%w: card %s has invalid level effect", ErrInvalidContent, cardID)
			}
			allowed := map[string]bool{"amount": true}
			if effect.Kind == EffectGainLevel {
				allowed["can_win"] = true
			}
			if hasUnexpectedEffectField(effect, allowed) {
				return fmt.Errorf("%w: card %s has fields invalid for %s", ErrInvalidContent, cardID, effect.Kind)
			}
		case EffectModifyCombat:
			if (effect.Target != EffectTargetPlayer && effect.Target != EffectTargetMonster) ||
				effect.Amount < -20 ||
				effect.Amount > 20 ||
				effect.Amount == 0 {
				return fmt.Errorf("%w: card %s has invalid combat effect", ErrInvalidContent, cardID)
			}
			if hasUnexpectedEffectField(
				effect,
				map[string]bool{"amount": true, "target": true, "persistent": true},
			) {
				return fmt.Errorf("%w: card %s has invalid combat fields", ErrInvalidContent, cardID)
			}
		case EffectModifyEscape, EffectModifyHandLimit, EffectModifyReward:
			if effect.Amount < -20 || effect.Amount > 20 || effect.Amount == 0 {
				return fmt.Errorf("%w: card %s has invalid modifier effect", ErrInvalidContent, cardID)
			}
			if hasUnexpectedEffectField(
				effect,
				map[string]bool{"amount": true, "persistent": true},
			) {
				return fmt.Errorf("%w: card %s has invalid modifier fields", ErrInvalidContent, cardID)
			}
		case EffectDiscard:
			if effect.Selector != SelectorHand &&
				effect.Selector != SelectorEquipment &&
				effect.Selector != SelectorTrait &&
				effect.Selector != SelectorOwnedCard {
				return fmt.Errorf("%w: card %s has invalid discard selector", ErrInvalidContent, cardID)
			}
			if effect.Count < 1 || effect.Count > 10 {
				return fmt.Errorf("%w: card %s has invalid discard count", ErrInvalidContent, cardID)
			}
			if hasUnexpectedEffectField(
				effect,
				map[string]bool{"selector": true, "count": true},
			) {
				return fmt.Errorf("%w: card %s has invalid discard fields", ErrInvalidContent, cardID)
			}
		case EffectChangeTag:
			if !tagPattern.MatchString(effect.Tag) {
				return fmt.Errorf("%w: card %s has invalid character tag", ErrInvalidContent, cardID)
			}
			if effect.ReplaceTag != "" && !tagPattern.MatchString(effect.ReplaceTag) {
				return fmt.Errorf("%w: card %s has invalid replaced tag", ErrInvalidContent, cardID)
			}
			if hasUnexpectedEffectField(
				effect,
				map[string]bool{"tag": true, "replace_tag": true},
			) {
				return fmt.Errorf("%w: card %s has invalid tag-change fields", ErrInvalidContent, cardID)
			}
		case EffectDeath:
			if hasUnexpectedEffectField(effect, map[string]bool{}) {
				return fmt.Errorf("%w: death effect on %s has invalid fields", ErrInvalidContent, cardID)
			}
		case EffectDraw:
			if (effect.Deck != DeckDoor && effect.Deck != DeckTreasure) ||
				effect.Amount < 1 ||
				effect.Amount > 10 {
				return fmt.Errorf("%w: card %s has invalid draw effect", ErrInvalidContent, cardID)
			}
			if hasUnexpectedEffectField(
				effect,
				map[string]bool{"deck": true, "amount": true},
			) {
				return fmt.Errorf("%w: card %s has invalid draw fields", ErrInvalidContent, cardID)
			}
		case EffectTieWins:
			if !effect.Persistent {
				return fmt.Errorf("%w: tie-wins effect on %s must persist", ErrInvalidContent, cardID)
			}
			if hasUnexpectedEffectField(
				effect,
				map[string]bool{"persistent": true},
			) {
				return fmt.Errorf("%w: tie-wins effect on %s has invalid fields", ErrInvalidContent, cardID)
			}
		default:
			return fmt.Errorf("%w: card %s has unknown effect %q", ErrInvalidContent, cardID, effect.Kind)
		}
	}
	return nil
}

func hasUnexpectedEffectField(effect Effect, allowed map[string]bool) bool {
	return effect.Amount != 0 && !allowed["amount"] ||
		effect.Selector != "" && !allowed["selector"] ||
		effect.Count != 0 && !allowed["count"] ||
		effect.Tag != "" && !allowed["tag"] ||
		effect.ReplaceTag != "" && !allowed["replace_tag"] ||
		effect.Target != "" && !allowed["target"] ||
		effect.Deck != "" && !allowed["deck"] ||
		effect.Persistent && !allowed["persistent"] ||
		effect.CanWin && !allowed["can_win"]
}

func validateCurseEffects(cardID string, effects []Effect) error {
	for _, effect := range effects {
		switch effect.Kind {
		case EffectModifyCombat,
			EffectModifyEscape,
			EffectModifyHandLimit,
			EffectModifyReward,
			EffectTieWins:
			if !effect.Persistent {
				return fmt.Errorf(
					"%w: curse %s has a temporary %s effect outside combat",
					ErrInvalidContent,
					cardID,
					effect.Kind,
				)
			}
		}
	}
	return nil
}

func validateOneShotEffects(cardID string, effects []Effect) error {
	for _, effect := range effects {
		if effect.Persistent ||
			effect.Kind == EffectModifyHandLimit ||
			effect.Kind == EffectTieWins ||
			effect.Kind == EffectDeath {
			return fmt.Errorf(
				"%w: one-shot %s has unsupported effect %s",
				ErrInvalidContent,
				cardID,
				effect.Kind,
			)
		}
	}
	return nil
}

func validateBadStuffEffects(cardID string, effects []Effect) error {
	for _, effect := range effects {
		switch effect.Kind {
		case EffectModifyCombat,
			EffectModifyEscape,
			EffectModifyHandLimit,
			EffectModifyReward,
			EffectTieWins:
			return fmt.Errorf(
				"%w: monster %s has unsupported Bad Stuff effect %s",
				ErrInvalidContent,
				cardID,
				effect.Kind,
			)
		}
		if effect.Persistent {
			return fmt.Errorf(
				"%w: monster %s has persistent Bad Stuff",
				ErrInvalidContent,
				cardID,
			)
		}
	}
	return nil
}

var (
	identityPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,63}$`)
	tagPattern      = regexp.MustCompile(`^[a-z][a-z0-9-]{1,47}$`)
	assetPattern    = regexp.MustCompile(`^assets/[A-Za-z0-9][A-Za-z0-9._/-]*\.(avif|jpe?g|png|webp)$`)
)

func validAssetPath(value string) bool {
	if !assetPattern.MatchString(value) ||
		strings.Contains(value, `\`) ||
		strings.Contains(value, "//") ||
		strings.HasSuffix(value, "/") {
		return false
	}
	for _, segment := range strings.Split(value, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
	}
	return true
}

func validateAssetFiles(cards []Card, setDirectory string) error {
	root, err := filepath.Abs(setDirectory)
	if err != nil {
		return fmt.Errorf("%w: resolve content directory: %v", ErrInvalidContent, err)
	}
	root, err = filepath.EvalSymlinks(root)
	if err != nil {
		return fmt.Errorf("%w: resolve content directory: %v", ErrInvalidContent, err)
	}
	for _, card := range cards {
		if card.Image == "" {
			continue
		}
		candidate := filepath.Join(root, filepath.FromSlash(card.Image))
		candidate, err = filepath.EvalSymlinks(candidate)
		if err != nil {
			return fmt.Errorf("%w: card %s image: %v", ErrInvalidContent, card.ID, err)
		}
		relative, err := filepath.Rel(root, candidate)
		if err != nil ||
			relative == ".." ||
			strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			return fmt.Errorf("%w: card %s image escapes content set", ErrInvalidContent, card.ID)
		}
		info, err := os.Stat(candidate)
		if err != nil || !info.Mode().IsRegular() {
			return fmt.Errorf("%w: card %s image is not a regular file", ErrInvalidContent, card.ID)
		}
	}
	return nil
}

func (pack Pack) Card(cardID string) (Card, bool) {
	card, exists := pack.index[cardID]
	return card, exists
}

func (pack Pack) DefinitionForInstance(
	state State,
	instanceID string,
) (Card, CardInstance, bool) {
	instance, exists := state.Instances[instanceID]
	if !exists {
		return Card{}, CardInstance{}, false
	}
	card, exists := pack.Card(instance.DefinitionID)
	return card, instance, exists
}

func (pack Pack) Materialize() (
	map[string]CardInstance,
	[]string,
	[]string,
	error,
) {
	instances := make(map[string]CardInstance)
	var doors []string
	var treasures []string
	for _, card := range pack.Cards {
		if card.InteractionScope == InteractionOtherPlayers {
			continue
		}
		for copyIndex := 1; copyIndex <= card.Copies; copyIndex++ {
			instanceID := card.ID + "-" + strconv.Itoa(copyIndex)
			if _, exists := instances[instanceID]; exists {
				return nil, nil, nil, fmt.Errorf(
					"%w: duplicate instance %s",
					ErrInvalidContent,
					instanceID,
				)
			}
			instances[instanceID] = CardInstance{
				ID:           instanceID,
				DefinitionID: card.ID,
			}
			switch card.Deck {
			case DeckDoor:
				doors = append(doors, instanceID)
			case DeckTreasure:
				treasures = append(treasures, instanceID)
			default:
				return nil, nil, nil, fmt.Errorf(
					"%w: card %s has invalid deck",
					ErrInvalidContent,
					card.ID,
				)
			}
		}
	}
	return instances, doors, treasures, nil
}

package game

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"
)

type Card struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Kind           CardKind `json:"kind"`
	CombatStrength int      `json:"combat_strength,omitempty"`
	TreasureCount  int      `json:"treasure_count,omitempty"`
	LevelLoss      int      `json:"level_loss,omitempty"`
	RulesText      string   `json:"rules_text,omitempty"`
	FlavorText     string   `json:"flavor_text,omitempty"`
	Image          string   `json:"image,omitempty"`
	AltText        string   `json:"alt_text,omitempty"`
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
	var pack Pack
	decoder := json.NewDecoder(strings.NewReader(string(raw)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&pack); err != nil {
		return Pack{}, fmt.Errorf("%w: %v", ErrInvalidContent, err)
	}
	if err := pack.Validate(); err != nil {
		return Pack{}, err
	}
	if err := validateAssetFiles(pack.Cards, filepath.Dir(filePath)); err != nil {
		return Pack{}, err
	}
	return pack, nil
}

func CardsDigest(cards []Card) string {
	hash := sha256.New()
	_, _ = hash.Write([]byte("munchkin-cards-v1\n"))
	for _, card := range cards {
		for _, field := range []string{
			card.ID, card.Name, string(card.Kind),
			card.RulesText, card.FlavorText, card.Image, card.AltText,
			strconv.Itoa(card.CombatStrength),
			strconv.Itoa(card.TreasureCount),
			strconv.Itoa(card.LevelLoss),
		} {
			raw := []byte(field)
			_, _ = fmt.Fprintf(hash, "%d:", len(raw))
			_, _ = hash.Write(raw)
			_, _ = hash.Write([]byte{'\n'})
		}
	}
	return "sha256:" + hex.EncodeToString(hash.Sum(nil))
}

func (p *Pack) Validate() error {
	if p.SchemaVersion != 1 || !identityPattern.MatchString(p.SetID) || p.Version < 1 {
		return fmt.Errorf("%w: invalid identity", ErrInvalidContent)
	}
	if strings.TrimSpace(p.Author) == "" ||
		strings.TrimSpace(p.License) == "" ||
		strings.TrimSpace(p.Source) == "" {
		return fmt.Errorf("%w: author, license and source are required", ErrInvalidContent)
	}
	expected := CardsDigest(p.Cards)
	if p.ContentDigest != expected {
		return fmt.Errorf("%w: digest mismatch: expected %s", ErrInvalidContent, expected)
	}
	if len(p.Cards) < 24 {
		return fmt.Errorf("%w: pack needs at least 24 cards", ErrInvalidContent)
	}
	p.index = make(map[string]Card, len(p.Cards))
	doorCount := 0
	treasureCount := 0
	for _, card := range p.Cards {
		if !identityPattern.MatchString(card.ID) ||
			strings.TrimSpace(card.Name) == "" ||
			utf8.RuneCountInString(card.Name) > 120 ||
			utf8.RuneCountInString(card.RulesText) > 800 ||
			utf8.RuneCountInString(card.FlavorText) > 300 ||
			utf8.RuneCountInString(card.AltText) > 200 {
			return fmt.Errorf("%w: card identity is required", ErrInvalidContent)
		}
		if card.Image != "" {
			if !validAssetPath(card.Image) || strings.TrimSpace(card.AltText) == "" {
				return fmt.Errorf("%w: card %s has invalid image metadata", ErrInvalidContent, card.ID)
			}
		} else if card.AltText != "" {
			return fmt.Errorf("%w: card %s has alt_text without image", ErrInvalidContent, card.ID)
		}
		if _, exists := p.index[card.ID]; exists {
			return fmt.Errorf("%w: duplicate card %s", ErrInvalidContent, card.ID)
		}
		switch card.Kind {
		case CardMonster:
			if card.CombatStrength < 1 || card.CombatStrength > 99 ||
				card.TreasureCount < 1 || card.TreasureCount > 10 ||
				card.LevelLoss < 0 || card.LevelLoss > 9 {
				return fmt.Errorf("%w: invalid monster %s", ErrInvalidContent, card.ID)
			}
			doorCount++
		case CardCurse:
			if card.LevelLoss < 1 || card.LevelLoss > 9 ||
				card.CombatStrength != 0 || card.TreasureCount != 0 {
				return fmt.Errorf("%w: invalid curse %s", ErrInvalidContent, card.ID)
			}
			doorCount++
		case CardDoor:
			if card.CombatStrength != 0 || card.TreasureCount != 0 || card.LevelLoss != 0 {
				return fmt.Errorf("%w: invalid door %s", ErrInvalidContent, card.ID)
			}
			doorCount++
		case CardTreasure:
			if card.CombatStrength != 0 || card.TreasureCount != 0 || card.LevelLoss != 0 {
				return fmt.Errorf("%w: invalid treasure %s", ErrInvalidContent, card.ID)
			}
			treasureCount++
		default:
			return fmt.Errorf("%w: unknown card kind %q", ErrInvalidContent, card.Kind)
		}
		p.index[card.ID] = card
	}
	if doorCount < MaxPlayers*3 || treasureCount < MaxPlayers*3 {
		return fmt.Errorf("%w: demo pack needs at least %d cards per deck", ErrInvalidContent, MaxPlayers*3)
	}
	return nil
}

var (
	identityPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{2,63}$`)
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
		if err != nil || relative == ".." ||
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

func (p Pack) Card(cardID string) (Card, bool) {
	card, exists := p.index[cardID]
	return card, exists
}

func (p Pack) Decks() (doors []string, treasures []string) {
	for _, card := range p.Cards {
		if card.Kind == CardTreasure {
			treasures = append(treasures, card.ID)
		} else {
			doors = append(doors, card.ID)
		}
	}
	return doors, treasures
}

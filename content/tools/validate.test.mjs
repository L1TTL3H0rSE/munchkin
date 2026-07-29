import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cardsDigest, validatePack } from "./validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demo = JSON.parse(fs.readFileSync(path.join(root, "sets", "demo", "cards.json"), "utf8"));

test("demo pack passes closed semantic validation", () => {
  const result = validatePack(structuredClone(demo));
  assert.equal(result.cards, 24);
  assert.equal(result.doors, 12);
  assert.equal(result.treasures, 12);
});

test("unknown fields and effect kinds fail closed", () => {
  const unknownField = structuredClone(demo);
  unknownField.cards[0].script = "level += 99";
  assert.throws(() => validatePack(unknownField), /unknown field script/);

  const unknownKind = structuredClone(demo);
  unknownKind.cards[0].kind = "javascript";
  unknownKind.content_digest = cardsDigest(unknownKind.cards);
  assert.throws(() => validatePack(unknownKind), /unknown effect kind/);
});

test("duplicate identity and digest drift are rejected", () => {
  const duplicate = structuredClone(demo);
  duplicate.cards[1].id = duplicate.cards[0].id;
  duplicate.content_digest = cardsDigest(duplicate.cards);
  assert.throws(() => validatePack(duplicate), /duplicate card id/);

  const drift = structuredClone(demo);
  drift.cards[0].name = "Mutated after publication";
  assert.throws(() => validatePack(drift), /content_digest mismatch/);
});

test("canonical digest is stable for Unicode, HTML characters and optional fields", () => {
  const cards = [{
    id: "unicode-card",
    name: "Mage <&> ✨",
    kind: "door",
    rules_text: "Когда & тогда",
    flavor_text: "<шутка>",
    image: "assets/cards/mage.webp",
    alt_text: "Маг сияет",
  }];
  assert.equal(
    cardsDigest(cards),
    "sha256:a148cdb6997ebac04aa4f3df51ebb7fcd79949d724d51b6af0a1c41b177eb65f",
  );
});

test("presentation metadata and numeric limits fail closed", () => {
  const unsafe = structuredClone(demo);
  unsafe.cards[0].image = "assets/../outside.png";
  unsafe.cards[0].alt_text = "Outside";
  unsafe.content_digest = cardsDigest(unsafe.cards);
  assert.throws(() => validatePack(unsafe), /safe repository-relative/);

  const oversized = structuredClone(demo);
  oversized.cards[0].combat_strength = 100;
  oversized.content_digest = cardsDigest(oversized.cards);
  assert.throws(() => validatePack(oversized), /must be <= 99/);
});

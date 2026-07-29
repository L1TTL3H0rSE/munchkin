import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_KEYS = new Set([
  "schema_version",
  "set_id",
  "version",
  "author",
  "license",
  "source",
  "content_digest",
  "cards",
]);
const CARD_KEYS = new Set([
  "id",
  "name",
  "kind",
  "combat_strength",
  "treasure_count",
  "level_loss",
  "rules_text",
  "flavor_text",
  "image",
  "alt_text",
]);
const CARD_KINDS = new Set(["monster", "curse", "door", "treasure"]);

function fail(message) {
  throw new Error(message);
}

function rejectUnknown(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail(`${label}: unknown field ${key}`);
    }
  }
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    fail(`${label} must be a positive integer`);
  }
}

function boundedString(value, label, maximum, required = false) {
  if (value === undefined && !required) {
    return;
  }
  requiredString(value, label);
  if ([...value].length > maximum) {
    fail(`${label} exceeds ${maximum} characters`);
  }
}

function boundedInteger(value, label, maximum, required = false) {
  if (value === undefined && !required) {
    return;
  }
  positiveInteger(value, label);
  if (value > maximum) {
    fail(`${label} must be <= ${maximum}`);
  }
}

function validateAssetPath(value, label) {
  boundedString(value, label, 240, true);
  if (!/^assets\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/.test(value) ||
    value.includes("\\") ||
    value.includes("//") ||
    value.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    fail(`${label} must be a safe repository-relative image path`);
  }
}

export function cardsDigest(cards) {
  const hash = crypto.createHash("sha256");
  hash.update("munchkin-cards-v1\n");
  for (const card of cards) {
    const fields = [
      card.id, card.name, card.kind,
      card.rules_text ?? "", card.flavor_text ?? "", card.image ?? "", card.alt_text ?? "",
      card.combat_strength ?? 0, card.treasure_count ?? 0, card.level_loss ?? 0,
    ];
    for (const field of fields) {
      const raw = Buffer.from(String(field), "utf8");
      hash.update(`${raw.length}:`);
      hash.update(raw);
      hash.update("\n");
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

export function validatePack(pack) {
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
    fail("pack must be an object");
  }
  rejectUnknown(pack, ROOT_KEYS, "pack");
  if (pack.schema_version !== 1) {
    fail("schema_version must be 1");
  }
  const setID = requiredString(pack.set_id, "set_id");
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(setID)) {
    fail("set_id has an invalid format");
  }
  positiveInteger(pack.version, "version");
  for (const key of ["author", "license", "source"]) {
    requiredString(pack[key], key);
  }
  if (!Array.isArray(pack.cards) || pack.cards.length < 24) {
    fail("cards must contain at least 24 entries");
  }
  const seen = new Set();
  let doors = 0;
  let treasures = 0;
  for (const [index, card] of pack.cards.entries()) {
    if (!card || typeof card !== "object" || Array.isArray(card)) {
      fail(`cards[${index}] must be an object`);
    }
    rejectUnknown(card, CARD_KEYS, `cards[${index}]`);
    const cardID = requiredString(card.id, `cards[${index}].id`);
    boundedString(card.name, `cards[${index}].name`, 120, true);
    boundedString(card.rules_text, `${cardID}.rules_text`, 800);
    boundedString(card.flavor_text, `${cardID}.flavor_text`, 300);
    boundedString(card.alt_text, `${cardID}.alt_text`, 200);
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(cardID)) {
      fail(`cards[${index}].id has an invalid format`);
    }
    if (seen.has(cardID)) {
      fail(`duplicate card id ${cardID}`);
    }
    seen.add(cardID);
    if (!CARD_KINDS.has(card.kind)) {
      fail(`card ${cardID} has unknown effect kind ${card.kind}`);
    }
    if (card.image !== undefined) {
      validateAssetPath(card.image, `${cardID}.image`);
      if (card.alt_text === undefined) {
        fail(`${cardID}.alt_text is required with image`);
      }
    } else if (card.alt_text !== undefined) {
      fail(`${cardID}.image is required with alt_text`);
    }
    if (card.kind === "monster") {
      boundedInteger(card.combat_strength, `${cardID}.combat_strength`, 99, true);
      boundedInteger(card.treasure_count, `${cardID}.treasure_count`, 10, true);
      boundedInteger(card.level_loss, `${cardID}.level_loss`, 9);
      doors++;
    } else if (card.kind === "curse") {
      boundedInteger(card.level_loss, `${cardID}.level_loss`, 9, true);
      if (card.combat_strength !== undefined || card.treasure_count !== undefined) {
        fail(`card ${cardID} has fields for another kind`);
      }
      doors++;
    } else if (card.kind === "door") {
      if (card.combat_strength !== undefined ||
        card.treasure_count !== undefined ||
        card.level_loss !== undefined) {
        fail(`card ${cardID} has fields for another kind`);
      }
      doors++;
    } else {
      if (card.combat_strength !== undefined ||
        card.treasure_count !== undefined ||
        card.level_loss !== undefined) {
        fail(`card ${cardID} has fields for another kind`);
      }
      treasures++;
    }
  }
  if (doors < 12 || treasures < 12) {
    fail("pack needs at least 12 door and 12 treasure cards");
  }
  const expected = cardsDigest(pack.cards);
  if (pack.content_digest !== expected) {
    fail(`content_digest mismatch: expected ${expected}`);
  }
  return {
    setID,
    version: pack.version,
    digest: expected,
    cards: pack.cards.length,
    doors,
    treasures,
  };
}

export function validateFile(filePath) {
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, "utf8");
  if (raw.includes("\uFFFD")) {
    fail("content contains U+FFFD");
  }
  const pack = JSON.parse(raw);
  const result = validatePack(pack);
  const root = fs.realpathSync(path.dirname(absolute));
  for (const card of pack.cards) {
    if (!card.image) {
      continue;
    }
    const candidate = fs.realpathSync(path.join(root, card.image));
    const relative = path.relative(root, candidate);
    if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) {
      fail(`card ${card.id} image escapes the content set`);
    }
    if (!fs.statSync(candidate).isFile()) {
      fail(`card ${card.id} image is not a regular file`);
    }
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("usage: node content/tools/validate.mjs <pack.json>");
    process.exit(2);
  }
  try {
    const result = validateFile(filePath);
    console.log(JSON.stringify({ok: true, ...result}));
  } catch (error) {
    console.error(`content validation failed: ${error.message}`);
    process.exit(1);
  }
}

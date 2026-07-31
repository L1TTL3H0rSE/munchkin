import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

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
  "deck",
  "kind",
  "copies",
  "interaction_scope",
  "monster",
  "item",
  "trait",
  "attachment",
  "effects",
  "abilities",
  "combat_capability",
  "theft_capability",
  "rules_text",
  "flavor_text",
  "image",
  "alt_text",
]);
const MONSTER_KEYS = new Set([
  "strength",
  "treasures",
  "levels",
  "pursuit_min_level",
  "tags",
  "modifiers",
  "auto_defeat_character_tags",
  "auto_escape_character_tags",
  "bad_stuff",
]);
const ITEM_KEYS = new Set([
  "slot",
  "hands",
  "size",
  "value",
  "bonus",
  "escape_bonus",
  "hand_limit_bonus",
  "big_allowance",
  "restrictions",
  "modifiers",
]);
const TRAIT_KEYS = new Set(["group", "tags", "tie_wins", "big_allowance", "modifiers"]);
const ATTACHMENT_KEYS = new Set(["group", "extra_traits"]);
const RESTRICTION_KEYS = new Set(["required_tags", "forbidden_tags"]);
const MODIFIER_KEYS = new Set(["target", "amount", "condition"]);
const CONDITION_KEYS = new Set(["kind", "tag"]);
const EFFECT_KEYS = new Set([
  "kind",
  "amount",
  "selector",
  "count",
  "tag",
  "replace_tag",
  "target",
  "deck",
  "persistent",
  "can_win",
]);
const ABILITY_KEYS = new Set([
  "kind",
  "amount",
  "discard_count",
  "cooldown_turns",
]);
const COMBAT_CAPABILITY_KEYS = new Set(["kind", "amount"]);
const THEFT_CAPABILITY_KEYS = new Set(["kind"]);
const COMBAT_CAPABILITY_KINDS = new Set([
  "add_monster",
  "enhance_monster",
  "counter_combat_effect",
  "force_combat_helper",
]);
const CARD_KINDS = new Set([
  "monster",
  "curse",
  "class",
  "race",
  "trait_attachment",
  "item",
  "one_shot",
  "level_up",
  "cheat",
]);
const EFFECT_KINDS = new Set([
  "gain_level",
  "lose_level",
  "modify_combat",
  "modify_escape",
  "modify_hand_limit",
  "modify_treasure_reward",
  "discard",
  "change_character_tag",
  "death",
  "draw",
  "tie_wins",
]);
const MODIFIER_TARGETS = new Set([
  "player_combat",
  "monster_combat",
  "escape",
  "hand_limit",
  "treasure_reward",
]);
const CONDITION_KINDS = new Set([
  "always",
  "character_has_tag",
  "character_lacks_tag",
  "monster_has_tag",
]);
const SELECTORS = new Set(["hand", "equipment", "trait", "owned_card"]);
const TAG_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;
const VISIBLE_TEXT_PATTERN = /[^\s\u0085\uFEFF]/u;
const ZERO_MUST_BE_OMITTED = new Set([
  "amount",
  "big_allowance",
  "bonus",
  "count",
  "escape_bonus",
  "hand_limit_bonus",
  "hands",
  "pursuit_min_level",
]);

function fail(message) {
  throw new Error(message);
}

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function rejectUnknown(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail(`${label}: unknown field ${key}`);
    }
  }
}

function rejectCanonicalDefaults(value, label) {
  if (typeof value === "string") {
    if (value.includes("\uFFFD") || hasUnpairedSurrogate(value)) {
      fail(`${label}: invalid Unicode scalar value`);
    }
    return;
  }
  if (value === null) {
    fail(`${label}: null is not allowed`);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      fail(`${label}: empty array must be omitted`);
    }
    value.forEach((entry, index) =>
      rejectCanonicalDefaults(entry, `${label}[${index}]`));
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    const current = `${label}.${key}`;
    if (entry === "") {
      fail(`${current}: default empty string must be omitted`);
    }
    if (entry === false) {
      fail(`${current}: default false must be omitted`);
    }
    if (entry === 0 && ZERO_MUST_BE_OMITTED.has(key)) {
      fail(`${current}: default zero must be omitted`);
    }
    rejectCanonicalDefaults(entry, current);
  }
}

function hasUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) {
        return true;
      }
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

function requiredString(value, label) {
  if (typeof value !== "string" || !VISIBLE_TEXT_PATTERN.test(value)) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
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

function integer(value, label, minimum, maximum, required = true) {
  if (value === undefined && !required) {
    return;
  }
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`${label} must be an integer from ${minimum} to ${maximum}`);
  }
}

function nonZeroInteger(value, label, minimum, maximum, required = true) {
  integer(value, label, minimum, maximum, required);
  if (value === 0) {
    fail(`${label} must not be zero`);
  }
}

function enumValue(value, allowed, label) {
  if (!allowed.has(value)) {
    fail(`${label} has unsupported value ${String(value)}`);
  }
}

function stringArray(value, label, pattern = TAG_PATTERN) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !pattern.test(entry))) {
    fail(`${label} must contain registered strings`);
  }
  if (new Set(value).size !== value.length) {
    fail(`${label} must not contain duplicates`);
  }
  return value;
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

function canonicalJSONString(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSONString).join(",")}]`;
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJSONString(value[key])}`).join(",")}}`;
}

export function cardsDigest(cards) {
  const hash = crypto.createHash("sha256");
  hash.update("munchkin-cards-v2\n");
  for (const card of cards) {
    const raw = Buffer.from(canonicalJSONString(card), "utf8");
    hash.update(`${raw.length}:`);
    hash.update(raw);
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

function validateCondition(condition, label) {
  rejectUnknown(condition, CONDITION_KEYS, label);
  enumValue(condition.kind, CONDITION_KINDS, `${label}.kind`);
  if (condition.kind === "always") {
    if (condition.tag !== undefined) {
      fail(`${label}.tag is not allowed for always`);
    }
  } else if (typeof condition.tag !== "string" || !TAG_PATTERN.test(condition.tag)) {
    fail(`${label}.tag must be registered`);
  }
}

function validateModifiers(modifiers, label) {
  if (modifiers === undefined) {
    return;
  }
  if (!Array.isArray(modifiers)) {
    fail(`${label} must be an array`);
  }
  modifiers.forEach((modifier, index) => {
    const current = `${label}[${index}]`;
    rejectUnknown(modifier, MODIFIER_KEYS, current);
    enumValue(modifier.target, MODIFIER_TARGETS, `${current}.target`);
    nonZeroInteger(modifier.amount, `${current}.amount`, -20, 20);
    validateCondition(modifier.condition, `${current}.condition`);
  });
}

function validateEffect(effect, label) {
  rejectUnknown(effect, EFFECT_KEYS, label);
  enumValue(effect.kind, EFFECT_KINDS, `${label}.kind`);
  if (effect.persistent === true &&
    !new Set([
      "modify_combat",
      "modify_escape",
      "modify_hand_limit",
      "modify_treasure_reward",
      "tie_wins",
    ]).has(effect.kind)) {
    fail(`${label}.persistent is not supported for ${effect.kind}`);
  }
  if (effect.can_win === true && effect.kind !== "gain_level") {
    fail(`${label}.can_win is only valid for gain_level`);
  }
  switch (effect.kind) {
    case "gain_level":
      rejectUnknown(effect, new Set(["kind", "amount", "can_win"]), label);
      integer(effect.amount, `${label}.amount`, 1, 9);
      break;
    case "lose_level":
      rejectUnknown(effect, new Set(["kind", "amount"]), label);
      integer(effect.amount, `${label}.amount`, 1, 9);
      break;
    case "modify_combat":
      rejectUnknown(
        effect,
        new Set(["kind", "amount", "target", "persistent"]),
        label,
      );
      nonZeroInteger(effect.amount, `${label}.amount`, -20, 20);
      enumValue(effect.target, new Set(["player", "monster"]), `${label}.target`);
      break;
    case "modify_escape":
    case "modify_hand_limit":
    case "modify_treasure_reward":
      rejectUnknown(
        effect,
        new Set(["kind", "amount", "persistent"]),
        label,
      );
      nonZeroInteger(effect.amount, `${label}.amount`, -20, 20);
      break;
    case "discard":
      rejectUnknown(effect, new Set(["kind", "selector", "count"]), label);
      enumValue(effect.selector, SELECTORS, `${label}.selector`);
      integer(effect.count, `${label}.count`, 1, 10);
      break;
    case "change_character_tag":
      rejectUnknown(effect, new Set(["kind", "tag", "replace_tag"]), label);
      if (typeof effect.tag !== "string" || !TAG_PATTERN.test(effect.tag)) {
        fail(`${label}.tag must be registered`);
      }
      if (effect.replace_tag !== undefined && !TAG_PATTERN.test(effect.replace_tag)) {
        fail(`${label}.replace_tag must be registered`);
      }
      break;
    case "death":
      rejectUnknown(effect, new Set(["kind"]), label);
      break;
    case "draw":
      rejectUnknown(effect, new Set(["kind", "deck", "amount"]), label);
      enumValue(effect.deck, new Set(["door", "treasure"]), `${label}.deck`);
      integer(effect.amount, `${label}.amount`, 1, 10);
      break;
    case "tie_wins":
      rejectUnknown(effect, new Set(["kind", "persistent"]), label);
      if (effect.persistent !== true) {
        fail(`${label}.persistent must be true`);
      }
      break;
  }
}

function validateEffects(effects, label, required = false) {
  if (effects === undefined) {
    if (required) {
      fail(`${label} is required`);
    }
    return [];
  }
  if (!Array.isArray(effects) || (required && effects.length === 0)) {
    fail(`${label} must be a non-empty array`);
  }
  effects.forEach((effect, index) => validateEffect(effect, `${label}[${index}]`));
  return effects;
}

function validateAbilities(abilities, label) {
  if (abilities === undefined) {
    return;
  }
  if (!Array.isArray(abilities)) {
    fail(`${label} must be an array`);
  }
  abilities.forEach((ability, index) => {
    const current = `${label}[${index}]`;
    rejectUnknown(ability, ABILITY_KEYS, current);
    switch (ability.kind) {
      case "discard_for_combat":
        integer(ability.amount, `${current}.amount`, 1, 20);
        integer(ability.discard_count, `${current}.discard_count`, 1, 5);
        if (ability.cooldown_turns !== undefined) {
          fail(`${current}.cooldown_turns is not allowed`);
        }
        break;
      case "steal_random_card":
        if (ability.amount !== undefined) {
          fail(`${current}.amount is not allowed`);
        }
        if (ability.discard_count !== 1 || ability.cooldown_turns !== 1) {
          fail(`${current} must use one-card cost and one-turn cooldown`);
        }
        break;
      default:
        fail(`${current}.kind is not registered`);
    }
  });
}

function validateMonster(monster, label) {
  rejectUnknown(monster, MONSTER_KEYS, label);
  integer(monster.strength, `${label}.strength`, 1, 99);
  integer(monster.treasures, `${label}.treasures`, 1, 10);
  integer(monster.levels, `${label}.levels`, 1, 2);
  integer(monster.pursuit_min_level, `${label}.pursuit_min_level`, 1, 9, false);
  stringArray(monster.tags, `${label}.tags`);
  stringArray(monster.auto_defeat_character_tags, `${label}.auto_defeat_character_tags`);
  stringArray(monster.auto_escape_character_tags, `${label}.auto_escape_character_tags`);
  validateModifiers(monster.modifiers, `${label}.modifiers`);
  const badStuff = validateEffects(monster.bad_stuff, `${label}.bad_stuff`, true);
  for (const effect of badStuff) {
    if (effect.persistent === true ||
      new Set([
        "modify_combat",
        "modify_escape",
        "modify_hand_limit",
        "modify_treasure_reward",
        "tie_wins",
      ]).has(effect.kind)) {
      fail(`${label}.bad_stuff has unsupported effect ${effect.kind}`);
    }
  }
}

function validateItem(item, label) {
  rejectUnknown(item, ITEM_KEYS, label);
  enumValue(item.slot, new Set(["none", "headgear", "armor", "footgear", "hands"]), `${label}.slot`);
  enumValue(item.size, new Set(["small", "big"]), `${label}.size`);
  integer(item.value, `${label}.value`, 0, 10000);
  integer(item.bonus, `${label}.bonus`, 1, 20, false);
  nonZeroInteger(item.escape_bonus, `${label}.escape_bonus`, -5, 5, false);
  nonZeroInteger(item.hand_limit_bonus, `${label}.hand_limit_bonus`, -5, 10, false);
  integer(item.big_allowance, `${label}.big_allowance`, 1, 3, false);
  if (item.slot === "hands") {
    integer(item.hands, `${label}.hands`, 1, 2);
  } else if (item.hands !== undefined) {
    fail(`${label}.hands is only valid for a hands item`);
  }
  if (item.restrictions !== undefined) {
    if (item.big_allowance !== undefined) {
      fail(`${label}.big_allowance is not allowed with restrictions`);
    }
    rejectUnknown(item.restrictions, RESTRICTION_KEYS, `${label}.restrictions`);
    stringArray(item.restrictions.required_tags, `${label}.restrictions.required_tags`);
    stringArray(item.restrictions.forbidden_tags, `${label}.restrictions.forbidden_tags`);
  }
  validateModifiers(item.modifiers, `${label}.modifiers`);
}

function validateTrait(trait, label, expectedGroup) {
  rejectUnknown(trait, TRAIT_KEYS, label);
  if (trait.group !== expectedGroup) {
    fail(`${label}.group must be ${expectedGroup}`);
  }
  stringArray(trait.tags, `${label}.tags`);
  if (trait.tie_wins !== undefined && typeof trait.tie_wins !== "boolean") {
    fail(`${label}.tie_wins must be boolean`);
  }
  integer(trait.big_allowance, `${label}.big_allowance`, 1, 3, false);
  validateModifiers(trait.modifiers, `${label}.modifiers`);
}

function noSpecs(card, label, allowed) {
  for (const key of [
    "monster",
    "item",
    "trait",
    "attachment",
    "effects",
    "abilities",
    "combat_capability",
    "theft_capability",
  ]) {
    if (!allowed.has(key) && card[key] !== undefined) {
      fail(`${label}.${key} is not allowed for kind ${card.kind}`);
    }
  }
}

function validateCombatCapability(card, label) {
  const capability = card.combat_capability;
  if (capability === undefined) {
    return;
  }
  rejectUnknown(capability, COMBAT_CAPABILITY_KEYS, `${label}.combat_capability`);
  enumValue(
    capability.kind,
    COMBAT_CAPABILITY_KINDS,
    `${label}.combat_capability.kind`,
  );
  if (card.interaction_scope !== "other_players") {
    fail(`${label}.combat_capability requires other_players scope`);
  }
  switch (capability.kind) {
    case "add_monster":
      if (card.kind !== "monster" || card.deck !== "door" ||
        capability.amount !== undefined) {
        fail(`${label} has an invalid add_monster capability`);
      }
      break;
    case "enhance_monster":
      if (card.kind !== "one_shot" || card.deck !== "treasure") {
        fail(`${label} has an invalid enhance_monster capability`);
      }
      integer(capability.amount, `${label}.combat_capability.amount`, 1, 10);
      break;
    case "counter_combat_effect":
    case "force_combat_helper":
      if (card.kind !== "one_shot" || card.deck !== "treasure" ||
        capability.amount !== undefined) {
        fail(`${label} has an invalid ${capability.kind} capability`);
      }
      break;
  }
}

function validateTheftCapability(card, label) {
  const capability = card.theft_capability;
  if (capability === undefined) {
    return;
  }
  rejectUnknown(capability, THEFT_CAPABILITY_KEYS, `${label}.theft_capability`);
  if (capability.kind !== "counter_theft" ||
    card.interaction_scope !== "other_players" ||
    card.kind !== "one_shot" ||
    card.deck !== "treasure" ||
    card.combat_capability !== undefined) {
    fail(`${label} has an invalid theft capability`);
  }
}

function validateCard(card, index) {
  const label = `cards[${index}]`;
  rejectUnknown(card, CARD_KEYS, label);
  const cardID = requiredString(card.id, `${label}.id`);
  if (!ID_PATTERN.test(cardID)) {
    fail(`${label}.id has an invalid format`);
  }
  boundedString(card.name, `${label}.name`, 120, true);
  boundedString(card.rules_text, `${cardID}.rules_text`, 800);
  boundedString(card.flavor_text, `${cardID}.flavor_text`, 300);
  boundedString(card.alt_text, `${cardID}.alt_text`, 200);
  enumValue(card.deck, new Set(["door", "treasure"]), `${cardID}.deck`);
  enumValue(card.kind, CARD_KINDS, `${cardID}.kind`);
  integer(card.copies, `${cardID}.copies`, 1, 30);
  enumValue(
    card.interaction_scope,
    new Set(["self", "none", "other_players"]),
    `${cardID}.interaction_scope`,
  );
  if (card.image !== undefined) {
    validateAssetPath(card.image, `${cardID}.image`);
    if (card.alt_text === undefined) {
      fail(`${cardID}.alt_text is required with image`);
    }
  } else if (card.alt_text !== undefined) {
    fail(`${cardID}.image is required with alt_text`);
  }
  validateAbilities(card.abilities, `${cardID}.abilities`);
  if (card.abilities?.some((ability) => ability.kind === "steal_random_card") &&
    (card.kind !== "class" || card.interaction_scope !== "other_players")) {
    fail(`${cardID} theft ability requires an other_players class`);
  }
  validateCombatCapability(card, cardID);
  validateTheftCapability(card, cardID);
  switch (card.kind) {
    case "monster":
      if (card.deck !== "door") {
        fail(`${cardID} monster must use door deck`);
      }
      noSpecs(card, cardID, new Set(["monster", "combat_capability"]));
      validateMonster(card.monster, `${cardID}.monster`);
      break;
    case "curse":
      if (card.deck !== "door") {
        fail(`${cardID} curse must use door deck`);
      }
      noSpecs(card, cardID, new Set(["effects"]));
      for (const effect of validateEffects(card.effects, `${cardID}.effects`, true)) {
        if (new Set([
          "modify_combat",
          "modify_escape",
          "modify_hand_limit",
          "modify_treasure_reward",
          "tie_wins",
        ]).has(effect.kind) && effect.persistent !== true) {
          fail(`${cardID} has temporary ${effect.kind} outside combat`);
        }
      }
      break;
    case "class":
    case "race":
      if (card.deck !== "door") {
        fail(`${cardID} trait must use door deck`);
      }
      noSpecs(card, cardID, new Set(["trait", "abilities"]));
      validateTrait(card.trait, `${cardID}.trait`, card.kind);
      break;
    case "trait_attachment":
      if (card.deck !== "door") {
        fail(`${cardID} attachment must use door deck`);
      }
      noSpecs(card, cardID, new Set(["attachment"]));
      rejectUnknown(card.attachment, ATTACHMENT_KEYS, `${cardID}.attachment`);
      enumValue(
        card.attachment.group,
        new Set(["class", "race"]),
        `${cardID}.attachment.group`,
      );
      if (card.attachment.extra_traits !== 1) {
        fail(`${cardID}.attachment.extra_traits must be 1`);
      }
      break;
    case "item":
      if (card.deck !== "treasure") {
        fail(`${cardID} item must use treasure deck`);
      }
      noSpecs(card, cardID, new Set(["item", "abilities"]));
      validateItem(card.item, `${cardID}.item`);
      break;
    case "one_shot":
      if (card.deck !== "treasure") {
        fail(`${cardID} one-shot must use treasure deck`);
      }
      noSpecs(
        card,
        cardID,
        new Set(["effects", "combat_capability", "theft_capability"]),
      );
      validateEffects(card.effects, `${cardID}.effects`, true);
      if (card.effects.some((effect) =>
        effect.persistent === true ||
        effect.kind === "modify_hand_limit" ||
        effect.kind === "tie_wins" ||
        effect.kind === "death")) {
        fail(`${cardID} one-shot contains an unsupported effect`);
      }
      break;
    case "level_up":
      if (card.deck !== "treasure") {
        fail(`${cardID} level-up must use treasure deck`);
      }
      noSpecs(card, cardID, new Set(["effects"]));
      validateEffects(card.effects, `${cardID}.effects`, true);
      if (card.effects.length !== 1 ||
        card.effects[0].kind !== "gain_level" ||
        card.effects[0].can_win === true) {
        fail(`${cardID} level-up needs one non-winning gain_level effect`);
      }
      break;
    case "cheat":
      if (card.deck !== "treasure") {
        fail(`${cardID} cheat must use treasure deck`);
      }
      noSpecs(card, cardID, new Set());
      break;
  }
  return cardID;
}

export function validatePack(pack) {
  rejectCanonicalDefaults(pack, "pack");
  rejectUnknown(pack, ROOT_KEYS, "pack");
  if (pack.schema_version !== 1) {
    fail("schema_version must be 1");
  }
  const setID = requiredString(pack.set_id, "set_id");
  if (!ID_PATTERN.test(setID)) {
    fail("set_id has an invalid format");
  }
  integer(pack.version, "version", 1, Number.MAX_SAFE_INTEGER);
  for (const key of ["author", "license", "source"]) {
    requiredString(pack[key], key);
  }
  if (!Array.isArray(pack.cards) || pack.cards.length < 12) {
    fail("cards must contain at least 12 definitions");
  }
  const seen = new Set();
  let doors = 0;
  let treasures = 0;
  let deferred = 0;
  for (const [index, card] of pack.cards.entries()) {
    const cardID = validateCard(card, index);
    if (seen.has(cardID)) {
      fail(`duplicate card id ${cardID}`);
    }
    seen.add(cardID);
    if (card.interaction_scope === "other_players") {
      deferred += card.copies;
      continue;
    }
    if (card.deck === "door") {
      doors += card.copies;
    } else {
      treasures += card.copies;
    }
  }
  if (doors < 25 || treasures < 25) {
    fail("core profile needs at least 25 enabled cards per deck");
  }
  const expected = cardsDigest(pack.cards);
  if (pack.content_digest !== expected) {
    fail(`content_digest mismatch: expected ${expected}`);
  }
  return {
    setID,
    version: pack.version,
    digest: expected,
    definitions: pack.cards.length,
    doors,
    treasures,
    deferred,
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
    if (relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative)) {
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

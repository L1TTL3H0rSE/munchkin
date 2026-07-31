import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {cardsDigest, validatePack} from "./validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "schema", "card-set.schema.json");
const demo = JSON.parse(
  fs.readFileSync(path.join(root, "sets", "demo", "cards.json"), "utf8"),
);
const moscow = JSON.parse(
  fs.readFileSync(
    path.join(root, "sets", "moscow", "v1", "cards.json"),
    "utf8",
  ),
);
const moscowV2Root = path.join(root, "sets", "moscow", "v2");
const moscowV2 = JSON.parse(
  fs.readFileSync(path.join(moscowV2Root, "cards.json"), "utf8"),
);
const moscowV2Provenance = JSON.parse(
  fs.readFileSync(path.join(moscowV2Root, "provenance.json"), "utf8"),
);
const moscowV3Root = path.join(root, "sets", "moscow", "v3");
const moscowV3 = JSON.parse(
  fs.readFileSync(path.join(moscowV3Root, "cards.json"), "utf8"),
);
const moscowV3Provenance = JSON.parse(
  fs.readFileSync(path.join(moscowV3Root, "provenance.json"), "utf8"),
);
const powershellProbe = spawnSync(
  "pwsh",
  ["-NoProfile", "-NonInteractive", "-Command", "exit 0"],
);
const sha256Pattern = /^sha256:[a-f0-9]{64}$/;

function withDigest(pack) {
  pack.content_digest = cardsDigest(pack.cards);
  return pack;
}

function moscowStats(pack) {
  const stats = {
    definitions: pack.cards.length,
    slots: 0,
    doors: 0,
    treasures: 0,
    active: 0,
    deferred: 0,
    activeDoors: 0,
    activeTreasures: 0,
  };
  for (const card of pack.cards) {
    stats.slots += card.copies;
    stats[card.deck === "door" ? "doors" : "treasures"] += card.copies;
    if (card.interaction_scope === "other_players") {
      stats.deferred += card.copies;
    } else {
      stats.active += card.copies;
      stats[card.deck === "door" ? "activeDoors" : "activeTreasures"] +=
        card.copies;
    }
  }
  return stats;
}

function requireMoscow(condition, message) {
  if (!condition) {
    throw new Error(`moscow-core invariant: ${message}`);
  }
}

function incrementCount(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedCounts(counts) {
  return Object.fromEntries(
    [...counts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

function assertMoscowInvariants(pack) {
  const result = validatePack(pack);
  const stats = moscowStats(pack);
  requireMoscow(stats.definitions === 168, "needs 168 definitions");
  requireMoscow(stats.slots === 168, "needs exactly 168 physical slots");
  requireMoscow(stats.doors === 95, "needs exactly 95 Door slots");
  requireMoscow(stats.treasures === 73, "needs exactly 73 Treasure slots");
  requireMoscow(stats.active === 152, "needs exactly 152 active slots");
  requireMoscow(stats.deferred === 16, "needs exactly 16 deferred slots");
  requireMoscow(stats.activeDoors === 84, "needs exactly 84 active Doors");
  requireMoscow(
    stats.activeTreasures === 68,
    "needs exactly 68 active Treasures",
  );
  requireMoscow(
    pack.cards.every((card) => card.copies === 1),
    "each authored slot must remain a distinct definition",
  );
  requireMoscow(
    new Set(pack.cards.map((card) => card.id)).size === 168,
    "card IDs must be unique",
  );
  requireMoscow(
    new Set(pack.cards.map((card) => card.name)).size === 168,
    "card names must be unique",
  );
  for (const card of pack.cards) {
    requireMoscow(
      /[А-ЯЁа-яё]/u.test(card.name) &&
        /[А-ЯЁа-яё]/u.test(card.rules_text) &&
        /[А-ЯЁа-яё]/u.test(card.flavor_text),
      `${card.id} must have original Cyrillic presentation text`,
    );
    requireMoscow(
      card.image === undefined && card.alt_text === undefined,
      `${card.id} must remain text-only in version 1`,
    );
  }
  return {result, stats};
}

function withoutVisualFields(card) {
  const result = structuredClone(card);
  delete result.image;
  delete result.alt_text;
  return result;
}

function assertMoscowV2Artifacts(pack, provenance, setRoot) {
  const result = validatePack(pack);
  requireMoscow(pack.set_id === "moscow-core", "v2 set ID changed");
  requireMoscow(pack.version === 2, "visual pack must be version 2");
  requireMoscow(
    pack.source === "original-moscow-core-visual-2026",
    "v2 source changed",
  );
  requireMoscow(
    pack.author === moscow.author && pack.license === moscow.license,
    "v2 rights metadata must match its source pack",
  );
  assert.deepEqual(pack.cards.map(withoutVisualFields), moscow.cards);

  assert.deepEqual(
    Object.keys(provenance).sort(),
    [
      "content_digest",
      "records",
      "schema_version",
      "set_id",
      "source_digest",
      "source_version",
      "status",
      "version",
    ],
  );
  requireMoscow(provenance.schema_version === 1, "invalid provenance schema");
  requireMoscow(provenance.set_id === pack.set_id, "provenance set mismatch");
  requireMoscow(provenance.version === pack.version, "provenance version mismatch");
  requireMoscow(provenance.status === "draft", "v2 must remain an explicit draft");
  requireMoscow(provenance.source_version === 1, "invalid source version");
  requireMoscow(
    provenance.source_digest === moscow.content_digest,
    "source digest does not identify immutable Moscow v1",
  );
  requireMoscow(
    provenance.content_digest === pack.content_digest,
    "provenance content digest mismatch",
  );

  const visualCards = pack.cards.filter((card) => card.image !== undefined);
  requireMoscow(visualCards.length > 0, "v2 needs a reviewed visual asset");
  requireMoscow(
    visualCards.length === provenance.records.length,
    "each visual card needs exactly one provenance record",
  );
  const recordIDs = new Set();
  for (const record of provenance.records) {
    assert.deepEqual(
      Object.keys(record).sort(),
      [
        "alt_text",
        "approved_at",
        "asset_path",
        "card_id",
        "model",
        "output_sha256",
        "prompt_hash",
        "provider",
        "provider_request_id",
        "quality",
        "size",
      ],
    );
    requireMoscow(!recordIDs.has(record.card_id), "duplicate provenance record");
    recordIDs.add(record.card_id);
    const card = pack.cards.find((entry) => entry.id === record.card_id);
    requireMoscow(card !== undefined, "provenance references an unknown card");
    requireMoscow(
      record.asset_path === `assets/${record.card_id}.webp`,
      "asset path must derive from the allowlisted card ID",
    );
    requireMoscow(card.image === record.asset_path, "card asset path mismatch");
    requireMoscow(card.alt_text === record.alt_text, "card alt text mismatch");
    requireMoscow(
      record.provider === "fake" || record.provider === "openai",
      "invalid provenance provider",
    );
    requireMoscow(
      typeof record.model === "string" && record.model.length > 0,
      "provenance model is required",
    );
    requireMoscow(
      ["low", "medium", "high", "unexposed"].includes(record.quality),
      "invalid provenance quality",
    );
    const hasBuiltInMarker = record.quality === "unexposed" ||
      record.model === "codex-imagegen-built-in";
    requireMoscow(
      !hasBuiltInMarker || (
        record.provider === "openai" &&
        record.model === "codex-imagegen-built-in" &&
        record.quality === "unexposed"
      ),
      "invalid built-in ImageGen provenance",
    );
    requireMoscow(record.size === "1024x1536", "invalid provenance size");
    requireMoscow(
      sha256Pattern.test(record.prompt_hash),
      "invalid prompt digest",
    );
    requireMoscow(
      sha256Pattern.test(record.output_sha256),
      "invalid output digest",
    );
    requireMoscow(
      typeof record.provider_request_id === "string" &&
        record.provider_request_id.length > 0,
      "provider request ID is required",
    );
    requireMoscow(
      Number.isFinite(Date.parse(record.approved_at)),
      "approval timestamp is invalid",
    );

    const assetPath = path.resolve(setRoot, record.asset_path);
    const relative = path.relative(setRoot, assetPath);
    requireMoscow(
      relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative),
      "asset escapes v2",
    );
    const assetStat = fs.lstatSync(assetPath);
    requireMoscow(
      assetStat.isFile() && !assetStat.isSymbolicLink(),
      "asset must be a regular non-symlink file",
    );
    const bytes = fs.readFileSync(assetPath);
    requireMoscow(
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
        bytes.subarray(8, 12).toString("ascii") === "WEBP",
      "approved asset bytes must be WebP",
    );
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    requireMoscow(digest === record.output_sha256, "asset digest mismatch");
  }

  const serialized = JSON.stringify(provenance);
  requireMoscow(
    !/(?:api[_-]?key|authorization|bearer|token)/iu.test(serialized),
    "provenance must not contain credentials",
  );
  return result;
}

test("demo pack passes closed semantic validation", () => {
  const result = validatePack(structuredClone(demo));
  assert.deepEqual(
    {
      definitions: result.definitions,
      doors: result.doors,
      treasures: result.treasures,
      deferred: result.deferred,
    },
    {definitions: 36, doors: 40, treasures: 30, deferred: 2},
  );
});

test("moscow-core v1 has immutable identity and exact slot matrix", () => {
  assert.deepEqual(
    {
      schema_version: moscow.schema_version,
      set_id: moscow.set_id,
      version: moscow.version,
      author: moscow.author,
      license: moscow.license,
      source: moscow.source,
      content_digest: moscow.content_digest,
    },
    {
      schema_version: 1,
      set_id: "moscow-core",
      version: 1,
      author: "L1TTL3H0rSE",
      license: "All-Rights-Reserved",
      source: "original-moscow-core-2026",
      content_digest:
        "sha256:e87f280cc53667659c38308dc213510749c8c87495c38cefc07f58f8bb094854",
    },
  );
  const {result, stats} = assertMoscowInvariants(structuredClone(moscow));
  assert.deepEqual(stats, {
    definitions: 168,
    slots: 168,
    doors: 95,
    treasures: 73,
    active: 152,
    deferred: 16,
    activeDoors: 84,
    activeTreasures: 68,
  });
  assert.deepEqual(
    {
      definitions: result.definitions,
      doors: result.doors,
      treasures: result.treasures,
      deferred: result.deferred,
    },
    {definitions: 168, doors: 84, treasures: 68, deferred: 16},
  );
  assert.equal(moscow.content_digest, cardsDigest(moscow.cards));
});

test("moscow-core v2 preserves v1 mechanics and validates visual provenance", () => {
  const result = assertMoscowV2Artifacts(
    structuredClone(moscowV2),
    structuredClone(moscowV2Provenance),
    moscowV2Root,
  );
  assert.deepEqual(
    {
      setID: result.setID,
      version: result.version,
      digest: result.digest,
      definitions: result.definitions,
      doors: result.doors,
      treasures: result.treasures,
      deferred: result.deferred,
    },
    {
      setID: "moscow-core",
      version: 2,
      digest: moscowV2.content_digest,
      definitions: 168,
      doors: 84,
      treasures: 68,
      deferred: 16,
    },
  );
});

test("moscow-core v2 rejects provenance source and asset digest drift", () => {
  const sourceDrift = structuredClone(moscowV2Provenance);
  sourceDrift.source_digest = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => assertMoscowV2Artifacts(moscowV2, sourceDrift, moscowV2Root),
    /source digest/,
  );

  const assetDrift = structuredClone(moscowV2Provenance);
  assetDrift.records[0].output_sha256 = `sha256:${"0".repeat(64)}`;
  assert.throws(
    () => assertMoscowV2Artifacts(moscowV2, assetDrift, moscowV2Root),
    /asset digest/,
  );

  const qualityDrift = structuredClone(moscowV2Provenance);
  qualityDrift.records[0].quality = "unknown";
  assert.throws(
    () => assertMoscowV2Artifacts(moscowV2, qualityDrift, moscowV2Root),
    /provenance quality/,
  );

  const builtInQualityDrift = structuredClone(moscowV2Provenance);
  builtInQualityDrift.records[0].quality = "low";
  assert.throws(
    () => assertMoscowV2Artifacts(
      moscowV2,
      builtInQualityDrift,
      moscowV2Root,
    ),
    /built-in ImageGen provenance/,
  );

  const builtInProviderDrift = structuredClone(moscowV2Provenance);
  builtInProviderDrift.records[0].provider = "fake";
  assert.throws(
    () => assertMoscowV2Artifacts(
      moscowV2,
      builtInProviderDrift,
      moscowV2Root,
    ),
    /built-in ImageGen provenance/,
  );
});

test("moscow-core v3 publishes only the closed advanced-combat capabilities", () => {
  const result = validatePack(structuredClone(moscowV3));
  assert.deepEqual(
    {
      setID: result.setID,
      version: result.version,
      digest: result.digest,
      definitions: result.definitions,
      doors: result.doors,
      treasures: result.treasures,
      deferred: result.deferred,
    },
    {
      setID: "moscow-core",
      version: 3,
      digest: moscowV3.content_digest,
      definitions: 168,
      doors: 83,
      treasures: 68,
      deferred: 17,
    },
  );
  assert.equal(moscowV3.author, moscowV2.author);
  assert.equal(moscowV3.license, moscowV2.license);
  assert.equal(
    moscowV3.source,
    "original-moscow-core-advanced-combat-2026",
  );
  assert.equal(moscowV3Provenance.status, "published");
  assert.equal(moscowV3Provenance.source_version, 2);
  assert.equal(
    moscowV3Provenance.source_digest,
    moscowV2.content_digest,
  );
  assert.equal(
    moscowV3Provenance.content_digest,
    moscowV3.content_digest,
  );
  assert.deepEqual(
    Object.fromEntries(
      moscowV3.cards
        .filter((card) => card.combat_capability !== undefined)
        .map((card) => [card.id, card.combat_capability]),
    ),
    {
      "paperwork-hydra": {kind: "add_monster"},
      "flash-mob-intervention": {kind: "force_combat_helper"},
      "sudden-traffic-jam": {kind: "enhance_monster", amount: 4},
      "anonymous-complaint": {kind: "counter_combat_effect"},
    },
  );
  assert.deepEqual(
    moscowV3.cards
      .filter((card, index) =>
        JSON.stringify(card) !== JSON.stringify(moscowV2.cards[index]))
      .map((card) => card.id),
    [
      "paperwork-hydra",
      "flash-mob-intervention",
      "sudden-traffic-jam",
      "anonymous-complaint",
    ],
  );
  const record = moscowV3Provenance.records[0];
  const assetBytes = fs.readFileSync(path.join(moscowV3Root, record.asset_path));
  assert.equal(
    `sha256:${createHash("sha256").update(assetBytes).digest("hex")}`,
    record.output_sha256,
  );
});

test("advanced-combat capability registry rejects unknown fields and combinations", () => {
  const find = (pack, id) => pack.cards.find((card) => card.id === id);

  const unknownKind = structuredClone(moscowV3);
  find(unknownKind, "sudden-traffic-jam").combat_capability.kind =
    "execute_expression";
  assert.throws(
    () => validatePack(withDigest(unknownKind)),
    /combat_capability\.kind/,
  );

  const rawTarget = structuredClone(moscowV3);
  find(rawTarget, "sudden-traffic-jam").combat_capability.target_path =
    "players[1].hand";
  assert.throws(
    () => validatePack(withDigest(rawTarget)),
    /unknown field target_path/,
  );

  const excessiveEnhancement = structuredClone(moscowV3);
  find(
    excessiveEnhancement,
    "sudden-traffic-jam",
  ).combat_capability.amount = 11;
  assert.throws(
    () => validatePack(withDigest(excessiveEnhancement)),
    /combat_capability\.amount/,
  );

  const wrongScope = structuredClone(moscowV3);
  find(wrongScope, "anonymous-complaint").interaction_scope = "self";
  assert.throws(
    () => validatePack(withDigest(wrongScope)),
    /requires other_players scope/,
  );

  const wrongCardKind = structuredClone(moscowV3);
  find(wrongCardKind, "paperwork-hydra").combat_capability.kind =
    "force_combat_helper";
  assert.throws(
    () => validatePack(withDigest(wrongCardKind)),
    /invalid force_combat_helper capability/,
  );
});

test("moscow-core covers every closed card, effect and modifier branch", () => {
  const cardKinds = new Set();
  const cardKindCounts = new Map();
  const activeKindCounts = new Map();
  const deferredKindCounts = new Map();
  const effectKinds = new Set();
  const effectKindCounts = new Map();
  const modifierTargets = new Set();
  const modifierTargetCounts = new Map();
  const conditionKinds = new Set();
  const itemSlotCounts = new Map();
  const monsterStrengths = [];
  const monsterTreasures = [];
  let abilities = 0;
  for (const card of moscow.cards) {
    cardKinds.add(card.kind);
    incrementCount(cardKindCounts, card.kind);
    incrementCount(
      card.interaction_scope === "other_players"
        ? deferredKindCounts
        : activeKindCounts,
      card.kind,
    );
    const effects = [
      ...(card.effects ?? []),
      ...(card.monster?.bad_stuff ?? []),
    ];
    effects.forEach((effect) => {
      effectKinds.add(effect.kind);
      incrementCount(effectKindCounts, effect.kind);
    });
    const modifiers = [
      ...(card.monster?.modifiers ?? []),
      ...(card.item?.modifiers ?? []),
      ...(card.trait?.modifiers ?? []),
    ];
    for (const modifier of modifiers) {
      modifierTargets.add(modifier.target);
      incrementCount(modifierTargetCounts, modifier.target);
      conditionKinds.add(modifier.condition.kind);
    }
    if (card.item) {
      incrementCount(itemSlotCounts, card.item.slot);
    }
    if (card.monster) {
      monsterStrengths.push(card.monster.strength);
      monsterTreasures.push(card.monster.treasures);
    }
    abilities += card.abilities?.length ?? 0;
  }
  assert.deepEqual(
    [...cardKinds].sort(),
    [
      "cheat",
      "class",
      "curse",
      "item",
      "level_up",
      "monster",
      "one_shot",
      "race",
      "trait_attachment",
    ],
  );
  assert.deepEqual(sortedCounts(cardKindCounts), {
    cheat: 5,
    class: 12,
    curse: 30,
    item: 40,
    level_up: 9,
    monster: 36,
    one_shot: 19,
    race: 9,
    trait_attachment: 8,
  });
  assert.deepEqual(sortedCounts(activeKindCounts), {
    cheat: 4,
    class: 11,
    curse: 24,
    item: 39,
    level_up: 9,
    monster: 34,
    one_shot: 16,
    race: 8,
    trait_attachment: 7,
  });
  assert.deepEqual(sortedCounts(deferredKindCounts), {
    cheat: 1,
    class: 1,
    curse: 6,
    item: 1,
    monster: 2,
    one_shot: 3,
    race: 1,
    trait_attachment: 1,
  });
  assert.deepEqual(
    [...effectKinds].sort(),
    [
      "change_character_tag",
      "death",
      "discard",
      "draw",
      "gain_level",
      "lose_level",
      "modify_combat",
      "modify_escape",
      "modify_hand_limit",
      "modify_treasure_reward",
      "tie_wins",
    ],
  );
  assert.deepEqual(sortedCounts(effectKindCounts), {
    change_character_tag: 7,
    death: 4,
    discard: 37,
    draw: 5,
    gain_level: 10,
    lose_level: 14,
    modify_combat: 13,
    modify_escape: 7,
    modify_hand_limit: 3,
    modify_treasure_reward: 5,
    tie_wins: 1,
  });
  assert.deepEqual(
    [...modifierTargets].sort(),
    [
      "escape",
      "hand_limit",
      "monster_combat",
      "player_combat",
      "treasure_reward",
    ],
  );
  assert.deepEqual(sortedCounts(modifierTargetCounts), {
    escape: 4,
    hand_limit: 4,
    monster_combat: 15,
    player_combat: 22,
    treasure_reward: 3,
  });
  assert.deepEqual(
    [...conditionKinds].sort(),
    [
      "always",
      "character_has_tag",
      "character_lacks_tag",
      "monster_has_tag",
    ],
  );
  assert.deepEqual(sortedCounts(itemSlotCounts), {
    armor: 5,
    footgear: 2,
    hands: 14,
    headgear: 6,
    none: 13,
  });
  assert.deepEqual(
    [Math.min(...monsterStrengths), Math.max(...monsterStrengths)],
    [1, 20],
  );
  assert.deepEqual(
    [...new Set(monsterTreasures)].sort((left, right) => left - right),
    [1, 2, 3, 4, 5],
  );
  assert.ok(abilities > 0);
});

test("moscow-core active modifier tags close over active producers", () => {
  const activeCards = moscow.cards.filter(
    (card) => card.interaction_scope !== "other_players",
  );
  const characterTags = new Set();
  const monsterTags = new Set();
  for (const card of activeCards) {
    for (const tag of card.trait?.tags ?? []) {
      characterTags.add(tag);
    }
    for (const tag of card.monster?.tags ?? []) {
      monsterTags.add(tag);
    }
    for (const effect of [
      ...(card.effects ?? []),
      ...(card.monster?.bad_stuff ?? []),
    ]) {
      if (effect.kind === "change_character_tag" && effect.remove !== true) {
        characterTags.add(effect.tag);
      }
    }
  }

  const unresolved = [];
  for (const card of activeCards) {
    for (const effect of [
      ...(card.effects ?? []),
      ...(card.monster?.bad_stuff ?? []),
    ]) {
      if (
        effect.kind === "change_character_tag" &&
        effect.replace_tag !== undefined &&
        !characterTags.has(effect.replace_tag)
      ) {
        unresolved.push(`${card.id}:character:${effect.replace_tag}`);
      }
      if (
        effect.kind === "change_character_tag" &&
        effect.remove === true &&
        !characterTags.has(effect.tag)
      ) {
        unresolved.push(`${card.id}:character:${effect.tag}`);
      }
    }
    for (const tag of [
      ...(card.monster?.auto_defeat_character_tags ?? []),
      ...(card.monster?.auto_escape_character_tags ?? []),
      ...(card.item?.restrictions?.required_tags ?? []),
      ...(card.item?.restrictions?.forbidden_tags ?? []),
    ]) {
      if (!characterTags.has(tag)) {
        unresolved.push(`${card.id}:character:${tag}`);
      }
    }
    for (const modifier of [
      ...(card.monster?.modifiers ?? []),
      ...(card.item?.modifiers ?? []),
      ...(card.trait?.modifiers ?? []),
    ]) {
      const condition = modifier.condition;
      if (
        condition.kind === "monster_has_tag" &&
        !monsterTags.has(condition.tag)
      ) {
        unresolved.push(`${card.id}:monster:${condition.tag}`);
      }
      if (
        (condition.kind === "character_has_tag" ||
          condition.kind === "character_lacks_tag") &&
        !characterTags.has(condition.tag)
      ) {
        unresolved.push(`${card.id}:character:${condition.tag}`);
      }
    }
  }

  assert.deepEqual(unresolved, []);
  assert.equal(characterTags.size, 23);
  assert.equal(monsterTags.size, 14);
  assert.ok(characterTags.has("confused"));
  assert.ok(characterTags.has("office-worker"));
  assert.ok(characterTags.has("tourist"));
  assert.equal(
    moscow.cards.find(
      (card) => card.id === "service-window-forty-seven",
    ).monster.pursuit_min_level,
    2,
  );
});

test("moscow-core pack invariants fail on slot, scope and language drift", () => {
  const mutations = [
    {
      message: /exactly 168 physical slots/,
      mutate(pack) {
        pack.cards[0].copies = 2;
      },
    },
    {
      message: /exactly 95 Door slots/,
      mutate(pack) {
        const card = pack.cards.find((entry) => entry.id === "wet-socks-curse");
        card.deck = "treasure";
        card.kind = "one_shot";
      },
    },
    {
      message: /exactly 152 active slots/,
      mutate(pack) {
        pack.cards.find(
          (entry) => entry.id === "travel-mug",
        ).interaction_scope = "other_players";
      },
    },
    {
      message: /original Cyrillic presentation text/,
      mutate(pack) {
        pack.cards[0].name = "Plain card";
      },
    },
    {
      message: /card names must be unique/,
      mutate(pack) {
        pack.cards[1].name = pack.cards[0].name;
      },
    },
  ];
  for (const {message, mutate} of mutations) {
    const changed = structuredClone(moscow);
    mutate(changed);
    assert.throws(() => assertMoscowInvariants(withDigest(changed)), message);
  }
});

test("moscow-core is text-only and independent from local references", () => {
  const source = JSON.stringify(moscow);
  for (const forbidden of [
    "reference-local",
    "source_locator",
    "public_name",
    "mechanical_synopsis",
    "\"ordinal\"",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }

  const unsafe = structuredClone(moscow);
  unsafe.cards[0].image = "https://example.invalid/card.png";
  unsafe.cards[0].alt_text = "Remote card art";
  assert.throws(
    () => validatePack(withDigest(unsafe)),
    /safe repository-relative image path/,
  );
});

test("moscow-core validates from a clean committed-input copy", () => {
  const checkout = fs.mkdtempSync(
    path.join(os.tmpdir(), "munchkin-moscow-clean-"),
  );
  try {
    const validatorPath = path.join(
      checkout,
      "content",
      "tools",
      "validate.mjs",
    );
    const packPath = path.join(
      checkout,
      "content",
      "sets",
      "moscow",
      "v1",
      "cards.json",
    );
    fs.mkdirSync(path.dirname(validatorPath), {recursive: true});
    fs.mkdirSync(path.dirname(packPath), {recursive: true});
    fs.copyFileSync(path.join(root, "tools", "validate.mjs"), validatorPath);
    fs.copyFileSync(
      path.join(root, "sets", "moscow", "v1", "cards.json"),
      packPath,
    );

    assert.equal(
      fs.existsSync(path.join(checkout, "content", "reference-local")),
      false,
    );
    const result = spawnSync(process.execPath, [validatorPath, packPath], {
      cwd: checkout,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      ok: true,
      setID: "moscow-core",
      version: 1,
      digest: moscow.content_digest,
      definitions: 168,
      doors: 84,
      treasures: 68,
      deferred: 16,
    });
  } finally {
    fs.rmSync(checkout, {recursive: true, force: true});
  }
});

test("moscow-core v2 validates from a clean committed-input copy", () => {
  const checkout = fs.mkdtempSync(
    path.join(os.tmpdir(), "munchkin-moscow-v2-clean-"),
  );
  try {
    const validatorPath = path.join(
      checkout,
      "content",
      "tools",
      "validate.mjs",
    );
    const copiedV2Root = path.join(
      checkout,
      "content",
      "sets",
      "moscow",
      "v2",
    );
    const packPath = path.join(copiedV2Root, "cards.json");
    fs.mkdirSync(path.dirname(validatorPath), {recursive: true});
    fs.mkdirSync(path.dirname(copiedV2Root), {recursive: true});
    fs.copyFileSync(path.join(root, "tools", "validate.mjs"), validatorPath);
    fs.cpSync(moscowV2Root, copiedV2Root, {recursive: true});

    const result = spawnSync(process.execPath, [validatorPath, packPath], {
      cwd: checkout,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
      ok: true,
      setID: "moscow-core",
      version: 2,
      digest: moscowV2.content_digest,
      definitions: 168,
      doors: 84,
      treasures: 68,
      deferred: 16,
    });
    assertMoscowV2Artifacts(
      JSON.parse(fs.readFileSync(packPath, "utf8")),
      JSON.parse(
        fs.readFileSync(path.join(copiedV2Root, "provenance.json"), "utf8"),
      ),
      copiedV2Root,
    );
  } finally {
    fs.rmSync(checkout, {recursive: true, force: true});
  }
});

test("JSON Schema accepts demo and rejects closed-contract mutations", {
  skip: powershellProbe.status === 0
    ? false
    : "PowerShell Test-Json is unavailable",
}, () => {
  assert.equal(schemaAccepts(demo), true);
  const mutations = [
    (pack) => {
      delete pack.cards.find((card) => card.id === "wet-documents").effects;
    },
    (pack) => {
      pack.cards.find((card) => card.id === "wet-documents").effects = [{
        kind: "lose_level",
        amount: 1,
        target: "player",
      }];
    },
    (pack) => {
      pack.cards.find(
        (card) => card.id === "late-train-lesson",
      ).effects[0].can_win = true;
    },
    (pack) => {
      pack.cards.find(
        (card) => card.id === "courtyard-pigeon",
      ).monster.bad_stuff = [{kind: "modify_escape", amount: -1}];
    },
    (pack) => {
      pack.cards.find((card) => card.id === "quilted-vest").item.hands = 1;
    },
    (pack) => {
      pack.cards[0].rules_text = "   ";
    },
    (pack) => {
      pack.cards[0].rules_text = "\u0085";
    },
    (pack) => {
      pack.cards[0].flavor_text = "\uFEFF";
    },
    (pack) => {
      pack.version = Number.MAX_SAFE_INTEGER + 1;
    },
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(demo);
    mutate(changed);
    assert.equal(schemaAccepts(changed), false, `schema mutation ${index}`);
  }
});

test("JSON Schema accepts committed moscow-core v1", {
  skip: powershellProbe.status === 0
    ? false
    : "PowerShell Test-Json is unavailable",
}, () => {
  assert.equal(schemaAccepts(moscow), true);
});

test("JSON Schema accepts committed moscow-core v2", {
  skip: powershellProbe.status === 0
    ? false
    : "PowerShell Test-Json is unavailable",
}, () => {
  assert.equal(schemaAccepts(moscowV2), true);
});

test("JSON Schema accepts committed moscow-core v3 and rejects raw targets", {
  skip: powershellProbe.status === 0
    ? false
    : "PowerShell Test-Json is unavailable",
}, () => {
  assert.equal(schemaAccepts(moscowV3), true);
  const rawTarget = structuredClone(moscowV3);
  rawTarget.cards.find(
    (card) => card.id === "sudden-traffic-jam",
  ).combat_capability.target_path = "players[1].hand";
  assert.equal(schemaAccepts(rawTarget), false);
});

test("unknown fields, effects, selectors and conditions fail closed", () => {
  const unknownField = structuredClone(demo);
  unknownField.cards[0].monster.script = "level += 99";
  assert.throws(
    () => validatePack(withDigest(unknownField)),
    /unknown field script/,
  );

  const unknownEffect = structuredClone(demo);
  unknownEffect.cards[5].effects[0].kind = "javascript";
  assert.throws(
    () => validatePack(withDigest(unknownEffect)),
    /unsupported value javascript/,
  );

  const unknownSelector = structuredClone(demo);
  unknownSelector.cards[5].effects[0].selector = "another_player";
  assert.throws(
    () => validatePack(withDigest(unknownSelector)),
    /unsupported value another_player/,
  );

  const invalidCondition = structuredClone(demo);
  invalidCondition.cards[1].monster.modifiers[0].condition.kind = "expression";
  assert.throws(
    () => validatePack(withDigest(invalidCondition)),
    /unsupported value expression/,
  );
});

test("kind-specific fields and quantities are rejected", () => {
  const wrongDeck = structuredClone(demo);
  wrongDeck.cards[0].deck = "treasure";
  assert.throws(
    () => validatePack(withDigest(wrongDeck)),
    /monster must use door deck/,
  );

  const invalidHands = structuredClone(demo);
  const armor = invalidHands.cards.find((card) => card.id === "quilted-vest");
  armor.item.hands = 1;
  assert.throws(
    () => validatePack(withDigest(invalidHands)),
    /only valid for a hands item/,
  );

  const invalidCopies = structuredClone(demo);
  invalidCopies.cards[0].copies = 0;
  assert.throws(
    () => validatePack(withDigest(invalidCopies)),
    /integer from 1 to 30/,
  );

  const unsafeVersion = structuredClone(demo);
  unsafeVersion.version = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(
    () => validatePack(unsafeVersion),
    /integer from 1 to 9007199254740991/,
  );
});

test("duplicate identity and digest drift are rejected", () => {
  const duplicate = structuredClone(demo);
  duplicate.cards[1].id = duplicate.cards[0].id;
  assert.throws(
    () => validatePack(withDigest(duplicate)),
    /duplicate card id/,
  );

  const drift = structuredClone(demo);
  drift.cards[0].monster.strength += 1;
  assert.throws(() => validatePack(drift), /content_digest mismatch/);
});

test("digest covers copies and every nested mechanic independent of key order", () => {
  const original = cardsDigest(demo.cards);
  for (const mutate of [
    (pack) => {
      pack.cards[0].copies += 1;
    },
    (pack) => {
      pack.cards[0].monster.bad_stuff[0].amount += 1;
    },
    (pack) => {
      pack.cards[1].monster.modifiers[0].condition.tag = "local";
    },
    (pack) => {
      pack.cards.find((card) => card.item).item.value += 1;
    },
  ]) {
    const changed = structuredClone(demo);
    mutate(changed);
    assert.notEqual(cardsDigest(changed.cards), original);
  }

  const card = structuredClone(demo.cards[0]);
  const reordered = Object.fromEntries(Object.entries(card).reverse());
  assert.equal(cardsDigest([card]), cardsDigest([reordered]));
});

test("interaction-only definitions are validated but excluded from core counts", () => {
  const changed = structuredClone(demo);
  const deferred = changed.cards.find((card) => card.id === "borrowed-badge");
  deferred.copies = 20;
  const result = validatePack(withDigest(changed));
  assert.equal(result.doors, 40);
  assert.equal(result.deferred, 21);

  const disabledCore = structuredClone(demo);
  for (const card of disabledCore.cards) {
    if (card.deck === "door") {
      card.interaction_scope = "other_players";
    }
  }
  assert.throws(
    () => validatePack(withDigest(disabledCore)),
    /at least 25 enabled cards per deck/,
  );
});

test("unsafe presentation metadata is rejected", () => {
  const unsafe = structuredClone(demo);
  unsafe.cards[0].image = "assets/../outside.png";
  unsafe.cards[0].alt_text = "Outside";
  assert.throws(
    () => validatePack(withDigest(unsafe)),
    /safe repository-relative image path/,
  );
});

test("context-invalid effects and kind-specific fields fail closed", () => {
  const temporaryCurse = structuredClone(demo);
  const curse = temporaryCurse.cards.find((card) => card.id === "wet-documents");
  curse.effects = [{
    kind: "modify_combat",
    amount: 2,
    target: "player",
  }];
  assert.throws(
    () => validatePack(withDigest(temporaryCurse)),
    /temporary modify_combat outside combat/,
  );

  const persistentOneShot = structuredClone(demo);
  persistentOneShot.cards.find(
    (card) => card.id === "pocket-sand",
  ).effects[0].persistent = true;
  assert.throws(
    () => validatePack(withDigest(persistentOneShot)),
    /one-shot contains an unsupported effect/,
  );

  const irrelevantField = structuredClone(demo);
  irrelevantField.cards.find(
    (card) => card.id === "wet-documents",
  ).effects = [{kind: "lose_level", amount: 1, target: "player"}];
  assert.throws(
    () => validatePack(withDigest(irrelevantField)),
    /unknown field target/,
  );

  const curseAbility = structuredClone(demo);
  curseAbility.cards.find((card) => card.id === "wet-documents").abilities = [{
    kind: "discard_for_combat",
    amount: 1,
    discard_count: 1,
  }];
  assert.throws(
    () => validatePack(withDigest(curseAbility)),
    /abilities is not allowed for kind curse/,
  );

  const missingCurseEffects = structuredClone(demo);
  delete missingCurseEffects.cards.find(
    (card) => card.id === "wet-documents",
  ).effects;
  assert.throws(
    () => validatePack(withDigest(missingCurseEffects)),
    /effects is required/,
  );

  const invalidBadStuff = structuredClone(demo);
  invalidBadStuff.cards.find(
    (card) => card.id === "courtyard-pigeon",
  ).monster.bad_stuff = [{
    kind: "modify_escape",
    amount: -1,
  }];
  assert.throws(
    () => validatePack(withDigest(invalidBadStuff)),
    /bad_stuff has unsupported effect/,
  );

  const winningLevelUp = structuredClone(demo);
  winningLevelUp.cards.find(
    (card) => card.id === "late-train-lesson",
  ).effects[0].can_win = true;
  assert.throws(
    () => validatePack(withDigest(winningLevelUp)),
    /one non-winning gain_level effect/,
  );
});

test("canonical source defaults, nulls and Unicode hazards are rejected", () => {
  for (const mutate of [
    (pack) => {
      pack.cards[0].abilities = [];
    },
    (pack) => {
      pack.cards[0].flavor_text = null;
    },
    (pack) => {
      pack.cards[0].rules_text = "   ";
    },
    (pack) => {
      pack.cards[0].flavor_text = "\t";
    },
    (pack) => {
      pack.cards[0].rules_text = "\u0085";
    },
    (pack) => {
      pack.cards[0].flavor_text = "\uFEFF";
    },
    (pack) => {
      pack.cards[0].name = "\uFFFD";
    },
    (pack) => {
      pack.cards[0].name = "\uD800";
    },
  ]) {
    const changed = structuredClone(demo);
    mutate(changed);
    assert.throws(() => validatePack(withDigest(changed)));
  }
});

test("duplicate tags and unsafe restricted allowances are rejected", () => {
  const duplicateTag = structuredClone(demo);
  duplicateTag.cards.find(
    (card) => card.id === "swift-courier",
  ).trait.tags.push("courier");
  assert.throws(
    () => validatePack(withDigest(duplicateTag)),
    /must not contain duplicates/,
  );

  const restrictedAllowance = structuredClone(demo);
  restrictedAllowance.cards.find(
    (card) => card.id === "two-handed-sign",
  ).item.big_allowance = 1;
  assert.throws(
    () => validatePack(withDigest(restrictedAllowance)),
    /big_allowance is not allowed with restrictions/,
  );
});

test("canonical digest matches Go for HTML and Unicode separator edges", () => {
  const text = "A & B < C > D\u2028E\u2029F";
  const card = {
    id: "digest-edge",
    name: text,
    deck: "door",
    kind: "curse",
    copies: 1,
    interaction_scope: "self",
    effects: [{kind: "lose_level", amount: 1}],
    rules_text: text,
  };
  assert.equal(
    cardsDigest([card]),
    "sha256:c4b62b7a740da357057fdeda83caed6814d605ef99cf7c575074ba70b24a1b10",
  );
});

function schemaAccepts(pack) {
  const script = [
    "$encoded = [Console]::In.ReadToEnd()",
    "$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))",
    "$valid = $json | Test-Json -SchemaFile $env:MUNCHKIN_SCHEMA_PATH -ErrorAction SilentlyContinue",
    "if ($valid) { exit 0 }",
    "exit 1",
  ].join("\n");
  const result = spawnSync(
    "pwsh",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        MUNCHKIN_SCHEMA_PATH: schemaPath,
      },
      input: Buffer.from(JSON.stringify(pack), "utf8").toString("base64"),
    },
  );
  return result.status === 0;
}

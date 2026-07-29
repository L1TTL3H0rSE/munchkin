import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {cardsDigest, validatePack} from "./validate.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "schema", "card-set.schema.json");
const demo = JSON.parse(
  fs.readFileSync(path.join(root, "sets", "demo", "cards.json"), "utf8"),
);
const powershellProbe = spawnSync(
  "pwsh",
  ["-NoProfile", "-NonInteractive", "-Command", "exit 0"],
);

function withDigest(pack) {
  pack.content_digest = cardsDigest(pack.cards);
  return pack;
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

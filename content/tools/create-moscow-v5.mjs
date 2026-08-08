import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {cardsDigest} from "./validate.mjs";

const contentRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(contentRoot, "sets", "moscow", "v4");
const targetRoot = path.join(contentRoot, "sets", "moscow", "v5");

const sourcePack = JSON.parse(fs.readFileSync(path.join(sourceRoot, "cards.json"), "utf8"));
const sourceProvenance = JSON.parse(
  fs.readFileSync(path.join(sourceRoot, "provenance.json"), "utf8"),
);

const tagNames = new Map([
  ["confused", "растерянный"],
  ["digital", "цифровой"],
  ["local", "местный"],
  ["offline", "офлайн"],
]);

function plural(count, one, few, many) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function effectText(effect) {
  switch (effect.kind) {
    case "death":
      return "Ты умираешь.";
    case "lose_level":
      return `Потеряй ${effect.amount} ${plural(effect.amount, "уровень", "уровня", "уровней")}.`;
    case "discard": {
      const count = effect.count;
      switch (effect.selector) {
        case "hand":
          return `Сбрось ${count} ${plural(count, "карту", "карты", "карт")} с руки.`;
        case "equipment":
          return `Сбрось ${count} ${plural(count, "предмет экипировки", "предмета экипировки", "предметов экипировки")}.`;
        case "trait":
          return `Сбрось ${count} ${plural(count, "карту черты", "карты черты", "карт черт")}.`;
        case "owned_card":
          return `Сбрось ${count} ${plural(count, "свою карту", "свои карты", "своих карт")}.`;
        default:
          throw new Error(`unsupported discard selector ${effect.selector}`);
      }
    }
    case "change_character_tag": {
      const next = tagNames.get(effect.tag) ?? effect.tag;
      if (!effect.replace_tag) return `Получи метку «${next}».`;
      const previous = tagNames.get(effect.replace_tag) ?? effect.replace_tag;
      return `Замени метку «${previous}» на «${next}».`;
    }
    default:
      throw new Error(`unsupported bad stuff effect ${effect.kind}`);
  }
}

function combatRules(rulesText) {
  const stripped = rulesText
    .replace(/\s+Если не сбежишь,.*$/u, "")
    .replace(/\s+Иначе при неудачном побеге.*$/u, "")
    .replace(/\s+При неудачном побеге.*$/u, "")
    .replace(/\s+Если соперник проиграет бой,.*$/u, "")
    .trim();
  return stripped;
}

const cards = sourcePack.cards.map((sourceCard) => {
  const card = structuredClone(sourceCard);
  if (!card.monster) return card;
  card.monster.bad_stuff_text = card.monster.bad_stuff.map(effectText).join(" ");
  const rules = combatRules(card.rules_text ?? "");
  if (rules) card.rules_text = rules;
  else delete card.rules_text;
  return card;
});

const targetPack = {
  ...sourcePack,
  version: 5,
  source: "original-moscow-core-figma-presentation-2026",
  cards,
  content_digest: cardsDigest(cards),
};
const targetProvenance = {
  ...sourceProvenance,
  version: 5,
  source_version: 4,
  source_digest: sourcePack.content_digest,
  content_digest: targetPack.content_digest,
};

fs.mkdirSync(path.join(targetRoot, "assets"), {recursive: true});
fs.writeFileSync(
  path.join(targetRoot, "cards.json"),
  `${JSON.stringify(targetPack, null, 2)}\n`,
  "utf8",
);
fs.writeFileSync(
  path.join(targetRoot, "provenance.json"),
  `${JSON.stringify(targetProvenance, null, 2)}\n`,
  "utf8",
);
for (const record of targetProvenance.records) {
  const source = path.join(sourceRoot, record.asset_path);
  const target = path.join(targetRoot, record.asset_path);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
}

console.log(`${targetPack.set_id}@${targetPack.version} ${targetPack.content_digest}`);

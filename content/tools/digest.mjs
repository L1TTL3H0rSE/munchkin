import fs from "node:fs";
import path from "node:path";
import {cardsDigest} from "./validate.mjs";

const [filePath, option] = process.argv.slice(2);

if (!filePath || (option !== undefined && option !== "--write")) {
  console.error("usage: node content/tools/digest.mjs <pack.json> [--write]");
  process.exit(2);
}

try {
  const absolute = path.resolve(filePath);
  const raw = fs.readFileSync(absolute, "utf8");
  if (raw.includes("\uFFFD")) {
    throw new Error("content contains U+FFFD");
  }

  const pack = JSON.parse(raw);
  if (!Array.isArray(pack.cards)) {
    throw new Error("cards must be an array");
  }

  const digest = cardsDigest(pack.cards);
  if (option === "--write") {
    pack.content_digest = digest;
    fs.writeFileSync(absolute, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
  }
  console.log(digest);
} catch (error) {
  console.error(`content digest failed: ${error.message}`);
  process.exit(1);
}

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { cardsDigest } from "./validate.mjs";

const filePath = process.argv[2];
const write = process.argv.includes("--write");

if (!filePath) {
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
    throw new Error("pack.cards must be an array");
  }
  const digest = cardsDigest(pack.cards);
  if (write) {
    pack.content_digest = digest;
    fs.writeFileSync(absolute, `${JSON.stringify(pack, null, 2)}\n`, "utf8");
    console.log(`updated ${filePath}: ${digest}`);
  } else {
    console.log(digest);
  }
} catch (error) {
  console.error(`digest failed: ${error.message}`);
  process.exit(1);
}

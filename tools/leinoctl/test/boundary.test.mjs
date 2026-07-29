import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(packageRoot, "src");

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : [absolute];
  });
}

test("generic package source imports stay inside its package boundary", () => {
  for (const filePath of sourceFiles(sourceDirectory)) {
    const text = fs.readFileSync(filePath, "utf8");
    assert.doesNotMatch(text, /digiversity/i, path.relative(packageRoot, filePath));
    for (const match of text.matchAll(/from\s+["']([^"']+)["']/g)) {
      const specifier = match[1];
      if (specifier.startsWith("node:")) {
        continue;
      }
      assert.ok(specifier.startsWith("."), `${filePath}: external import ${specifier}`);
      const resolved = path.resolve(path.dirname(filePath), specifier);
      assert.ok(
        resolved === packageRoot || resolved.startsWith(`${packageRoot}${path.sep}`),
        `${filePath}: import escapes package: ${specifier}`,
      );
    }
  }
});

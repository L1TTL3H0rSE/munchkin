import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import ts from "typescript";
import {storyNameFromExport, toId} from "storybook/internal/csf";
import {assertScreenCoverage, screenCoverage} from "../test/storyCoverage.ts";

export function sourceStoryIDs(directory) {
  const ids = new Set();
  const files = fs.readdirSync(directory, {recursive: true}).filter((file) => file.endsWith(".stories.ts"));
  if (files.length === 0) {
    throw new Error("Story source catalog is empty");
  }
  for (const file of files) {
    const source = fs.readFileSync(path.join(directory, file), "utf8");
    const title = source.match(/title:\s*["']([^"']+)["']/)?.[1];
    if (!title) {
      throw new Error(`Missing static story title: ${file}`);
    }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const statement of ast.statements) {
      if (!ts.isVariableStatement(statement) ||
        !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        const id = toId(title, storyNameFromExport(declaration.name.getText(ast)));
        if (ids.has(id)) {
          throw new Error(`Duplicate story ID: ${id}`);
        }
        ids.add(id);
      }
    }
  }
  return ids;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const directory = fileURLToPath(new URL("../", import.meta.url));
  const catalog = JSON.parse(fs.readFileSync(path.join(directory, "storybook-static/index.json"), "utf8"));
  const ids = new Set(Object.values(catalog.entries).filter((entry) => entry.type === "story").map((entry) => entry.id));
  assertScreenCoverage(screenCoverage, sourceStoryIDs(path.join(directory, "src/screens")));
  assertScreenCoverage(screenCoverage, ids);
  console.log(`Story coverage: ${screenCoverage.length} required states, ${ids.size} built stories, both viewports`);
}

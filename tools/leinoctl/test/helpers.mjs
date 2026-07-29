import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function temporaryDirectory(prefix = "leinoctl-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function writeFile(root, relative, content) {
  const filePath = path.join(root, ...relative.split("/"));
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

export function writeJson(root, relative, value) {
  return writeFile(root, relative, `${JSON.stringify(value, null, 2)}\n`);
}

export function fixtureProfile(overrides = {}) {
  return {
    schemaVersion: 1,
    repositoryId: "fixture",
    componentsDir: ".leino/components",
    generatorsFile: ".leino/generators.json",
    runtimeDir: ".leino/runtime",
    plans: {
      activeDir: ".plans/active",
      archiveDir: ".plans/archive"
    },
    composeFiles: [],
    sync: {
      jobs: 4
    },
    verification: {
      nodeScripts: ["test", "typecheck", "build"]
    },
    ...overrides,
  };
}

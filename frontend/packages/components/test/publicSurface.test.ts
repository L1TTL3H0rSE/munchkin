import fs from "node:fs";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {assertProductionModules, checkProductGraph, productEntries} from "../scripts/check-public-surface.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const entries = productEntries(root);

describe("production dependency boundary", () => {
  it("traverses real public entries and application modules without test data", () => {
    expect(checkProductGraph(entries, root).length).toBeGreaterThan(entries.length);
  });
  it.each([
    ["packages/components/src/index.ts", 'export * from "../test/fixtures/fixtureAdapter";'],
    ["applications/web/app/pages/index.vue", '<script setup>import "../../../../packages/components/test/fixtures/fixtureData";</script>'],
    ["packages/components/src/screens/index.ts", 'import "../screens/lobby/LobbyScreen.stories";'],
  ])("rejects a forbidden reachable import through %s", (suffix, injected) => {
    expect(() => checkProductGraph(entries, root, (file: string) =>
      file.replaceAll("\\", "/").endsWith(suffix) ? injected : fs.readFileSync(file, "utf8"),
    )).toThrow(/reachable/);
  });
  it("rejects empty graphs and built story modules", () => {
    expect(() => checkProductGraph([], root)).toThrow("empty");
    expect(() => assertProductionModules(["/src/Table.stories.ts?vue&type=script"]))
      .toThrow("reachable");
  });
});

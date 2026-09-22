import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {sourceStoryIDs} from "../scripts/check-story-coverage.mjs";
import {assertScreenCoverage, screenCoverage} from "./storyCoverage";

describe("required screen coverage", () => {
  const directory = fileURLToPath(new URL("../src/screens", import.meta.url));
  it("maps every existing Figma and lobby state to real wide and compact stories", () => {
    expect(() => assertScreenCoverage(screenCoverage, sourceStoryIDs(directory))).not.toThrow();
  });
  it("fails when a required state or story disappears", () => {
    const ids = sourceStoryIDs(directory);
    expect(() => assertScreenCoverage(screenCoverage.slice(1), ids)).toThrow("Required state missing");
    ids.delete("screens-table--active-turn");
    expect(() => assertScreenCoverage(screenCoverage, ids)).toThrow("Required story missing");
  });
  it("rejects empty catalogs and empty matrices", () => {
    expect(() => assertScreenCoverage([], new Set())).toThrow("empty");
    expect(() => assertScreenCoverage(screenCoverage, new Set())).toThrow("empty");
  });
});

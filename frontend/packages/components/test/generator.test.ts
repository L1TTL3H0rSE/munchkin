import {describe, expect, it} from "vitest";
import {componentIndex} from "../scripts/generate-components.mjs";

describe("component exports", () => {
  it("sorts deterministically and emits the actual file paths", () => {
    expect(componentIndex(["ui/SheetDialog.vue", "game/GameTable.vue"]))
      .toBe(componentIndex(["game/GameTable.vue", "ui/SheetDialog.vue"]));
    expect(componentIndex(["ui/SheetDialog.vue"]))
      .toContain('export {default as SheetDialog} from "./ui/SheetDialog.vue"');
  });
  it("rejects empty inputs, invalid names and case collisions", () => {
    expect(() => componentIndex([])).toThrow("empty");
    expect(() => componentIndex(["bad-name.vue"])).toThrow("Invalid");
    expect(() => componentIndex(["a/Item.vue", "b/ITEM.vue"])).toThrow("colliding");
  });
});

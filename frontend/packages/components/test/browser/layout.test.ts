import {describe, expect, it} from "vitest";
import {
  box,
  expectNoDocumentVerticalOverflow,
  expectNoIntersections,
  expectNoRootOverflow,
  renderFixture,
  visible,
  wide,
} from "./screen";

describe("desktop table layout", () => {
  it("1440x900 keeps the exact desktop region grid", async () => {
    const table = await renderFixture("full-roster-combat", wide);

    expect(table.dataset.figmaDesktopNode).toBe("248:5");
    expect(box(visible(".desktop-game-header", table))).toMatchObject({x: 16, y: 16, width: 1408, height: 56});
    const regions = [".game-table__opponents", ".game-table__stage", ".game-table__hand", ".game-table__sidebar"]
      .map((selector) => visible(selector, table));
    expect(regions.map(box)).toMatchObject([
      {x: 16, y: 88, width: 248, height: 796},
      {x: 280, y: 88, width: 768, height: 502},
      {x: 280, y: 606, width: 768, height: 278},
      {x: 1064, y: 88, width: 360, height: 796},
    ]);
    expectNoIntersections(regions);
    const stage = box(regions[1]!);
    const selected = box(visible(".game-table__selected-encounter", table));
    expect(Math.abs((selected.x + selected.width / 2) - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1);
    expectNoRootOverflow();
    expectNoDocumentVerticalOverflow();
  });
});

import {expect, test, type Locator} from "@playwright/test";

import {
  assertNoDocumentVerticalOverflow,
  assertNoRootOverflow,
  activePresenter,
  openFixtureAtViewport,
} from "./fixtureSupport.ts";
import {figmaDesktopStateNames, figmaStateDescriptors} from "./figmaStateMatrix.ts";

async function expectBox(locator: Locator, expected: {x: number; y: number; width: number; height: number}) {
  await expect(locator).toBeVisible();
  expect(await locator.boundingBox()).toMatchObject(expected);
}

test("the closed desktop catalog keeps all 40 named Figma compositions", () => {
  expect(figmaDesktopStateNames).toHaveLength(40);
  expect(new Set(figmaStateDescriptors.map((state) => state.nodeId)).size).toBe(40);
});

test("1440x900 matches the five desktop Figma regions", async ({page}) => {
  await openFixtureAtViewport(page, "full-roster-combat", 1440, 900);
  const presenter = await activePresenter(page, "desktop");

  await expect(presenter).toHaveAttribute("data-figma-node", "248:5");
  await expectBox(presenter.locator(".desktop-game-header"), {x: 16, y: 16, width: 1408, height: 56});
  await expectBox(presenter.locator("[data-figma-region='desktop-opponents']"), {x: 16, y: 88, width: 248, height: 796});
  await expectBox(presenter.locator(".desktop-encounter-stage"), {x: 280, y: 88, width: 768, height: 502});
  await expectBox(presenter.locator(".desktop-hand-tray"), {x: 280, y: 606, width: 768, height: 278});
  await expectBox(presenter.locator("[data-figma-region='desktop-player-panel']").locator("..").first(), {x: 1064, y: 88, width: 360, height: 796});
  await expectBox(presenter.locator(".desktop-encounter-card--active .encounter-card-presentation"), {x: 545, y: 172, width: 240, height: 400});
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
});

for (const viewport of [
  {width: 1024, height: 768},
  {width: 1280, height: 720},
  {width: 1280, height: 800},
  {width: 1366, height: 768},
] as const) {
  test(`${viewport.width}x${viewport.height} keeps the same desktop inventory without overlap`, async ({page}) => {
    await openFixtureAtViewport(page, "full-roster-combat", viewport.width, viewport.height);
    const presenter = await activePresenter(page, "desktop");
    const regions = [
      presenter.locator("[data-figma-region='desktop-opponents']"),
      presenter.locator(".desktop-encounter-stage"),
      presenter.locator(".desktop-hand-tray"),
      presenter.locator("[data-figma-region='desktop-player-panel']"),
    ];
    for (const region of regions) {
      await expect(region).toBeVisible();
      const box = await region.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await assertNoRootOverflow(page);
  });
}

test("360x640 matches compact header, opponents, card rail, dock and safe bottom", async ({page}) => {
  await openFixtureAtViewport(page, "full-roster-combat", 360, 640);
  const presenter = await activePresenter(page, "mobile");

  await expect(presenter).toHaveAttribute("data-figma-node", "147:731");
  await expectBox(presenter.locator(".mobile-game-header"), {x: 14, y: 12, width: 332, height: 32});
  await expectBox(presenter.locator("[data-figma-region='mobile-opponents']"), {x: 14, y: 52, width: 332, height: 38});
  await expectBox(presenter.locator(".mobile-game-table__stage"), {x: 0, y: 98, width: 360, height: 416});
  await expectBox(presenter.locator(".mobile-game-table__dock"), {x: 16, y: 554, width: 328, height: 62});
  await expect(presenter.locator(".mobile-opponent-chip")).toHaveCount(3);
  await expect(presenter.locator(".mobile-encounter-card")).toHaveCount(3);
  await expect(presenter.locator(".mobile-encounter-card--selected")).toHaveCount(1);
  const dock = await presenter.locator(".mobile-game-table__dock").boundingBox();
  expect(640 - (dock!.y + dock!.height)).toBe(24);
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
});

for (const [fixtureID, count] of [
  ["opponents-one", 1],
  ["mobile-combat-multiple", 2],
  ["opponents-three", 3],
] as const) {
  test(`compact opponent row uses the approved Count=${count} variant`, async ({page}) => {
    await openFixtureAtViewport(page, fixtureID, 360, 640);
    const chips = page.locator(".mobile-opponent-chip");
    await expect(chips).toHaveCount(count);
    for (let index = 0; index < count; index += 1) {
      expect((await chips.nth(index).boundingBox())?.height).toBe(38);
    }
  });
}

test("mandatory door decision owns the only open dialog", async ({page}) => {
  await openFixtureAtViewport(page, "single-door-choice", 360, 640);
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute("data-figma-node", "181:1634");
  await expect(dialog.locator(".deck-back")).toBeVisible();
  await expect(dialog.locator(".sheet-dialog__close")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(1);
});

test("optional character sheet is labelled and restores focus", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 1440, 900);
  const opener = page.getByRole("button", {name: "Персонаж", exact: true});
  await opener.click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute("data-figma-node", "271:791");
  await expect(dialog).toHaveAttribute("aria-labelledby", "character-info-title");
  await expect(dialog.locator("[data-dialog-autofocus]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("forbidden legacy labels do not exist in the rendered desktop or compact trees", async ({page}) => {
  for (const viewport of [{width: 1440, height: 900}, {width: 360, height: 640}]) {
    await openFixtureAtViewport(page, "full-roster-combat", viewport.width, viewport.height);
    await expect(page.locator("body")).not.toContainText(/ПУБЛИЧНЫЕ ЗОНЫ|ТВОЯ ЗОНА|ВЕРСИЯ|Детали комнаты/);
    await expect(page.getByRole("button", {name: "Зоны", exact: true})).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
});

for (const viewport of [{width: 360, height: 640}, {width: 1440, height: 900}]) {
  test(`long encounter copy is clamped at ${viewport.width}px`, async ({page}) => {
    await openFixtureAtViewport(page, "single-combat", viewport.width, viewport.height);
    const presenter = await activePresenter(page, viewport.width === 360 ? "mobile" : "desktop");
    const rules = presenter.locator(".encounter-card-presentation__rules").first();
    await expect(rules).toBeVisible();
    const metrics = await rules.evaluate((element) => ({clientHeight: element.clientHeight, scrollHeight: element.scrollHeight, overflow: getComputedStyle(element).overflow}));
    expect(metrics.clientHeight).toBeLessThan(metrics.scrollHeight);
    expect(metrics.overflow).toBe("hidden");
  });
}

import {expect, test, type Locator, type Page} from "@playwright/test";

import {
  assertNoDocumentVerticalOverflow,
  assertNoRootOverflow,
  activePresenter,
  openFixtureAtViewport,
} from "./fixtureSupport.ts";
import {figmaDesktopStateNames, figmaStateDescriptors} from "./figmaStateMatrix.ts";

type Box = {x: number; y: number; width: number; height: number};

async function expectBox(locator: Locator, expected: Box) {
  await expect(locator).toBeVisible();
  expect(await locator.boundingBox()).toMatchObject(expected);
}

function intersects(left: Box, right: Box): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x &&
    left.y < right.y + right.height && left.y + left.height > right.y;
}

async function visibleBox(locator: Locator): Promise<Box> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function expectNoIntersections(locators: Locator[]): Promise<void> {
  const boxes = await Promise.all(locators.map(visibleBox));
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      expect(intersects(boxes[left]!, boxes[right]!)).toBe(false);
    }
  }
}

async function expectHorizontalContainment(page: Page, locator: Locator): Promise<void> {
  const viewport = page.viewportSize();
  const box = await visibleBox(locator);
  expect(box.x).toBeGreaterThanOrEqual(-0.5);
  expect(box.x + box.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 0.5);
}

test("the closed runtime catalog keeps all 43 named Figma compositions and data modes", () => {
  expect(figmaDesktopStateNames).toHaveLength(43);
  expect(new Set(figmaStateDescriptors.map((state) => state.name)).size).toBe(43);
});

test("1440x900 keeps the exact desktop region grid", async ({page}) => {
  await openFixtureAtViewport(page, "full-roster-combat", 1440, 900);
  const presenter = await activePresenter(page, "desktop");

  await expect(presenter).toHaveAttribute("data-figma-desktop-node", "248:5");
  await expectBox(presenter.locator(".desktop-game-header"), {x: 16, y: 16, width: 1408, height: 56});
  await expectBox(presenter.locator(".game-table__opponents"), {x: 16, y: 88, width: 248, height: 796});
  await expectBox(presenter.locator(".game-table__stage"), {x: 280, y: 88, width: 768, height: 502});
  await expectBox(presenter.locator(".game-table__hand"), {x: 280, y: 606, width: 768, height: 278});
  await expectBox(presenter.locator(".game-table__sidebar"), {x: 1064, y: 88, width: 360, height: 796});
  await expectNoIntersections([
    presenter.locator(".game-table__opponents"),
    presenter.locator(".game-table__stage"),
    presenter.locator(".game-table__hand"),
    presenter.locator(".game-table__sidebar"),
  ]);
  const stage = await visibleBox(presenter.locator(".game-table__stage"));
  const selected = await visibleBox(presenter.locator(".game-table__selected-encounter"));
  expect(Math.abs((selected.x + selected.width / 2) - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1);
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
});

const responsiveViewports = [
  {width: 360, height: 640},
  {width: 394, height: 800},
  {width: 428, height: 926},
  {width: 514, height: 900},
  {width: 599, height: 900},
  {width: 600, height: 900},
  {width: 601, height: 900},
  {width: 667, height: 375},
  {width: 684, height: 900},
  {width: 768, height: 1024},
  {width: 896, height: 900},
  {width: 1023, height: 768},
  {width: 1024, height: 768},
  {width: 1025, height: 768},
  {width: 1152, height: 800},
  {width: 1280, height: 720},
  {width: 1340, height: 800},
  {width: 1400, height: 900},
  {width: 1660, height: 1000},
  {width: 1920, height: 1080},
] as const;

const exactBoundaryWidths = [
  373, 374, 375,
  426, 427, 428,
  598, 599, 600,
  766, 767, 768,
  1022, 1023, 1024,
  1278, 1279, 1280,
  1438, 1439, 1440,
  1899, 1900, 1901,
] as const;

for (const viewport of responsiveViewports) {
  test(`${viewport.width}x${viewport.height} stays playable without horizontal escape`, async ({page}) => {
    await openFixtureAtViewport(page, "full-roster-combat", viewport.width, viewport.height);
    const compact = viewport.width < 1024;
    const presenter = await activePresenter(page, compact ? "mobile" : "desktop");
    await assertNoRootOverflow(page);
    await expectHorizontalContainment(page, presenter);

    const primary = presenter.getByRole("button", {name: "Завершить бой", exact: true});
    await expect(primary).toBeVisible();
    await expect(primary).toBeEnabled();

    if (compact) {
      const header = presenter.locator(".mobile-game-header");
      const opponents = presenter.locator(".game-table__opponents");
      const stage = presenter.locator(".game-table__stage");
      const dock = presenter.locator(".mobile-game-table__dock");
      for (const region of [header, opponents, stage, dock]) {
        await expectHorizontalContainment(page, region);
      }
      await expectNoIntersections([header, opponents, stage, dock]);
      const strength = await visibleBox(header.locator(".mobile-game-header__strength"));
      expect(Math.abs((strength.x + strength.width / 2) - viewport.width / 2)).toBeLessThanOrEqual(1);
      const selected = await visibleBox(stage.locator(".game-table__selected-encounter"));
      expect(Math.abs((selected.x + selected.width / 2) - viewport.width / 2)).toBeLessThanOrEqual(1);
      const dockBox = await visibleBox(dock);
      expect(viewport.height - (dockBox.y + dockBox.height)).toBe(viewport.width < 600 ? 24 : 16);
      expect(await dock.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
    } else {
      const regions = [
        presenter.locator(".game-table__opponents"),
        presenter.locator(".game-table__stage"),
        presenter.locator(".game-table__hand"),
        presenter.locator(".game-table__sidebar"),
      ];
      for (const region of regions) await expectHorizontalContainment(page, region);
      await expectNoIntersections(regions);
    }
  });
}

for (const width of exactBoundaryWidths) {
  test(`${width}px boundary keeps dense, multi-action, and open-sheet states contained`, async ({page}) => {
    for (const fixtureID of ["full-roster-long-copy", "card-action-rail"] as const) {
      await openFixtureAtViewport(page, fixtureID, width, 900);
      await assertNoRootOverflow(page);
      await assertNoDocumentVerticalOverflow(page);
      await expectHorizontalContainment(page, await activePresenter(page, width < 1024 ? "mobile" : "desktop"));
    }

    await openFixtureAtViewport(page, "full-roster-combat", width, 900);
    const opener = width < 1024
      ? page.locator(".mobile-game-table__dock").getByRole("button", {name: "Персонаж", exact: true})
      : page.locator(".game-table__character");
    await opener.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toBeVisible();
    await expectHorizontalContainment(page, dialog);
    await assertNoRootOverflow(page);
  });
}

for (const viewport of [
  {width: 360, height: 640},
  {width: 428, height: 926},
  {width: 600, height: 900},
  {width: 768, height: 1024},
  {width: 1023, height: 768},
  {width: 1024, height: 768},
  {width: 1280, height: 720},
  {width: 1400, height: 900},
  {width: 1920, height: 1080},
] as const) {
  test(`next-monster choice stays selectable at ${viewport.width}x${viewport.height}`, async ({page}) => {
    await openFixtureAtViewport(
      page,
      "run-away-next-monster",
      viewport.width,
      viewport.height,
    );
    await assertNoRootOverflow(page);
    if (viewport.width < 1024) {
      const dialog = page.locator("dialog[data-figma-owner='game-modal:run-away-next'][open]");
      await expectHorizontalContainment(page, dialog);
      const confirm = dialog.getByRole("button", {name: "Подтвердить", exact: true});
      await expect(confirm).toBeDisabled();
      await dialog.getByRole("button", {name: /Сторожевой слизень/}).click();
      await expect(confirm).toBeEnabled();
      const dock = page.locator(".mobile-game-table__dock");
      await expect(dock).toBeVisible();
      expect(await dock.evaluate((element) => getComputedStyle(element).position)).toBe("fixed");
    } else {
      const surface = page.locator(".game-table__run-away-next");
      await expectHorizontalContainment(page, surface);
      const confirm = page.locator(".game-table__action-panel")
        .getByRole("button", {name: "Подтвердить", exact: true});
      await expect(confirm).toBeDisabled();
      await surface.getByRole("button", {name: /Костяной курьер/}).click();
      await expect(confirm).toBeEnabled();
      await expectNoIntersections([
        page.locator(".game-table__opponents"),
        page.locator(".game-table__stage"),
        page.locator(".game-table__sidebar"),
      ]);
    }
  });
}

test("360x640 keeps the canonical compact frame and bottom safe padding", async ({page}) => {
  await openFixtureAtViewport(page, "full-roster-combat", 360, 640);
  const presenter = await activePresenter(page, "mobile");
  await expect(presenter).toHaveAttribute("data-figma-compact-node", "147:731");
  await expectBox(presenter.locator(".mobile-game-header"), {x: 14, y: 12, width: 332, height: 32});
  await expectBox(presenter.locator(".game-table__opponents"), {x: 14, y: 52, width: 332, height: 38});
  await expectBox(presenter.locator(".game-table__stage"), {x: 14, y: 98, width: 332, height: 416});
  await expectBox(presenter.locator(".mobile-game-table__dock"), {x: 16, y: 554, width: 328, height: 62});
  await expect(presenter.locator(".opponent-tile")).toHaveCount(3);
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
});

for (const [fixtureID, count] of [
  ["opponents-one", 1],
  ["mobile-combat-multiple", 2],
  ["opponents-three", 3],
] as const) {
  test(`compact opponent row uses Count=${count} without clipping`, async ({page}) => {
    await openFixtureAtViewport(page, fixtureID, 428, 926);
    const chips = page.locator(".opponent-tile");
    await expect(chips).toHaveCount(count);
    await expectNoIntersections(await Promise.all(Array.from({length: count}, async (_, index) => chips.nth(index))));
  });
}

test("door choice exposes loot and the exact hand monster instead of open-door again", async ({page}) => {
  await openFixtureAtViewport(page, "single-door-choice", 360, 640);
  await expect(page.getByRole("button", {name: "Обчистить комнату", exact: true})).toBeVisible();
  await page.getByRole("button", {name: /Рука ·/}).click();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "181:1634");
  await expect(dialog).toContainText("Монстр из руки");
  await dialog.getByRole("option").filter({hasText: "Монстр из руки"}).click();
  await expect(dialog.getByRole("button", {name: "Искать неприятности", exact: true})).toBeVisible();
  await expect(page.getByRole("button", {name: "Открыть дверь", exact: true})).toHaveCount(0);
});

test("run-away actor gets the explicit server-roll action", async ({page}) => {
  await openFixtureAtViewport(page, "single-run-away", 360, 640);
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveCount(1);
  await expect(dialog.getByRole("button", {name: "Бросить кубик", exact: true})).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(1);
});

test("run-away sheet keeps its Figma width tokens across compact viewports", async ({page}) => {
  for (const viewport of [
    {width: 600, height: 900, expectedWidth: 560},
    {width: 360, height: 640, expectedWidth: 360},
  ]) {
    await openFixtureAtViewport(page, "single-run-away", viewport.width, viewport.height);
    const dialog = page.locator("dialog[open]");
    const box = await visibleBox(dialog);
    expect(box.width).toBe(viewport.expectedWidth);
  }
});

test("run-away is an inline Figma board on desktop and not a modal overlay", async ({page}) => {
  await openFixtureAtViewport(page, "single-run-away", 1440, 900);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const surface = page.locator(".game-table__run-away");
  await expect(surface).toHaveAttribute("data-figma-desktop-node", "285:1473");
  await expect(surface.getByText("Архивная пыль", {exact: true})).toBeVisible();
  await expect(page.locator(".game-table__action-panel")
    .getByRole("button", {name: "Бросить кубик", exact: true})).toBeVisible();
});

test("confirmed run-away results never remount the removed generic summary", async ({page}) => {
  for (const state of [
    {fixtureID: "run-away-success", desktopNode: "294:1998"},
    {fixtureID: "run-away-result", desktopNode: "294:1998"},
  ]) {
    await openFixtureAtViewport(page, state.fixtureID, 1440, 900);
    await expect(await activePresenter(page, "desktop"))
      .toHaveAttribute("data-figma-desktop-node", state.desktopNode);
    await expect(page.locator(".interaction-surface")).toHaveCount(0);
    await expect(page.locator(".run-away-summary")).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);

    await openFixtureAtViewport(page, state.fixtureID, 360, 640);
    await expect(await activePresenter(page, "mobile"))
      .toHaveAttribute("data-figma-compact-node", "unverified");
    await expect(page.locator(".interaction-surface")).toHaveCount(0);
    await expect(page.locator(".run-away-summary")).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
});

test("finished-game results control reveals the authoritative player table", async ({page}) => {
  await openFixtureAtViewport(page, "victory-six-player", 1440, 900);
  const panel = page.locator(".game-table__action-panel");
  const control = panel.locator("button.game-table__desktop-action");

  await expect(page.locator("#desktop-final-results")).toHaveCount(0);
  await expect(control).toHaveAccessibleName("Открыть итоги");
  await control.click();
  await expect(control).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#desktop-final-results")).toBeVisible();
  await expect(page.locator("#desktop-final-results li")).toHaveCount(4);
  await expect(page.locator("#desktop-final-results")).toContainText("Победитель");
  await expect(panel.getByRole("button", {name: "Скрыть итоги", exact: true})).toBeVisible();
});

test("character, opponent and strength sheets use their exact desktop and compact owners", async ({page}) => {
  for (const viewport of [{width: 360, height: 640}, {width: 1440, height: 900}]) {
    await openFixtureAtViewport(page, "full-roster-combat", viewport.width, viewport.height);
    const compact = viewport.width < 1024;

    const characterOpener = compact
      ? page.locator(".mobile-game-table__dock").getByRole("button", {name: "Персонаж", exact: true})
      : page.locator(".game-table__character");
    await characterOpener.click();
    let dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveAttribute(compact ? "data-figma-compact-node" : "data-figma-desktop-node", compact ? "165:42" : "267:708");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(characterOpener).toBeFocused();

    await page.locator(".opponent-tile").first().click();
    dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveAttribute(compact ? "data-figma-compact-node" : "data-figma-desktop-node", compact ? "166:42" : "271:3216");
    await expect(dialog).toContainText("Содержимое руки соперника скрыто");
    await page.keyboard.press("Escape");

    const strengthOpener = compact
      ? page.locator(".mobile-game-header__strength")
      : page.locator(".game-table__strength");
    await strengthOpener.click();
    dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveAttribute(compact ? "data-figma-compact-node" : "data-figma-desktop-node", compact ? "164:42" : "271:3010");
    await page.keyboard.press("Escape");
  }
});

test("setup hand has exactly eight cards and fast/exact equip use only current Figma sheets", async ({page}) => {
  await openFixtureAtViewport(page, "single-setup", 360, 640);
  await expect(page.getByRole("button", {name: "Рука · 8", exact: true})).toBeVisible();
  await expect(page.locator(".game-table__stage .choice-card-presentation")).toHaveCount(0);

  await page.getByRole("button", {name: "Рука · 8", exact: true}).click();
  let dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "181:1634");
  await dialog.getByRole("option").filter({hasText: "Учебный шлем"}).click();
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "342:3574");
  await expect(dialog.getByRole("button", {name: "Экипировать", exact: true})).toBeVisible();
  await expect(dialog.getByRole("button", {name: /Сыграть|Искать неприятности|Использовать способность|Сбросить/})).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.locator(".mobile-game-table__dock").getByRole("button", {name: "Персонаж", exact: true}).click();
  await page.getByRole("button", {name: /ГОЛОВНЯК/}).click();
  dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "340:3475");
  await expect(dialog).toContainText("Учебный шлем");
  await expect(dialog).not.toContainText("Учебная броня");
  await expect(dialog).not.toContainText("Класс следопыта");
  await expect(dialog.getByRole("button", {name: /Сыграть|Искать неприятности|Использовать способность/})).toHaveCount(0);
});

test("desktop fast and exact equip use the desktop flow archetype", async ({page}) => {
  await openFixtureAtViewport(page, "single-setup", 1440, 900);
  await page.getByRole("button", {name: "Открыть руку", exact: true}).click();
  let dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-desktop-node", "253:96");
  await dialog.getByRole("option").filter({hasText: "Учебный шлем"}).click();
  await expect(dialog).toHaveAttribute("data-figma-desktop-node", "291:1587");
  await expect(dialog.getByRole("button", {name: "Экипировать", exact: true})).toBeVisible();
  await page.keyboard.press("Escape");

  await page.locator(".game-table__character").click();
  await page.getByRole("button", {name: /ГОЛОВА/}).click();
  dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-desktop-node", "291:1587");
  await expect(dialog).toContainText("Головняк · пусто");
  await expect(dialog).not.toContainText("Учебная броня");
});

test("mandatory discard reuses charity sheet and has no recipient controls", async ({page}) => {
  await openFixtureAtViewport(page, "single-charity", 360, 640);
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "147:978");
  await expect(dialog).toContainText("Сброс карт");
  await expect(dialog).toContainText("Рука 7 / 5");
  await expect(dialog.locator(".charity-sheet__recipients")).toHaveCount(0);
  await expect(dialog.locator("input, select")).toHaveCount(0);
});

test("resolve-effect choice is a non-dismissible Figma-owned server action", async ({page}) => {
  await openFixtureAtViewport(page, "target-private-choice", 360, 640);
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-owner", "game-modal:mandatory-effect");
  await expect(dialog).toHaveAttribute("data-figma-desktop-node", "296:2748");
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "188:1777");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(1);
  await dialog.getByRole("option").first().click();
  await expect(dialog.getByRole("button", {name: "Подтвердить выбор", exact: true})).toBeEnabled();
});

test("death loot is inline on desktop, a compact sheet on mobile, and opaque to observers", async ({page}) => {
  await openFixtureAtViewport(page, "death-loot", 1440, 900);
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  const desktopSurface = page.locator(".game-table__death-loot");
  await expect(desktopSurface).toHaveAttribute("data-figma-desktop-node", "295:2355");
  await expect(desktopSurface.getByRole("option")).toHaveCount(3);
  await expect(page.locator(".game-table__action-panel").getByRole("button", {name: "Забрать карту", exact: true})).toBeVisible();

  await openFixtureAtViewport(page, "death-loot", 360, 640);
  const compactDialog = page.locator("dialog[open]");
  await expect(compactDialog).toHaveAttribute("data-figma-compact-node", "177:130");
  await expect(compactDialog.getByRole("heading", {name: "Добыча после смерти", exact: true})).toBeVisible();
  await expect(compactDialog.locator("time")).toHaveText(/\d{2}:\d{2}/);
  await expect(compactDialog.getByRole("button", {name: "Пас", exact: true})).toBeVisible();
  await expect(compactDialog.getByRole("button", {name: "Забрать выбранную карту", exact: true})).toBeDisabled();
  await expect(compactDialog.locator("input[type=checkbox]")).toHaveCount(0);

  await openFixtureAtViewport(page, "death-loot-observer", 1440, 900);
  await expect(page.locator(".game-table__death-loot, dialog[open]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Плащ обходчика");
});

test("forbidden legacy and machine copy is absent from desktop and compact trees", async ({page}) => {
  for (const viewport of [{width: 1440, height: 900}, {width: 360, height: 640}]) {
    await openFixtureAtViewport(page, "full-roster-combat", viewport.width, viewport.height);
    await expect(page.locator("body")).not.toContainText(/ПУБЛИЧНЫЕ ЗОНЫ|ТВОЯ ЗОНА|Текущая задача|Текущий контекст|Ждём следующую карту|\blocal\b|\bcourier\b/i);
    await expect(page.getByRole("button", {name: "Зоны", exact: true})).toHaveCount(0);
  }
});

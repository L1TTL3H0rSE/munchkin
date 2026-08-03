import {expect, test} from "@playwright/test";

import {
  assertNoRootOverflow,
  assertFocusBoundary,
  assertLabeledRails,
  assertNoDocumentVerticalOverflow,
  assertMediaPreferences,
  assertSkipLinkFocus,
  activePresenter,
  fixtureIDs,
  openFixture,
  openFixtureAtViewport,
} from "./fixtureSupport.ts";
import {figmaStateDescriptors} from "./figmaStateMatrix.ts";

const browserFixtureIDs = [
  ...new Set([
    ...fixtureIDs(),
    ...figmaStateDescriptors.map((state) => state.fixtureID),
  ]),
];

for (const fixtureID of browserFixtureIDs) {
  test(`fixture ${fixtureID} stays usable at representative width`, async ({page}) => {
    await openFixture(page, fixtureID);
    await assertNoRootOverflow(page);
    await assertLabeledRails(page);
    await expect(page.locator("main")).toHaveAttribute("id", "main-content");
    await expect(page.locator("button, a").first()).toBeVisible();
  });
}

test("keyboard users can reach the main landmark from the shell", async ({page}) => {
  await openFixture(page, "single-combat");
  await assertSkipLinkFocus(page);
  await assertFocusBoundary(page);
});

test("media preferences preserve motion and focus policy", async ({page}) => {
  await openFixture(page, "single-combat");
  await assertMediaPreferences(page);
});

test("finished projection uses the final result shell and closes stale actions", async ({page}) => {
  const fixture = await openFixtureAtViewport(page, "single-finished", 1440, 900);
  const presenter = await activePresenter(page);
  const surface = presenter.locator(".desktop-victory-result");

  await expect(surface).toBeVisible();
  await expect(surface).toContainText("ИТОГ ПОДТВЕРЖДЁН СЕРВЕРОМ");
  await expect(surface).toContainText(fixture.projection.you.name);
  await expect(presenter.locator("a[href='/']")).toContainText("Вернуться в лобби");
  await expect(page.locator(".action-dock")).toHaveCount(0);
  await expect(page.locator(".interaction-surface")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Состояние игры недоступно");
  await expect(page.locator("body")).not.toContainText("Waiting Status Hint");
});

test("observer waiting state stays contextual and keeps the confirmed table visible", async ({page}) => {
  await openFixtureAtViewport(page, "stale-projection", 1440, 900);

  const presenter = await activePresenter(page, "desktop");
  const waiting = presenter.locator(".desktop-game-table__waiting");
  await expect(waiting).toBeVisible();
  await expect(waiting).toContainText("Ожидаем подтверждённый ход другого игрока.");
  await expect(presenter.locator(".desktop-encounter-stage")).toBeVisible();
  await expect(presenter.locator(".action-dock")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Последнее состояние осталось на экране");
});

test("card action rail exposes labeled close and removes contextual state", async ({page}) => {
  const fixture = await openFixture(page, "card-action-rail");
  const presenter = await activePresenter(page);
  const handTab = presenter.locator(".hand-tab:visible");
  if (await handTab.count()) {
    await handTab.click();
    await expect(page.locator(".sheet-dialog[open]")).toBeVisible();
  } else {
    await presenter.locator(".own-board__open:visible").click();
    await expect(page.locator(".sheet-dialog[open]")).toBeVisible();
  }
  const openSheet = page.locator(".sheet-dialog[open]");
  const openSheetCount = await openSheet.count();
  const activate = openSheetCount
    ? openSheet.locator(".game-card__activate").first()
    : presenter.locator(".game-card__activate").first();
  await activate.click();
  await expect(presenter.locator(".action-dock__close")).toBeVisible();
  if (await openSheet.count()) {
    await openSheet.locator(".sheet-dialog__close").click();
    await expect(openSheet).toHaveCount(0);
  }
  await presenter.locator(".action-dock__close").click();
  await expect(presenter.locator(".action-dock__close")).toHaveCount(0);
  await expect(presenter.locator(".action-dock")).toHaveCount(0);
  expect(fixture.projection.turn.available_actions[0]?.type).toBe("play_card");
});

test("1440x900 uses one bounded desktop presenter without legacy telemetry", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 1440, 900);
  const presenter = await activePresenter(page, "desktop");

  await expect(presenter).toBeVisible();
  await expect(page.locator(".mobile-game-table")).toBeHidden();
  await expect(presenter.locator(".meta-badges")).toHaveCount(0);
  await expect(presenter.locator(".action-bar")).toHaveCount(0);
  await expect(presenter.locator(".own-board__card-count")).toHaveCount(0);
  await expect(presenter.locator(".desktop-encounter-stage .game-card")).toBeVisible();
  await expect(presenter.locator(".own-board__combat")).toBeVisible();
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
});

test("desktop density stays bounded at laptop and ultra-wide targets", async ({page}) => {
  await openFixtureAtViewport(page, "full-roster-long-copy", 1280, 720);
  await expect(await activePresenter(page, "desktop")).toBeVisible();
  await assertNoRootOverflow(page);

  await page.setViewportSize({width: 1920, height: 1080});
  await assertNoRootOverflow(page);
  const tableBox = await page.locator(".game-table").boundingBox();
  expect(tableBox?.width ?? 0).toBeLessThanOrEqual(1440);
  await assertNoDocumentVerticalOverflow(page);
});

test.describe("desktop input and zoom safety", () => {
  test.use({hasTouch: true});

  test("coarse pointer keeps the desktop rail keyboard-accessible at 200 percent zoom", async ({page}) => {
    await openFixtureAtViewport(page, "mobile-combat-multiple", 1440, 900);

    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBeTruthy();

    const presenter = await activePresenter(page, "desktop");
    const rail = presenter.locator(".card-rail__viewport").first();
    await expect(rail).toHaveAttribute("tabindex", "0");
    await rail.focus();
    await expect(rail).toBeFocused();
    await page.keyboard.press("End");

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await assertNoRootOverflow(page);

    const action = presenter.locator(".action-dock button:not([disabled])").first();
    await expect(action).toHaveCount(1);
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeVisible();
    expect((await action.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});

test("360x640 uses one mobile presenter without document scrolling", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 360, 640);
  await expect(await activePresenter(page, "mobile")).toBeVisible();
  const mobileTable = page.locator(".mobile-game-table:visible");
  const headerBox = await mobileTable.locator(".mobile-game-header").boundingBox();
  const stageBox = await mobileTable.locator(".mobile-game-table__stage").boundingBox();
  const dockBox = await mobileTable.locator(".mobile-game-table__dock").boundingBox();
  expect(headerBox).toMatchObject({x: 14, y: 12, width: 332, height: 32});
  expect(stageBox).toMatchObject({x: 0, y: 98, width: 360, height: 416});
  expect(dockBox).toMatchObject({x: 16, y: 554, width: 328, height: 62});
  await expect(mobileTable.locator(".action-choice__submit")).toBeVisible();
  await expect(page.locator(".game-table__desktop")).toBeHidden();
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
  await expect(page.locator(".mobile-game-header")).toContainText("Бой");
  await expect(page.locator(".mobile-encounter-stage .game-card")).toBeVisible();
});

test("mobile hand stays behind a safe-area-aware tab until card actions exist", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 360, 640);
  const mobilePresenter = await activePresenter(page, "mobile");
  await expect(mobilePresenter.locator(".hand-tab:visible")).toHaveCount(0);

  await openFixtureAtViewport(page, "card-action-rail", 360, 640);
  const actionPresenter = await activePresenter(page, "mobile");
  await expect(actionPresenter.locator(".hand-tab:visible")).toBeVisible();
  await expect(actionPresenter.locator(".hand-tab:visible")).toContainText("Рука · 3");
});

test("mobile breakpoints and safety viewports keep the action reachable", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 360, 640);

  const viewports = [
    {width: 360, height: 640, mobile: true, documentScroll: false},
    {width: 390, height: 844, mobile: true, documentScroll: false},
    {width: 427, height: 926, mobile: true, documentScroll: false},
    {width: 598, height: 720, mobile: true, documentScroll: false},
    {width: 599, height: 720, mobile: true, documentScroll: false},
    {width: 600, height: 720, mobile: false, documentScroll: true},
    {width: 766, height: 720, mobile: false, documentScroll: true},
    {width: 767, height: 720, mobile: false, documentScroll: true},
    {width: 768, height: 720, mobile: false, documentScroll: true},
    {width: 320, height: 568, mobile: true, documentScroll: true},
    {width: 667, height: 375, mobile: false, documentScroll: true},
    {width: 844, height: 390, mobile: false, documentScroll: true},
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({width: viewport.width, height: viewport.height});
    const presenter = await activePresenter(page, viewport.mobile ? "mobile" : "desktop");
    const hiddenPresenter = page.locator(
      viewport.mobile ? ".desktop-game-table" : ".mobile-game-table",
    );
    await expect(hiddenPresenter).toBeHidden();

    await assertNoRootOverflow(page);
    if (!viewport.documentScroll) {
      await assertNoDocumentVerticalOverflow(page);
    }

    const action = presenter.locator(".action-dock button:not([disabled])").first();
    await expect(action).toHaveCount(1);
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeVisible();
  }
});

test.describe("mobile input and zoom safety", () => {
  test.use({hasTouch: true});

  test("coarse pointer keeps the rail keyboard-accessible at 200 percent zoom", async ({page}) => {
    await openFixtureAtViewport(page, "mobile-combat-multiple", 360, 640);

    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBeTruthy();

    const rail = (await activePresenter(page, "mobile"))
      .locator(".mobile-encounter-stage .card-rail__viewport");
    await expect(rail).toHaveAttribute("tabindex", "0");
    await rail.focus();
    await expect(rail).toBeFocused();
    await page.keyboard.press("End");
    expect(await rail.evaluate((element) => element.scrollWidth)).toBeGreaterThan(
      await rail.evaluate((element) => element.clientWidth),
    );

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await assertNoRootOverflow(page);

    const action = page.locator(
      ".mobile-game-table:visible .action-dock button:not([disabled])",
    ).first();
    await expect(action).toHaveCount(1);
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeVisible();
  });
});

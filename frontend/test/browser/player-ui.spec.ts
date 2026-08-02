import {expect, test} from "@playwright/test";

import {
  assertNoRootOverflow,
  assertFocusBoundary,
  assertLabeledRails,
  assertNoDocumentVerticalOverflow,
  assertMediaPreferences,
  assertSkipLinkFocus,
  fixtureIDs,
  openFixture,
  openFixtureAtViewport,
} from "./fixtureSupport.ts";

for (const fixtureID of fixtureIDs()) {
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

test("card action rail exposes labeled close and removes contextual state", async ({page}) => {
  const fixture = await openFixture(page, "card-action-rail");
  const handTab = page.locator(".mobile-game-table .hand-tab");
  if (await handTab.isVisible()) {
    await handTab.click();
    await expect(page.locator(".sheet-dialog[open]")).toBeVisible();
  } else {
    await page.locator(".desktop-game-table .own-board__open").click();
    await expect(page.locator(".sheet-dialog[open]")).toBeVisible();
  }
  const presenter = (await page.locator(".mobile-game-table:visible").count())
    ? page.locator(".mobile-game-table")
    : page.locator(".desktop-game-table");
  const activate = presenter.locator(".game-card__activate").first();
  await activate.click();
  await expect(presenter.locator(".action-dock__close")).toBeVisible();
  await presenter.locator(".action-dock__close").click();
  await expect(presenter.locator(".action-dock__close")).toHaveCount(0);
  await expect(presenter.locator(".action-dock")).toHaveCount(0);
  expect(fixture.projection.turn.available_actions[0]?.type).toBe("play_card");
});

test("1440x900 uses one bounded desktop presenter without legacy telemetry", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 1440, 900);
  const presenter = page.locator(".desktop-game-table");

  await expect(presenter).toBeVisible();
  await expect(page.locator(".mobile-game-table")).toBeHidden();
  await expect(presenter.locator(".meta-badges")).toHaveCount(0);
  await expect(presenter.locator(".action-bar")).toHaveCount(0);
  await expect(presenter.locator(".own-board__card-count")).toHaveCount(0);
  await expect(presenter.locator(".desktop-encounter-stage .game-card")).toBeVisible();
  await expect(presenter.locator(".desktop-combat-summary")).toBeVisible();
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
});

test("desktop density stays bounded at laptop and ultra-wide targets", async ({page}) => {
  await openFixtureAtViewport(page, "full-roster-long-copy", 1280, 720);
  await expect(page.locator(".desktop-game-table")).toBeVisible();
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

    const presenter = page.locator(".desktop-game-table:visible");
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
  await expect(page.locator(".mobile-game-table")).toBeVisible();
  await expect(page.locator(".game-table__desktop")).toBeHidden();
  await assertNoRootOverflow(page);
  await assertNoDocumentVerticalOverflow(page);
  await expect(page.locator(".mobile-game-header")).toContainText("Бой");
  await expect(page.locator(".mobile-encounter-stage .game-card")).toBeVisible();
});

test("mobile hand stays behind a safe-area-aware tab until card actions exist", async ({page}) => {
  await openFixtureAtViewport(page, "single-combat", 360, 640);
  await expect(page.locator(".mobile-game-table .hand-tab")).toHaveCount(0);

  await openFixtureAtViewport(page, "card-action-rail", 360, 640);
  await expect(page.locator(".mobile-game-table .hand-tab")).toBeVisible();
  await expect(page.locator(".mobile-game-table .hand-tab")).toContainText("Рука · 3");
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
    const mobilePresenter = page.locator(".mobile-game-table");
    const desktopPresenter = page.locator(".desktop-game-table");

    if (viewport.mobile) {
      await expect(mobilePresenter).toBeVisible();
      await expect(desktopPresenter).toBeHidden();
    } else {
      await expect(mobilePresenter).toBeHidden();
      await expect(desktopPresenter).toBeVisible();
    }

    await assertNoRootOverflow(page);
    if (!viewport.documentScroll) {
      await assertNoDocumentVerticalOverflow(page);
    }

    const presenter = viewport.mobile ? mobilePresenter : desktopPresenter;
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

    const rail = page.locator(".mobile-game-table .mobile-encounter-stage .card-rail__viewport");
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

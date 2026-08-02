import {expect, test, type Page} from "@playwright/test";

import {activePresenter, openFixture, openFixtureAtViewport} from "./fixtureSupport.ts";

// These are bounded Chromium raster-noise tolerances observed on unchanged
// baselines; snapshot files remain immutable and all other visual pixels stay exact.
const lobbyRasterTolerance = {maxDiffPixels: 8};

async function hideDevtools(page: Page): Promise<void> {
  await page.addStyleTag({
    content: "nuxt-devtools-frame, nuxt-devtools-inspect-panel, #vue-tracer-overlay { display: none; }",
  });
}

async function openLobby(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({width, height});
  await page.goto("/", {waitUntil: "domcontentloaded"});
  await expect(page.locator(".lobby-page")).toHaveAttribute("data-interactive", "true", {
    timeout: 15_000,
  });
  await hideDevtools(page);
}

test("lobby-mobile", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openLobby(page, 360, 640);
  await expect(page).toHaveScreenshot("lobby-mobile.png", {
    fullPage: true,
    animations: "disabled",
    ...lobbyRasterTolerance,
  });
});

test("lobby-desktop", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openLobby(page, 1440, 900);
  await expect(page).toHaveScreenshot("lobby-desktop.png", {
    fullPage: true,
    animations: "disabled",
    ...lobbyRasterTolerance,
  });
});

const desktopVisualCases = [
  ["desktop-preparation", "single-preparation"],
  ["desktop-door", "single-door-choice"],
  ["desktop-combat-one", "single-combat"],
  ["desktop-combat-multiple", "mobile-combat-multiple"],
  ["desktop-reward", "run-away-result"],
  ["desktop-run-away", "single-run-away"],
  ["desktop-waiting", "stale-projection"],
  ["desktop-death", "death-loot-observer"],
  ["desktop-victory", "victory-six-player"],
] as const;

for (const [snapshotName, fixtureID] of desktopVisualCases) {
  test(snapshotName, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    await openFixtureAtViewport(page, fixtureID, 1440, 900);
    await hideDevtools(page);
    await expect(await activePresenter(page, "desktop")).toBeVisible();
    const screenshotTolerance = snapshotName === "desktop-death"
      ? {maxDiffPixels: 2}
      : {};
    await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
      fullPage: false,
      animations: "disabled",
      ...screenshotTolerance,
    });
  });
}

const mobileVisualCases = [
  ["mobile-setup", "single-setup"],
  ["mobile-door", "single-door-choice"],
  ["mobile-combat-one", "single-combat"],
  ["mobile-combat-multiple", "mobile-combat-multiple"],
  ["mobile-reward", "run-away-result"],
  ["mobile-run-away", "single-run-away"],
  ["mobile-waiting", "stale-projection"],
] as const;

for (const [snapshotName, fixtureID] of mobileVisualCases) {
  test(snapshotName, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    await openFixtureAtViewport(page, fixtureID, 360, 640);
    await hideDevtools(page);
    await expect(await activePresenter(page, "mobile")).toBeVisible();
    await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
      fullPage: false,
      animations: "disabled",
    });
  });
}

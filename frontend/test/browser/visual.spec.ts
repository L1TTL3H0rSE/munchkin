import {expect, test, type Page} from "@playwright/test";

import {figmaStateMatrix, type FigmaDesktopStateName} from "./figmaStateMatrix.ts";
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

const desktopVisualCases: readonly [
  snapshotName: string,
  stateName: FigmaDesktopStateName,
][] = [
  ["desktop-preparation", "Preparation"],
  ["desktop-door", "DoorReady"],
  ["desktop-combat-one", "ActiveTurn"],
  ["desktop-combat-multiple", "RunAwayNextMonster"],
  ["desktop-reward", "RewardReceived"],
  ["desktop-run-away", "RunAwayChoice"],
  ["desktop-waiting", "Waiting"],
  ["desktop-death", "DeathLoot"],
  ["desktop-victory", "Victory"],
];

for (const [snapshotName, stateName] of desktopVisualCases) {
  test(snapshotName, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    const state = figmaStateMatrix[stateName];
    await openFixtureAtViewport(page, state.fixtureID, 1440, 900);
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

const mobileVisualCases: readonly [
  snapshotName: string,
  stateName: FigmaDesktopStateName,
  fixtureID: string,
][] = [
  ["mobile-setup", "Preparation", "single-setup"],
  ["mobile-door", "DoorReady", figmaStateMatrix.DoorReady.fixtureID],
  ["mobile-combat-one", "PostDoorChoice", figmaStateMatrix.PostDoorChoice.fixtureID],
  ["mobile-combat-multiple", "RunAwayNextMonster", figmaStateMatrix.RunAwayNextMonster.fixtureID],
  ["mobile-reward", "RewardReceived", figmaStateMatrix.RewardReceived.fixtureID],
  ["mobile-run-away", "RunAwayChoice", figmaStateMatrix.RunAwayChoice.fixtureID],
  ["mobile-waiting", "Waiting", figmaStateMatrix.Waiting.fixtureID],
];

for (const [snapshotName, stateName, fixtureID] of mobileVisualCases) {
  test(snapshotName, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    void figmaStateMatrix[stateName];
    await openFixtureAtViewport(page, fixtureID, 360, 640);
    await hideDevtools(page);
    await expect(await activePresenter(page, "mobile")).toBeVisible();
    await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
      fullPage: false,
      animations: "disabled",
    });
  });
}

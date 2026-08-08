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
  ["desktop-curse-result", "CurseEffect"],
  ["desktop-help-offer", "HelpOffer"],
  ["desktop-help-incoming", "HelpIncoming"],
  ["desktop-help-accepted", "HelpAccepted"],
  ["desktop-run-away-pending", "RunAwayPending"],
  ["desktop-run-away-success", "RunAwaySuccess"],
  ["desktop-run-away-failure", "RunAwayFailure"],
  ["desktop-end-turn-ready", "EndTurnReady"],
  ["desktop-waiting", "Waiting"],
  ["desktop-death", "DeathLoot"],
  ["desktop-victory", "Victory"],
];

for (const [snapshotName, stateName] of desktopVisualCases) {
  test(snapshotName, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    const state = figmaStateMatrix[stateName];
    if (snapshotName === "desktop-death") {
      await page.clock.install({time: "2030-01-01T00:04:00.000Z"});
      await page.clock.setFixedTime("2030-01-01T00:04:00.000Z");
    } else if (snapshotName === "desktop-combat-multiple") {
      await page.clock.install({time: "2030-01-01T00:04:40.000Z"});
      await page.clock.setFixedTime("2030-01-01T00:04:40.000Z");
    }
    await openFixtureAtViewport(page, state.fixtureID, 1440, 900);
    await hideDevtools(page);
    await expect(await activePresenter(page, "desktop")).toBeVisible();
    const screenshotTolerance = snapshotName === "desktop-death"
      ? {maxDiffPixels: 16}
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
  ["mobile-combat-multiple", "ActiveTurn", figmaStateMatrix.ActiveTurn.fixtureID],
  ["mobile-reward", "RewardReceived", figmaStateMatrix.RewardReceived.fixtureID],
  ["mobile-run-away", "RunAwayChoice", "mobile-run-away-choice"],
  ["mobile-waiting", "Waiting", figmaStateMatrix.Waiting.fixtureID],
  ["mobile-death", "DeathLoot", figmaStateMatrix.DeathLoot.fixtureID],
];

for (const [snapshotName, stateName, fixtureID] of mobileVisualCases) {
  test(snapshotName, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    void figmaStateMatrix[stateName];
    await openFixtureAtViewport(page, fixtureID, 360, 640);
    await hideDevtools(page);
    await expect(await activePresenter(page, "mobile")).toBeVisible();
    const screenshotTolerance = snapshotName === "mobile-run-away"
      ? {maxDiffPixels: 12}
      : {};
    await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
      fullPage: false,
      animations: "disabled",
      ...screenshotTolerance,
    });
  });
}

for (const viewport of [
  {kind: "desktop", width: 1440, height: 900, node: "267:708"},
  {kind: "mobile", width: 360, height: 640, node: "165:42"},
] as const) {
  test(`${viewport.kind}-character`, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    await openFixtureAtViewport(page, "full-roster-combat", viewport.width, viewport.height);
    const opener = viewport.kind === "mobile"
      ? page.locator(".mobile-game-table__dock").getByRole("button", {name: "Персонаж", exact: true})
      : page.locator(".game-table__character");
    await opener.click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveAttribute(
      viewport.kind === "mobile" ? "data-figma-compact-node" : "data-figma-desktop-node",
      viewport.node,
    );
    await hideDevtools(page);
    await expect(page).toHaveScreenshot(`${viewport.kind}-character.png`, {
      fullPage: false,
      animations: "disabled",
    });
  });

  test(`${viewport.kind}-fast-equip`, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    await openFixtureAtViewport(page, "single-setup", viewport.width, viewport.height);
    const hand = viewport.kind === "mobile"
      ? page.getByRole("button", {name: "Рука · 8", exact: true})
      : page.getByRole("button", {name: "Открыть руку", exact: true});
    await hand.click();
    const dialog = page.locator("dialog[open]");
    await dialog.getByRole("option").filter({hasText: "Учебный шлем"}).click();
    await expect(dialog).toHaveAttribute(
      viewport.kind === "mobile" ? "data-figma-compact-node" : "data-figma-desktop-node",
      viewport.kind === "mobile" ? "342:3574" : "291:1587",
    );
    await hideDevtools(page);
    await expect(page).toHaveScreenshot(`${viewport.kind}-fast-equip.png`, {
      fullPage: false,
      animations: "disabled",
    });
  });

  test(`${viewport.kind}-exact-equip`, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    await openFixtureAtViewport(page, "single-setup", viewport.width, viewport.height);
    const character = viewport.kind === "mobile"
      ? page.locator(".mobile-game-table__dock").getByRole("button", {name: "Персонаж", exact: true})
      : page.locator(".game-table__character");
    await character.click();
    await page.getByRole("button", {name: /ГОЛОВА|ГОЛОВНЯК/}).click();
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveAttribute(
      viewport.kind === "mobile" ? "data-figma-compact-node" : "data-figma-desktop-node",
      viewport.kind === "mobile" ? "340:3475" : "291:1587",
    );
    await hideDevtools(page);
    await expect(page).toHaveScreenshot(`${viewport.kind}-exact-equip.png`, {
      fullPage: false,
      animations: "disabled",
    });
  });

  test(`${viewport.kind}-charity-discard`, async ({page}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
    await openFixtureAtViewport(page, "single-charity", viewport.width, viewport.height);
    const dialog = page.locator("dialog[open]");
    await expect(dialog).toHaveAttribute(
      viewport.kind === "mobile" ? "data-figma-compact-node" : "data-figma-desktop-node",
      viewport.kind === "mobile" ? "147:978" : "256:316",
    );
    await hideDevtools(page);
    await expect(page).toHaveScreenshot(`${viewport.kind}-charity-discard.png`, {
      fullPage: false,
      animations: "disabled",
    });
  });
}

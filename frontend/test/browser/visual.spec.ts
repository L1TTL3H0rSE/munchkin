import {expect, test, type Page} from "@playwright/test";

import {openFixture} from "./fixtureSupport.ts";

async function openLobby(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({width, height});
  await page.goto("/", {waitUntil: "domcontentloaded"});
  await expect(page.locator(".lobby-page")).toHaveAttribute("data-interactive", "true", {
    timeout: 15_000,
  });
  await page.addStyleTag({
    content: "nuxt-devtools-frame, nuxt-devtools-inspect-panel, #vue-tracer-overlay { display: none; }",
  });
}

test("lobby-mobile", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openLobby(page, 360, 640);
  await expect(page).toHaveScreenshot("lobby-mobile.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("lobby-desktop", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openLobby(page, 1440, 900);
  await expect(page).toHaveScreenshot("lobby-desktop.png", {
    fullPage: true,
    animations: "disabled",
  });
});

test("canonical chromium visual baseline stays stable", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  const fixture = await openFixture(page, "single-combat");
  const encounterName = fixture.projection.turn.encounter?.name;
  expect(encounterName).toBeDefined();
  await expect(page.locator(".encounter-area")).toBeVisible();
  await expect(
    page.locator(".encounter-area .game-card").filter({hasText: encounterName ?? ""}),
  ).toBeVisible();
  await expect(page.locator(".combat-score")).toBeVisible();
  await expect(page.locator(".own-board")).toBeVisible();
  await expect(page.locator(".hand-browser")).toBeVisible();
  await expect(page.locator(".action-bar")).toBeVisible();
  await expect(page.locator(".game-connection-status")).toHaveAttribute("data-state", "connected");
  const devtoolsFrame = page.locator("nuxt-devtools-frame");
  if (await devtoolsFrame.count()) {
    await devtoolsFrame.evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });
  }
  await expect(page).toHaveScreenshot("single-combat.png", {
    fullPage: true,
    animations: "disabled",
  });
});

import {expect, test} from "@playwright/test";

import {openFixture} from "./fixtureSupport.ts";

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

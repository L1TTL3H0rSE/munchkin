import {expect, test} from "@playwright/test";

import {
  assertNoRootOverflow,
  assertFocusBoundary,
  assertLabeledRails,
  assertMediaPreferences,
  assertSkipLinkFocus,
  fixtureIDs,
  openFixture,
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
  await openFixture(page, "card-action-rail");
  const activate = page.locator(".game-card__activate").first();
  await activate.click();
  await expect(page.locator(".action-dock__close")).toBeVisible();
  await page.locator(".action-dock__close").click();
  await expect(page.locator(".action-dock__close")).toHaveCount(0);
  await expect(page.locator(".action-dock")).toHaveAttribute("aria-labelledby", "action-dock-title");
});

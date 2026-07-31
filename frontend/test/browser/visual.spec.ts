import {expect, test} from "@playwright/test";

import {openFixture} from "./fixtureSupport.ts";

test("canonical chromium visual baseline stays stable", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openFixture(page, "single-combat");
  await expect(page).toHaveScreenshot("single-combat.png", {
    fullPage: true,
    animations: "disabled",
  });
});

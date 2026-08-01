import {expect, test} from "@playwright/test";

import {
  assertNoRootOverflow,
  openFixture,
} from "./fixtureSupport.ts";

test("advanced combat renders projected monsters, effects and capabilities", async ({page}) => {
  await openFixture(page, "advanced-combat");

  await expect(page.locator(".combat-monsters .game-card")).toHaveCount(2);
  await expect(page.locator(".combat-effects")).toBeVisible();
  await expect(page.locator(".combat-effect")).toHaveCount(1);
  await expect(page.locator(".interaction-action").filter({
    hasText: "Усилить монстра",
  })).toBeVisible();
  await expect(page.locator(".interaction-action").filter({
    hasText: "Гидра из справок",
  })).toBeVisible();
  await expect(page.locator(".interaction-action").filter({
    hasText: "Усиление монстра 1",
  })).toBeVisible();
  await expect(page.getByText("fx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {exact: true}))
    .toHaveCount(0);
  await assertNoRootOverflow(page);
});

test("forced helper remains mandatory and does not invent a reward", async ({page}) => {
  await openFixture(page, "advanced-forced-helper");

  const dialog = page.locator(".interaction-dialog");
  await expect(dialog.locator("#interaction-dialog-title"))
    .toHaveText("Ответ в бою");
  await expect(dialog.locator(".interaction-action").filter({
    hasText: "Борис",
  })).toBeVisible();
  await expect(dialog.getByText("Отклонить", {exact: true})).toHaveCount(0);
  await expect(dialog).not.toContainText("Наград");
  await expect(page.locator(".interaction-action")).toHaveCount(1);
  await assertNoRootOverflow(page);
});

test("observer sees public combat state but no private intervention descriptors", async ({page}) => {
  await openFixture(page, "advanced-observer");

  await expect(page.locator(".combat-monsters .game-card")).toHaveCount(2);
  await expect(page.locator(".interaction-dialog__opaque")).toBeVisible();
  await expect(page.locator(".interaction-actions")).toHaveCount(0);
  await expect(page.locator(".interaction-dialog")).not.toContainText("Вызов дополнительного монстра");
  await expect(page.locator(".interaction-dialog")).not.toContainText("Карта с длинным названием");
  await assertNoRootOverflow(page);
});

test("advanced combat has a canonical Chromium visual baseline", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openFixture(page, "advanced-combat");
  const devtoolsFrame = page.locator("nuxt-devtools-frame");
  if (await devtoolsFrame.count()) {
    await devtoolsFrame.evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });
  }
  await expect(page).toHaveScreenshot("advanced-combat.png", {
    fullPage: true,
    animations: "disabled",
  });
});

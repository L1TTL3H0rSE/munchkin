import {expect, test} from "@playwright/test";

import {assertNoRootOverflow, openFixture} from "./fixtureSupport.ts";

test("advanced combat renders projected monsters, effects and capabilities", async ({page}) => {
  await openFixture(page, "advanced-combat");
  await expect(page.locator(".game-table__selected-encounter .encounter-card-presentation")).toHaveCount(1);
  await expect(page.locator(".game-table__encounter-side")).toHaveCount(1);
  await expect(page.locator(".combat-effects")).toBeVisible();
  await expect(page.locator(".combat-effect")).toHaveCount(1);
  await expect(page.locator(".interaction-action").filter({hasText: "Усилить монстра"})).toBeVisible();
  await expect(page.locator(".interaction-action").filter({hasText: "Гидра из справок"})).toBeVisible();
  await expect(page.getByText("fx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {exact: true})).toHaveCount(0);
  await assertNoRootOverflow(page);
});

test("forced helper remains mandatory and does not invent a reward", async ({page}) => {
  await openFixture(page, "advanced-forced-helper");
  const dialog = page.locator("dialog[open]");
  await expect(dialog.locator("#interaction-dialog-title .sheet-dialog__desktop-copy")).toHaveText("Ответ в бою");
  await expect(dialog.locator(".interaction-action").filter({hasText: "Борис"})).toBeVisible();
  await expect(dialog.getByText("Отклонить", {exact: true})).toHaveCount(0);
  await expect(dialog).not.toContainText("Наград");
  await expect(dialog.locator(".interaction-action")).toHaveCount(1);
});

test("observer sees public combat state but no private descriptors", async ({page}) => {
  await openFixture(page, "advanced-observer");
  const dialog = page.locator("dialog[open]");
  await expect(page.locator(".game-table__selected-encounter .encounter-card-presentation")).toHaveCount(1);
  await expect(page.locator(".interaction-opaque")).toBeVisible();
  await expect(page.locator(".interaction-actions")).toHaveCount(0);
  await expect(dialog).not.toContainText("Вызов дополнительного монстра");
  await expect(dialog).not.toContainText("Карта с длинным названием");
  await assertNoRootOverflow(page);
});

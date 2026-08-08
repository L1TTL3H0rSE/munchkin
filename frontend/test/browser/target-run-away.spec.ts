import {expect, test} from "@playwright/test";

import {
  assertMediaPreferences,
  assertNoRootOverflow,
  openFixture,
} from "./fixtureSupport.ts";

test("target initiator can submit only a projected player target", async ({page}) => {
  await openFixture(page, "target-initiator");
  const handOpener = page.getByRole("button", {name: /Открыть руку|Рука ·/}).first();
  await handOpener.click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByRole("option").filter({hasText: "Эффект с выбором цели"}).click();
  await dialog.getByRole("button", {name: "Борис", exact: true}).click();

  const requestPromise = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().includes("/commands/play-target-effect"),
  );
  await dialog.getByRole("button", {name: "Применить эффект к цели", exact: true}).click();
  const body = (await requestPromise).postDataJSON() as Record<string, unknown>;
  expect(body.target_player_id).toBe("player_1");
  expect(body.instance_id).toBe("target-effect-card");
  expect(body).not.toHaveProperty("actor_id");
  expect(body).not.toHaveProperty("roll");
  await assertNoRootOverflow(page);
});

test("target response shows public target and no opaque IDs", async ({page}) => {
  await openFixture(page, "target-response");
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Цель: Борис");
  await expect(dialog.locator(".interaction-action").filter({hasText: "Контрдействие на эффект"})).toBeVisible();
  await expect(dialog.locator(".interaction-action").filter({hasText: "Пасовать"})).toBeVisible();
  await expect(page.getByText("tfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {exact: true})).toHaveCount(0);
  await assertNoRootOverflow(page);
});

test("private choices stay mandatory and actor-private", async ({page}) => {
  await openFixture(page, "target-private-choice");
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Карта с длинным названием");
  await expect(dialog.locator(".sheet-dialog__close")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("foreign-hidden-choice");
  await assertMediaPreferences(page);
  await dialog.getByRole("option").filter({hasText: "Карта с длинным названием"}).click();
  const requestPromise = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().includes("/commands/choose-effect"),
  );
  await dialog.getByRole("button", {name: "Подтвердить выбор", exact: true}).click();
  const request = await requestPromise;
  expect(request.postDataJSON()).toMatchObject({
    choice_ids: ["hero-card-1"],
  });
});

test("Run Away uses only the dedicated actor owners and server-roll action", async ({page}) => {
  await openFixture(page, "run-away-response");
  const desktop = page.locator(".game-table__run-away");
  await expect(desktop).toHaveAttribute("data-figma-owner", "game-board:run-away-wide");
  await expect(desktop).toContainText("Городской монстр с длинным русским описанием");
  await expect(desktop).toContainText("РЕЗУЛЬТАТ И ПОСЛЕДСТВИЯ ОПРЕДЕЛИТ СЕРВЕР");
  await expect(desktop).not.toContainText("Bad Stuff применён сервером");
  await expect(page.locator(".game-table__action-panel")
    .getByRole("button", {name: "Бросить кубик", exact: true})).toBeVisible();
  await expect(page.locator(".run-away-summary, .interaction-surface")).toHaveCount(0);

  await page.setViewportSize({width: 360, height: 640});
  await page.reload({waitUntil: "domcontentloaded"});
  const compact = page.locator('dialog[data-figma-owner="game-modal:run-away-response"]');
  await expect(compact).toBeVisible();
  await expect(compact.getByRole("button", {name: "Бросить кубик", exact: true})).toBeVisible();
  await expect(page.getByText("rfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {exact: true})).toHaveCount(0);
});

test("Run Away result uses the mapped result frame and observer has no response actions", async ({page}) => {
  await openFixture(page, "run-away-result");
  await expect(page.locator(".game-table")).toHaveAttribute("data-figma-desktop-node", "294:1998");
  await expect(page.locator(
    ".desktop-game-header__turn h1:visible, .mobile-game-header__turn:visible",
  )).toHaveText("УСПЕХ");
  await expect(page.getByRole("heading", {name: "Гидра из справок", exact: true})).toBeVisible();

  await openFixture(page, "run-away-observer");
  await expect(page.locator(".game-table__run-away, .run-away-summary, .interaction-surface"))
    .toHaveCount(0);
  await expect(page.locator('dialog[data-figma-owner="game-modal:run-away-response"]'))
    .toHaveCount(0);
  await expect(page.getByRole("button", {name: "Бросить кубик", exact: true}))
    .toHaveCount(0);
  await assertNoRootOverflow(page);
});

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
    request.method() === "POST" && request.url().includes("/commands/respond-interaction"),
  );
  await dialog.locator(".interaction-submit").click();
  const request = await requestPromise;
  expect(request.url()).not.toContain("choose-effect");
  expect(request.postDataJSON()).toMatchObject({
    interaction_id: "interaction_fixture_0001",
    action_id: "act_11111111111111111111111111111111",
    intent: "respond",
  });
});

test("Run Away shows current step, confirmed roll and server-owned response", async ({page}) => {
  await openFixture(page, "run-away-response");
  const summary = page.locator(".run-away-summary");
  await expect(summary).toContainText("Участник: Борис");
  await expect(summary).toContainText("Городской монстр с длинным русским описанием");
  await expect(summary).toContainText("D6 2 +0 = 2");
  await expect(summary).toContainText("Bad Stuff применён сервером");
  await expect(page.locator(".interaction-action").filter({hasText: "Усилить попытку побега"})).toBeVisible();
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
  await expect(page.locator(".interaction-actions")).toHaveCount(0);
  await expect(page.locator(".interaction-opaque")).toBeVisible();
  await assertNoRootOverflow(page);
});

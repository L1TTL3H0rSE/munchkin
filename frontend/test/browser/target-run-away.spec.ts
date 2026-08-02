import {expect, test} from "@playwright/test";

import {
  assertMediaPreferences,
  assertNoRootOverflow,
  openFixture,
} from "./fixtureSupport.ts";

test("target initiator can submit only a projected player target", async ({page}, testInfo) => {
  await openFixture(page, "target-initiator");

  if (testInfo.project.name === "chromium") {
    await page.locator(".own-board").getByRole("button", {
      name: "Открыть персонажа",
    }).click();
  } else {
    await page.getByRole("button", {name: /^Открыть руку/}).click();
  }
  const targetCard = page.locator("dialog[open] .game-card").filter({
    hasText: "Эффект с выбором цели",
  });
  await targetCard.getByRole("button", {
    name: "Эффект с выбором цели: Выбрать действие",
  }).click();
  if (testInfo.project.name !== "chromium") {
    await page.locator("dialog[open]").getByRole("button", {name: "Закрыть"}).click();
  }

  const targetSelect = page.locator(".target-select select:visible");
  await expect(targetSelect.locator("option")).toHaveCount(2);
  await expect(targetSelect.locator("option").nth(1)).toContainText("Борис");
  await targetSelect.selectOption("player_1");

  const requestPromise = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().includes("/commands/play-target-effect"),
  );
  await page.getByRole("button", {
    name: "Применить эффект к цели",
    exact: true,
  }).click();
  const request = await requestPromise;
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body.target_player_id).toBe("player_1");
  expect(body.instance_id).toBe("target-effect-card");
  expect(body).not.toHaveProperty("actor_id");
  expect(body).not.toHaveProperty("roll");
  await assertNoRootOverflow(page);
});

test("target response shows public target and opaque counter choices", async ({page}) => {
  await openFixture(page, "target-response");

  const dialog = page.locator(".interaction-dialog");
  await expect(dialog).toContainText("Цель: Борис");
  await expect(dialog.locator(".interaction-action").filter({
    hasText: "Контрдействие на эффект",
  })).toBeVisible();
  await expect(dialog.locator(".interaction-action").filter({
    hasText: "Пасовать",
  })).toBeVisible();
  await expect(page.getByText("tfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {exact: true}))
    .toHaveCount(0);
  await expect(dialog).not.toContainText("foreign-hidden-card");
  await assertNoRootOverflow(page);
});

test("private target choices stay mandatory and actor-private", async ({page}) => {
  await openFixture(page, "target-private-choice");

  const dialog = page.locator(".interaction-dialog");
  await expect(dialog).toContainText("Карта с длинным названием");
  await expect(dialog.locator(".interaction-dialog__close")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("foreign-hidden-choice");
  await assertMediaPreferences(page);
  await assertNoRootOverflow(page);
});

test("target observer sees the target but no private response descriptors", async ({page}) => {
  await openFixture(page, "target-observer");

  await expect(page.locator(".interaction-domain-summary")).toContainText("Цель: Борис");
  await expect(page.locator(".interaction-actions")).toHaveCount(0);
  await expect(page.locator(".interaction-dialog__opaque")).toBeVisible();
  await expect(page.locator(".interaction-dialog")).not.toContainText("Запасной план");
  await assertNoRootOverflow(page);
});

test("Run Away shows current step, confirmed roll and server-owned response", async ({page}) => {
  await openFixture(page, "run-away-response");

  const summary = page.locator(".run-away-summary");
  await expect(summary).toContainText("Участник: Борис");
  await expect(summary).toContainText("Городской монстр с длинным русским описанием");
  await expect(summary).toContainText("D6 2 +0 = 2");
  await expect(summary).toContainText("Bad Stuff применён сервером");
  await expect(page.locator(".interaction-action").filter({
    hasText: "Усилить попытку побега",
  })).toBeVisible();
  await expect(page.locator(".interaction-dialog")).toContainText(
    "бросок D6 выполняет сервер",
  );
  await expect(page.getByText("rfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", {exact: true}))
    .toHaveCount(0);
  await assertNoRootOverflow(page);
});

test("Run Away result preserves ordered attempts and observer has no response actions", async ({page}) => {
  await openFixture(page, "run-away-result");

  const attempts = page.locator(".run-away-attempts li");
  await expect(attempts).toHaveCount(2);
  await expect(attempts.nth(0)).toContainText("Bad Stuff применён сервером");
  await expect(attempts.nth(1)).toContainText("Побег подтверждён сервером");
  await expect(attempts.nth(1)).toContainText("Гидра из справок");
  await assertNoRootOverflow(page);

  await openFixture(page, "run-away-observer");
  await expect(page.locator(".interaction-actions")).toHaveCount(0);
  await expect(page.locator(".interaction-dialog__opaque")).toBeVisible();
  await assertNoRootOverflow(page);
});

test("Run Away has a canonical Chromium visual baseline", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openFixture(page, "run-away-response");
  const devtoolsFrame = page.locator("nuxt-devtools-frame");
  if (await devtoolsFrame.count()) {
    await devtoolsFrame.evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });
  }
  await expect(page).toHaveScreenshot("target-run-away.png", {
    fullPage: true,
    animations: "disabled",
  });
});

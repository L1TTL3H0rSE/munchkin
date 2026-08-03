import {expect, test} from "@playwright/test";

import {
  assertFocusBoundary,
  assertMediaPreferences,
  assertNoRootOverflow,
  openFixture,
} from "./fixtureSupport.ts";

test("trade and gift expose only actor-owned cards and legal recipients", async ({page}) => {
  await openFixture(page, "economy-actions");

  const surface = page.getByTestId("economy-surface");
  await expect(surface).toBeVisible();
  await expect(surface.locator(".economy-card")).toHaveCount(3);
  await expect(surface).not.toContainText("opaque-recipient-card-1");
  await expect(surface.locator("[data-kind='gift']")).toContainText("Борис");
  await expect(surface.locator("[data-kind='trade']")).toContainText("Вера");

  const gift = surface.locator("[data-kind='gift']");
  const trade = surface.locator("[data-kind='trade']");
  await expect(gift.getByRole("checkbox", {name: "Передаваемый фонарь", exact: true})).toBeVisible();
  await expect(trade.getByRole("checkbox", {name: "Передаваемый плащ", exact: true})).toBeVisible();
  await gift.locator("input[type='checkbox']").first().check();
  const request = page.waitForRequest((candidate) =>
    candidate.method() === "POST" && candidate.url().includes("/commands/propose-gift"),
  );
  await gift.getByRole("button", {name: "Отправить предложение"}).click();
  const body = JSON.parse((await request).postData() ?? "{}");
  expect(body).toMatchObject({
    recipient_player_id: "player_1",
    offered_instance_ids: ["transfer-card-1"],
  });
  expect(body).not.toHaveProperty("requested_instance_ids");
  await assertNoRootOverflow(page);
});

test("charity requires exact allocation and uses typed recipient mappings", async ({page}) => {
  await openFixture(page, "charity-transfer");

  const surface = page.locator(".interaction-dialog").getByTestId("economy-surface");
  await expect(surface).toBeVisible();
  const submit = surface.getByRole("button", {name: "Подтвердить распределение"});
  await expect(submit).toBeDisabled();

  const decisions = surface.locator(".economy-field--card select");
  await decisions.nth(0).selectOption("__discard__");
  await decisions.nth(1).selectOption("player_1");
  await expect(surface).toContainText("Выбрано решений: 2 / 2.");
  await expect(submit).toBeEnabled();

  const request = page.waitForRequest((candidate) =>
    candidate.method() === "POST" && candidate.url().includes("/commands/resolve-charity"),
  );
  await submit.click();
  const body = JSON.parse((await request).postData() ?? "{}");
  expect(body.allocations).toEqual([
    {instance_id: "charity-card-1"},
    {instance_id: "charity-card-2", recipient_player_id: "player_1"},
  ]);
  await assertFocusBoundary(page);
  await assertNoRootOverflow(page);
});

test("observer stays opaque while a victim can see only an own counter descriptor", async ({page}) => {
  await openFixture(page, "economy-observer");
  await expect(page.getByTestId("economy-surface")).toHaveCount(0);
  await expect(page.locator(".interaction-dialog")).toContainText(
    "Детали предложения доступны только участникам",
  );
  await expect(page.locator(".interaction-dialog")).not.toContainText("Предложенный предмет");

  await openFixture(page, "theft-response");
  const counter = page.locator(".interaction-action");
  await expect(counter).toHaveCount(1);
  await expect(counter).toContainText("Выставить контрмеру");
  await expect(counter).toContainText("Собственная контркарта");
  await expect(page.locator(".interaction-dialog")).not.toContainText("hidden candidates");
  await assertMediaPreferences(page);
  await assertNoRootOverflow(page);
});

test("charity deadline stays advisory and the surface survives 200 percent zoom", async ({page}) => {
  await page.clock.install({time: "2030-01-01T00:04:00.000Z"});
  await openFixture(page, "charity-transfer");

  const dialog = page.locator(".interaction-dialog");
  const surface = dialog.getByTestId("economy-surface");
  await expect(dialog).toContainText("Осталось примерно 60 сек.");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.clock.fastForward(61_000);
  await expect(dialog).toContainText("Время вышло — ждём сервер");
  await assertNoRootOverflow(page);
});

test("economy surface has a canonical Chromium visual baseline", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await openFixture(page, "charity-transfer");
  const devtoolsFrame = page.locator("nuxt-devtools-frame");
  if (await devtoolsFrame.count()) {
    await devtoolsFrame.evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });
  }
  await expect(page).toHaveScreenshot("player-economy/charity-transfer.png", {
    fullPage: true,
    animations: "disabled",
    // The advisory response timer is live while the screenshot is captured.
    maxDiffPixels: 256,
  });
});

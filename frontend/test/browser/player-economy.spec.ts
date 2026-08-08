import {expect, test, type Page} from "@playwright/test";

import {
  assertMediaPreferences,
  assertNoRootOverflow,
  openFixture,
} from "./fixtureSupport.ts";

async function openTurnActions(page: Page): Promise<void> {
  const desktopCharacter = page.locator(".game-table__character:visible");
  if (await desktopCharacter.count()) {
    await desktopCharacter.click();
  } else {
    await page.locator(".mobile-game-table__dock").getByRole("button", {
      name: "Персонаж",
      exact: true,
    }).click();
  }
  const character = page.locator("dialog[open]");
  await character.getByRole("button", {name: /ПЕРЕНОСИМЫЕ ВЕЩИ/}).first().click();
  await expect(page.locator("dialog[open]")).toHaveAttribute("data-figma-desktop-node", "291:1587");
}

test("gift and trade use only Figma choice cards and legal recipients", async ({page}) => {
  await openFixture(page, "economy-actions");
  await openTurnActions(page);
  const dialog = page.locator("dialog[open]");
  await expect(dialog.locator("input, select")).toHaveCount(0);
  await expect(dialog).not.toContainText("opaque-recipient-card");

  await dialog.getByRole("tab", {name: "Предложить подарок · Борис", exact: true}).click();
  await dialog.getByRole("option").filter({hasText: "Передаваемый фонарь"}).click();
  const giftRequest = page.waitForRequest((candidate) =>
    candidate.method() === "POST" && candidate.url().includes("/commands/propose-gift"),
  );
  await dialog.getByRole("button", {name: "Предложить подарок", exact: true}).click();
  const giftBody = (await giftRequest).postDataJSON() as Record<string, unknown>;
  expect(giftBody).toMatchObject({
    recipient_player_id: "player_1",
    offered_instance_ids: ["transfer-card-1"],
  });
  expect(giftBody).not.toHaveProperty("requested_instance_ids");

  await openFixture(page, "economy-actions");
  await openTurnActions(page);
  const trade = page.locator("dialog[open]");
  await trade.getByRole("tab", {name: "Предложить обмен · Вера", exact: true}).click();
  await trade.getByRole("option").filter({hasText: "Передаваемый плащ"}).click();
  await trade.getByRole("button", {name: "Выбрать встречные карты", exact: true}).click();
  await expect(trade).toContainText("Запасной щит");
  await trade.getByRole("option").filter({hasText: "Запасной щит"}).click();
  const tradeRequest = page.waitForRequest((candidate) =>
    candidate.method() === "POST" && candidate.url().includes("/commands/propose-trade"),
  );
  await trade.getByRole("button", {name: "Предложить обмен", exact: true}).click();
  const tradeBody = (await tradeRequest).postDataJSON() as Record<string, unknown>;
  expect(tradeBody).toMatchObject({
    recipient_player_id: "player_2",
    offered_instance_ids: ["transfer-card-2"],
    requested_instance_ids: ["opaque-recipient-card-1"],
  });
  await assertNoRootOverflow(page);
});

test("sale, ability, trait discard and theft all have executable card paths", async ({page}) => {
  await openFixture(page, "economy-actions");
  await openTurnActions(page);
  let dialog = page.locator("dialog[open]");
  for (const actionName of [
    /Сбросить черту/,
    /Продать предметы/,
    /Начать кражу/,
  ]) {
    await expect(dialog.getByRole("tab", {name: actionName}).first()).toBeVisible();
  }
  await dialog.getByRole("tab", {name: /Продать предметы/}).click();
  await dialog.getByRole("option").filter({hasText: "Старый шлем"}).click();
  await dialog.getByRole("option").filter({hasText: "Передаваемый фонарь"}).click();
  await expect(dialog.getByRole("button", {name: "Продать предметы", exact: true})).toBeEnabled();

  await openFixture(page, "ability-combat");
  await openTurnActions(page);
  dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Способность: Воинская ярость");
  await dialog.getByRole("option").first().click();
  await expect(dialog.getByRole("button", {name: "Использовать способность", exact: true})).toBeEnabled();
});

test("charity transfer assigns every exact excess card to a legal recipient", async ({page}) => {
  await openFixture(page, "charity-transfer");
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toHaveAttribute("data-figma-compact-node", "147:978");
  await expect(dialog.locator("input, select")).toHaveCount(0);
  const cards = dialog.locator(".charity-sheet__rail > button");
  await cards.nth(0).click();
  await cards.nth(1).click();
  await dialog.getByRole("button", {name: "Назначить получателей", exact: true}).click();
  const recipientGroups = dialog.locator(".charity-sheet__recipients > div");
  await expect(recipientGroups).toHaveCount(2);
  await recipientGroups.nth(0).getByRole("button", {name: "Борис", exact: true}).click();
  await recipientGroups.nth(1).getByRole("button", {name: "Вера", exact: true}).click();

  const request = page.waitForRequest((candidate) =>
    candidate.method() === "POST" && candidate.url().includes("/commands/resolve-charity"),
  );
  await dialog.getByRole("button", {name: "Передать карты", exact: true}).click();
  const body = (await request).postDataJSON() as {allocations: unknown[]};
  expect(body.allocations).toEqual([
    {instance_id: "charity-card-1", recipient_player_id: "player_1"},
    {instance_id: "charity-card-2", recipient_player_id: "player_2"},
  ]);
  await assertNoRootOverflow(page);
});

test("observer stays opaque while theft victim sees only their own counter", async ({page}) => {
  await openFixture(page, "economy-observer");
  let dialog = page.locator("dialog[open]");
  await expect(dialog).toContainText("Окно открыто");
  await expect(dialog).not.toContainText("Предложенный предмет");

  await openFixture(page, "theft-response");
  dialog = page.locator("dialog[open]");
  const counter = dialog.locator(".interaction-action");
  await expect(counter).toHaveCount(1);
  await expect(counter).toContainText("Выставить контрмеру");
  await expect(counter).toContainText("Собственная контркарта");
  await expect(dialog).not.toContainText("hidden candidates");
  await assertMediaPreferences(page);
  await assertNoRootOverflow(page);
});

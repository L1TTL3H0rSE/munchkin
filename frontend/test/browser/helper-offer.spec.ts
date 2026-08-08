import {expect, test} from "@playwright/test";

import {openFixture} from "./fixtureSupport.ts";

test("combatant helper form exposes only descriptor-backed options", async ({page}) => {
  await openFixture(page, "helper-offer");

  await expect(page.locator(".interaction-helper-form")).toBeVisible();
  const helperChoices = page.getByRole("listbox", {name: "Варианты помощи"});
  await expect(helperChoices.getByRole("option")).toHaveCount(3);
  await expect(helperChoices.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await expect(helperChoices).toContainText("Борис");
  await expect(helperChoices).toContainText("Вера");
  await expect(helperChoices).toContainText("1 сокровища");
  await expect(helperChoices).toContainText("2 сокровища");
  await expect(page.locator(".interaction-helper-form input, .interaction-helper-form select")).toHaveCount(0);
  await expect(page.getByRole("button", {name: "Предложить помощь"}))
    .toBeEnabled();
});

test("invited helper sees party terms while observer sees an opaque window", async ({page}) => {
  await openFixture(page, "helper-invite");
  const invite = page.locator(".interaction-helper-summary");
  await expect(invite).toContainText("Участник боя: Борис");
  await expect(invite).toContainText("Награда: 2 сокр.");
  await expect(invite.locator("time")).toHaveAttribute(
    "datetime",
    "2030-01-01T00:05:00.000Z",
  );
  await expect(page.getByRole("button", {name: "Принять"})).toBeVisible();
  await expect(page.locator(".interaction-action").filter({hasText: "Отклонить"}))
    .toBeVisible();

  await openFixture(page, "helper-observer");
  await expect(page.locator(".interaction-helper-form")).toHaveCount(0);
  await expect(page.locator(".interaction-helper-summary")).toHaveCount(0);
  await expect(page.locator("dialog[data-figma-owner='interaction-sheet'][open]")).toContainText(
    "нет действия для этого игрока",
  );
});

test("accepted helper summary is rendered from combat projection", async ({page}) => {
  await openFixture(page, "helper-accepted");

  const summary = page.locator(".game-table__strength-group--monsters");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("Алиса");
  await expect(summary).toContainText("награда 2 сокр.");
});

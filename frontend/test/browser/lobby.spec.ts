import {AxeBuilder} from "@axe-core/playwright";
import {expect, test, type Page, type Route} from "@playwright/test";

import {
  lobbySummarySchema,
} from "../../packages/contracts/src/index.ts";

import {
  assertMediaPreferences,
  assertNoRootOverflow,
  assertSkipLinkFocus,
  fixtureLobbyResult,
  installFixture,
} from "./fixtureSupport.ts";

const fixtureID = "single-combat";
const expectedGameID = fixtureLobbyResult(fixtureID).game_id;

async function openLobby(page: Page): Promise<void> {
  await page.goto("/", {waitUntil: "domcontentloaded"});
  await expect(page.locator(".lobby-page")).toHaveAttribute("data-interactive", "true", {
    timeout: 15_000,
  });
}

async function selectLobbyMode(page: Page, mode: "create" | "join"): Promise<void> {
  const label = mode === "create" ? "Создать" : "Войти";
  await page.locator(".lobby-entry__mode-switch").getByRole("button", {name: label, exact: true}).click();
  await expect(page.locator(`.lobby-form--${mode}`)).toBeVisible();
}

async function routeLobbyAPI(
  page: Page,
  options: {
    createGate?: Promise<void>;
    createStatus?: number;
    joinStatus?: number;
  } = {},
): Promise<void> {
  const result = fixtureLobbyResult(fixtureID);
  const summary = lobbySummarySchema.parse({
    game_id: result.game_id,
    version: result.projection.version,
    status: "lobby",
    player_count: 1,
    min_players: 1,
    max_players: 6,
    rules_profile_id: result.projection.rules_profile_id,
    rules_profile_version: result.projection.rules_profile_version,
  });

  await page.route("**/api/v1/lobbies", async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    if (options.createGate) {
      await options.createGate;
    }
    if (options.createStatus) {
      await route.fulfill({
        status: options.createStatus,
        contentType: "application/json",
        body: JSON.stringify({
          error: true,
          code: "internal_error",
          message: "token=raw-backend-detail",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });

  await page.route(/\/api\/v1\/lobbies\/[^/]+$/, async (route: Route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    if (options.joinStatus) {
      await route.fulfill({
        status: options.joinStatus,
        contentType: "application/json",
        body: JSON.stringify({
          error: true,
          code: "not_found",
          message: "token=raw-backend-detail",
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(summary),
    });
  });

  await page.route(/\/api\/v1\/games\/[^/]+\/players$/, async (route: Route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
}

test("create pending state does not block join and success follows server result", async ({page}) => {
  let releaseCreate: (() => void) | undefined;
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  await installFixture(page, fixtureID);
  await routeLobbyAPI(page, {createGate});
  await openLobby(page);

  const createForm = page.locator(".lobby-form--create");
  const joinForm = page.locator(".lobby-form--join");
  await createForm.locator("input[autocomplete='nickname']").fill("Алиса");
  await createForm.getByRole("button", {name: "Создать"}).click();

  await expect(createForm).toHaveAttribute("data-state", "loading");
  await expect(createForm).toHaveAttribute("aria-busy", "true");
  await selectLobbyMode(page, "join");
  await expect(joinForm).toHaveAttribute("data-state", "idle");
  await expect(joinForm.getByRole("button", {name: "Войти"})).toBeEnabled();

  releaseCreate?.();
  await expect(page).toHaveURL(new RegExp(`/game/${expectedGameID}$`));
  await expect(page.locator(".game-table")).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(new URL(page.url()).hash).toBe("");
});

test("not-found join keeps safe input and focuses the linked field error", async ({page}) => {
  await routeLobbyAPI(page, {joinStatus: 404});
  await openLobby(page);
  await selectLobbyMode(page, "join");

  const joinForm = page.locator(".lobby-form--join");
  const gameIDInput = joinForm.locator("input[inputmode='text']");
  const displayNameInput = joinForm.locator("input[autocomplete='nickname']");
  await gameIDInput.fill("game_missing");
  await displayNameInput.fill("Борис");
  await joinForm.getByRole("button", {name: "Войти"}).click();

  await expect(joinForm).toHaveAttribute("data-state", "error");
  await expect(joinForm.locator("[role='alert'], .lobby-form__field-error").first())
    .toContainText("Комната не найдена");
  await expect(gameIDInput).toHaveValue("game_missing");
  await expect(displayNameInput).toHaveValue("Борис");
  await expect(gameIDInput).toBeFocused();
  await expect(gameIDInput).toHaveAttribute(
    "aria-describedby",
    "lobby-join-form-game-id-error",
  );
  await expect(page.locator("body")).not.toContainText("raw-backend-detail");
});

test("offline create exposes bounded retry copy without leaking raw response", async ({page}) => {
  await routeLobbyAPI(page, {createStatus: 503});
  await openLobby(page);

  const createForm = page.locator(".lobby-form--create");
  await createForm.locator("input[autocomplete='nickname']").fill("Алиса");
  await createForm.getByRole("button", {name: "Создать"}).click();

  await expect(createForm).toHaveAttribute("data-state", "error");
  await expect(createForm).toContainText("Сейчас не получается открыть комнату.");
  await expect(createForm).toContainText("Можно повторить попытку.");
  await expect(page.locator("body")).not.toContainText("raw-backend-detail");
});

test("lobby stays within the viewport and keeps keyboard/media affordances", async ({page}) => {
  await openLobby(page);
  await assertNoRootOverflow(page);
  await assertSkipLinkFocus(page);
  await assertMediaPreferences(page);

  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await assertNoRootOverflow(page);
  await expect(page.locator(".lobby-form--create input[autocomplete='nickname']")).toBeVisible();
});

test("selected lobby mode controls the compact entry form", async ({page}) => {
  await page.setViewportSize({width: 360, height: 640});
  await openLobby(page);

  const entry = page.locator(".lobby-entry");
  await expect(entry).toHaveAttribute("data-mode", "create");
  await expect(page.locator(".lobby-form--create")).toBeVisible();
  await expect(page.locator(".lobby-form--join")).toBeHidden();

  await selectLobbyMode(page, "join");
  await expect(entry).toHaveAttribute("data-mode", "join");
  await expect(page.locator(".lobby-form--create")).toBeHidden();
  await expect(page.locator(".lobby-form--join")).toBeVisible();
});

test("lobby has no serious or critical axe violations", async ({page}) => {
  await openLobby(page);
  const results = await new AxeBuilder({page})
    .include("#main-content")
    .analyze();
  const seriousOrCritical = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical",
  );
  expect(seriousOrCritical).toEqual([]);
});

test("join submits with Enter and keeps create independent", async ({page}) => {
  let releaseCreate: (() => void) | undefined;
  const createGate = new Promise<void>((resolve) => {
    releaseCreate = resolve;
  });
  await routeLobbyAPI(page, {createGate});
  await openLobby(page);

  const createForm = page.locator(".lobby-form--create");
  const joinForm = page.locator(".lobby-form--join");
  await createForm.locator("input[autocomplete='nickname']").fill("Алиса");
  await createForm.getByRole("button", {name: "Создать"}).click();
  await expect(createForm).toHaveAttribute("data-state", "loading");

  await selectLobbyMode(page, "join");
  await joinForm.locator("input[autocomplete='nickname']").fill("Борис");
  const gameIDInput = joinForm.locator("input[inputmode='text']");
  await gameIDInput.fill(fixtureID);
  await gameIDInput.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/game/${expectedGameID}$`));
  releaseCreate?.();
});

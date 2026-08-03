import {expect, type Locator, type Page, type Route} from "@playwright/test";

import {
  commandResultSchema,
  lobbyResultSchema,
  projectionSchema,
} from "../../packages/contracts/src/index.ts";

import {
  fixtureAdapter,
  type UiFixtureDefinition,
} from "../../applications/web/test/fixtures/fixtureAdapter.ts";

export const fixtureCredential = "fixture-browser-token-0000000000000000000000000000";

export const canonicalViewports = {
  mobile: {width: 360, height: 640},
  desktop: {width: 1440, height: 900},
} as const;

export type PresenterKind = "mobile" | "desktop";

export async function activePresenter(
  page: Page,
  expectedKind?: PresenterKind,
): Promise<Locator> {
  const selector = expectedKind
    ? `.${expectedKind}-game-table:visible`
    : ".mobile-game-table:visible, .desktop-game-table:visible";
  const presenter = page.locator(selector);
  await expect(presenter).toHaveCount(1);
  return presenter;
}

export async function installFixture(
  page: Page,
  fixtureID: string,
): Promise<UiFixtureDefinition> {
  const fixture = fixtureAdapter.get(fixtureID);
  const projection = fixtureAdapter.getProjection(fixtureID);
  const invalidation = {
    type: "game.v1.version_advanced",
    occurred_at: "2026-07-31T00:00:00.000Z",
    game_id: projection.game_id,
    version: projection.version,
    reason: projection.turn.available_actions[0]?.type ?? "join",
  };

  await page.addInitScript(({gameID, credential, invalidation: fixtureInvalidation}) => {
    sessionStorage.setItem(`munchkin:credential:${gameID}`, credential);
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const requestURL = typeof input === "string"
        ? new URL(input, window.location.origin)
        : new URL(input instanceof Request ? input.url : input.toString(), window.location.origin);
      if (!requestURL.pathname.endsWith(`/api/v1/games/${encodeURIComponent(gameID)}/events`)) {
        return nativeFetch(input, init);
      }

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(
            `data: ${JSON.stringify(fixtureInvalidation)}\n\n`,
          ));
          init?.signal?.addEventListener("abort", () => {
            controller.error(new DOMException("The operation was aborted.", "AbortError"));
          }, {once: true});
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {"Content-Type": "text/event-stream"},
      });
    };
  }, {gameID: projection.game_id, credential: fixtureCredential, invalidation});

  await page.route("**/api/v1/games/**", async (route) => {
    await fulfillGameRoute(route, projection);
  });

  await page.route("**/api/v1/content/**", async (route) => {
    await route.fulfill({status: 404, body: ""});
  });

  return fixture;
}

async function fulfillGameRoute(
  route: Route,
  projection: ReturnType<typeof projectionSchema.parse>,
): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());

  if (url.pathname.endsWith("/events")) {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: `data: ${JSON.stringify({
        type: "game.v1.version_advanced",
        occurred_at: "2026-07-31T00:00:00.000Z",
        game_id: projection.game_id,
        version: projection.version,
        reason: projection.turn.available_actions[0]?.type ?? "join",
      })}\n\n`,
    });
    return;
  }

  if (request.method() === "GET") {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(projectionSchema.parse(projection)),
    });
    return;
  }

  if (request.method() === "POST") {
    const commandID = request.headers()["idempotency-key"] ?? "fixture-command-id";
    const commandResult = commandResultSchema.parse({
      game_id: projection.game_id,
      command_id: commandID,
      version: projection.version + 1,
      replayed: false,
      projection: {
        ...projection,
        version: projection.version + 1,
      },
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(commandResult),
    });
    return;
  }

  await route.continue();
}

export async function openFixture(
  page: Page,
  fixtureID: string,
): Promise<UiFixtureDefinition> {
  const fixture = await installFixture(page, fixtureID);
  await page.goto(`/game/${encodeURIComponent(fixture.projection.game_id)}`);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator(".game-table")).toBeVisible({timeout: 15_000});
  await expect(page.locator(".center-state")).toHaveCount(0);
  await activePresenter(page);
  return fixture;
}

export async function openFixtureAtViewport(
  page: Page,
  fixtureID: string,
  width: number,
  height: number,
): Promise<UiFixtureDefinition> {
  await page.setViewportSize({width, height});
  return openFixture(page, fixtureID);
}

export async function assertNoRootOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
}

export async function assertNoDocumentVerticalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight);
}

export async function assertSkipLinkFocus(page: Page): Promise<void> {
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
}

export async function assertLabeledRails(page: Page): Promise<void> {
  await expect(page.locator("main#main-content")).toHaveCount(1);
  const presenter = await activePresenter(page);
  const terminal = presenter.locator(
    ".desktop-victory-result, .system-state-surface[data-state='victory']",
  );
  if (await terminal.count() === 0) {
    await expect(presenter.locator("header.desktop-game-header, header.mobile-game-header")).toHaveCount(1);
  }
  const actionDock = presenter.locator(".action-dock:visible");
  if (await actionDock.count()) {
    await expect(actionDock).toHaveAttribute("aria-labelledby", "action-dock-title");
    await expect(presenter.locator("#action-dock-title:visible")).toHaveCount(1);
  }
}

export async function assertFocusBoundary(page: Page): Promise<void> {
  const focusable = page.locator(
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
  );
  const count = await focusable.count();
  expect(count).toBeGreaterThan(1);
  await focusable.nth(count - 1).focus();
  await expect(focusable.nth(count - 1)).toBeFocused();
}

export async function assertMediaPreferences(page: Page): Promise<void> {
  await page.emulateMedia({reducedMotion: "reduce", forcedColors: "active"});
  const mediaState = await page.evaluate(() => ({
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    forcedColors: matchMedia("(forced-colors: active)").matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  expect(mediaState.reducedMotion).toBeTruthy();
  expect(mediaState.forcedColors).toBeTruthy();
  expect(mediaState.scrollBehavior).toBe("auto");
  await page.keyboard.press("Tab");
  const focusOutline = await page.evaluate(() => {
    const active = document.activeElement;
    return active ? getComputedStyle(active).outlineStyle : "none";
  });
  expect(focusOutline).not.toBe("none");
}

export function fixtureIDs(): string[] {
  return fixtureAdapter.list().map((fixture) => fixture.id);
}

export function fixtureLobbyResult(fixtureID: string) {
  const fixture = fixtureAdapter.get(fixtureID);
  return lobbyResultSchema.parse({
    game_id: fixture.projection.game_id,
    player_id: fixture.projection.you.player_id,
    credential: fixtureCredential,
    projection: fixture.projection,
  });
}

import {expect, test} from "@playwright/test";
import {
  commandResultSchema,
  projectionSchema,
} from "../../packages/contracts/src/index.ts";

import {
  assertNoRootOverflow,
  installFixture,
  openFixture,
} from "./fixtureSupport.ts";

test("current looter sees only descriptor-backed pick/pass controls", async ({page}) => {
  const fixture = await openFixture(page, "death-loot");
  const surface = page.getByTestId("death-loot-surface");

  await expect(surface).toHaveAttribute("data-priority", "actor");
  await expect(surface.locator(".death-loot-option")).toHaveCount(2);
  await expect(surface).toContainText("Добыча погибшего игрока");
  await expect(surface).toContainText("Добыча из комнаты");
  await expect(surface).toContainText("Старый фонарь");
  await expect(surface.getByRole("button", {name: /^ПРОПУСТИТЬ/})).toBeVisible();

  const action = fixture.projection.interaction?.actions[0];
  if (!action) {
    throw new Error("death-loot actor fixture must expose a pick action");
  }
  const requestPromise = page.waitForRequest((request) =>
    request.method() === "POST" && request.url().includes("/commands/respond-interaction"),
  );
  await surface.getByRole("button", {name: "Забрать карту", exact: true}).click();
  const request = await requestPromise;
  const body = request.postDataJSON() as Record<string, unknown>;

  expect(body).toMatchObject({
    expected_version: fixture.projection.version,
    interaction_id: action.interaction_id,
    action_id: action.action_id,
    intent: "respond",
  });
  expect(body).not.toHaveProperty("choice_ids");
  expect(body).not.toHaveProperty("player_id");
  await assertNoRootOverflow(page);
});

test("server closure returns focus to one live projection notice", async ({page}) => {
  const fixture = await openFixture(page, "death-loot");
  const closedProjection = projectionSchema.parse({
    ...fixture.projection,
    version: fixture.projection.version + 1,
    interaction: undefined,
  });
  await page.unroute("**/api/v1/games/**");
  await page.route("**/api/v1/games/**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const commandID = request.headers()["idempotency-key"] ?? "fixture-command-id";
      const result = commandResultSchema.parse({
        game_id: closedProjection.game_id,
        command_id: commandID,
        version: closedProjection.version,
        replayed: false,
        projection: closedProjection,
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(result),
      });
      return;
    }
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(projectionSchema.parse(fixture.projection)),
      });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("death-loot-surface")
    .getByRole("button", {name: "Забрать карту", exact: true})
    .click();
  const notice = page.getByTestId("death-loot-closure-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toBeFocused();
  await expect(notice).toContainText("закрыто сервером");
  await expect(page.getByTestId("death-loot-surface")).toHaveCount(0);
  await assertNoRootOverflow(page);
});

test("observer sees only the Figma waiting surface without private loot identities", async ({page}) => {
  await openFixture(page, "death-loot-observer");
  const surface = page.getByTestId("death-loot-surface");

  await expect(surface).toHaveAttribute("data-priority", "observer");
  await expect(surface.locator(".death-loot-option")).toHaveCount(0);
  await expect(surface.getByRole("button")).toHaveCount(0);
  await expect(surface).toContainText("Доступных карт сейчас нет");
  await expect(surface).not.toContainText("Добыча из комнаты");
  await expect(surface).not.toContainText("Старый фонарь");
  await assertNoRootOverflow(page);
});

test("all-pass terminal preserves the Figma result at 200 percent zoom", async ({page}) => {
  await openFixture(page, "death-loot-all-pass");
  const surface = page.getByTestId("death-loot-surface");

  await expect(surface).toHaveAttribute("data-state", "terminal");
  await expect(surface).toContainText("Все доступные участники пропустили выбор");
  await expect(surface.locator("button")).toHaveCount(0);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await assertNoRootOverflow(page);
});

test("one-player death uses the Figma death composition instead of a loot fallback", async ({page}) => {
  const fixture = await installFixture(page, "death-loot-single");
  await page.goto(`/game/${encodeURIComponent(fixture.projection.game_id)}`);
  await expect(page.getByRole("heading", {name: "Персонаж выбыл"})).toBeVisible();
  await expect(page.getByTestId("death-loot-surface")).toHaveCount(0);
  await assertNoRootOverflow(page);
});

test("death loot has a canonical Chromium visual baseline", async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "visual baseline is canonical Chromium only");
  await page.setViewportSize({width: 1440, height: 900});
  await openFixture(page, "death-loot");
  const devtoolsFrame = page.locator("nuxt-devtools-frame");
  if (await devtoolsFrame.count()) {
    await devtoolsFrame.evaluate((element) => {
      (element as HTMLElement).style.display = "none";
    });
  }
  await expect(page).toHaveScreenshot("death-loot/actor.png", {
    fullPage: true,
    animations: "disabled",
    // The advisory response timer is live while the screenshot is captured.
    maxDiffPixels: 256,
  });
});

import {expect, test} from "@playwright/test";

import {
  lobbyResultSchema,
  projectionSchema,
} from "../../packages/contracts/src/index.ts";

import {fixtureCredential} from "./fixtureSupport.ts";

test.skip(
  process.env.MUNCHKIN_REAL_E2E !== "1",
  "real-boundary smoke is opt-in because it starts Go and Nuxt servers",
);

test("real browser reaches the Go lobby and actor projection", async ({page, request}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "real boundary smoke is canonical Chromium only");
  const apiBase = process.env.PLAYWRIGHT_API_BASE ?? "http://127.0.0.1:18080";
  const response = await request.post(`${apiBase}/api/v1/lobbies`, {
    data: {display_name: "Browser Smoke"},
  });
  expect(response.ok()).toBeTruthy();
  const result = lobbyResultSchema.parse(await response.json());
  const projection = projectionSchema.parse(result.projection);

  await page.addInitScript(({gameID, credential}) => {
    sessionStorage.setItem(`munchkin:credential:${gameID}`, credential);
  }, {gameID: result.game_id, credential: result.credential || fixtureCredential});
  await page.goto(`/game/${encodeURIComponent(result.game_id)}`);

  await expect(page.locator(".game-table, .center-state")).toBeVisible();
  await expect(page.locator("code").first()).toContainText(projection.game_id);
});

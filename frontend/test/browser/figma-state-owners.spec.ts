import {expect, test, type Page} from "@playwright/test";

import {
  fixtureAdapter,
} from "../../packages/components/test/fixtures/fixtureAdapter.ts";
import {
  figmaStateDescriptors,
  figmaStateRuntime,
  type FigmaRuntimeSetup,
  type FigmaStateDescriptor,
} from "./figmaStateMatrix.ts";
import {
  canonicalViewports,
  installFixture,
  openFixture,
  openTransportFixture,
} from "./fixtureSupport.ts";

async function openState(
  page: Page,
  descriptor: FigmaStateDescriptor,
  setup: FigmaRuntimeSetup,
): Promise<void> {
  const runtime = figmaStateRuntime[descriptor.name];
  await page.setViewportSize(runtime.viewport === "compact"
    ? canonicalViewports.mobile
    : canonicalViewports.desktop);

  if (setup === "loading" || setup === "auth" || setup === "unavailable" ||
    setup === "reconnecting" || setup === "connection-failed") {
    await openTransportFixture(page, descriptor.fixtureID, setup);
    return;
  }

  if (setup === "stale-choice") {
    await openTransportFixture(page, descriptor.fixtureID, "stale-choice");
    await page.getByRole("button", {name: "Открыть дверь", exact: true}).click();
    return;
  }

  if (["Death", "DeathRecovery", "Victory", "GameFinished"].includes(descriptor.name)) {
    const fixture = await installFixture(page, descriptor.fixtureID);
    await page.goto(`/game/${encodeURIComponent(fixture.projection.game_id)}`);
    await expect(page.locator("#main-content")).toBeVisible();
    return;
  }

  await openFixture(page, descriptor.fixtureID);
  if (setup === "hand") {
    await page.getByRole("button", {name: "Открыть руку", exact: true}).click();
  } else if (setup === "fast-equip") {
    await page.getByRole("button", {name: /Рука ·/}).first().click();
    await page.getByRole("option").filter({hasText: "Учебный шлем"}).click();
  } else if (setup === "character" || setup === "exact-equip" || setup === "gift") {
    await page.locator(".game-table__character:visible, .mobile-game-table__dock-character:visible").click();
    if (setup === "exact-equip") {
      await page.locator(".equipment-slot").first().click();
    } else if (setup === "gift") {
      await page.locator(".character-equipment__summary-carried").click();
      await page.getByRole("tab").filter({hasText: "подарок"}).click();
    }
  } else if (setup === "strength") {
    await page.locator(".game-table__strength:visible").click();
  } else if (setup === "opponent") {
    await page.locator(".opponent-tile").first().click();
  }
}

for (const descriptor of figmaStateDescriptors) {
  test(`${descriptor.name} mounts its exact Figma owner, copy, and server action`, async ({page}) => {
    const runtime = figmaStateRuntime[descriptor.name];
    await openState(page, descriptor, runtime.setup);

    const owner = page.locator(runtime.selector).first();
    await expect(owner).toBeVisible({timeout: 15_000});
    await expect(owner).toHaveAttribute(runtime.nodeAttribute, descriptor.nodeId);
    await expect(owner).toContainText(new RegExp(runtime.visibleCopy, "i"));

    const projection = fixtureAdapter.getProjection(descriptor.fixtureID);
    const projectedActionTypes = new Set([
      ...projection.turn.available_actions.map((action) => action.type),
      ...(projection.turn.combat?.resolution_action
        ? [projection.turn.combat.resolution_action.type]
        : []),
    ]);
    for (const actionType of descriptor.serverActions) {
      expect(projectedActionTypes, `${descriptor.name} must source ${actionType} from projection`)
        .toContain(actionType);
    }
    if (runtime.actionLabel) {
      await expect(page.getByRole(runtime.actionRole ?? "button", {name: runtime.actionLabel}).first())
        .toBeVisible();
    }
  });
}

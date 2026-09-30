import {composeStories, composeStory} from "@storybook/vue3-vite";
import {createApp, h, nextTick, shallowRef} from "vue";
import {describe, expect, it} from "vitest";
import {page, userEvent} from "vitest/browser";
import GameScreen from "../../src/screens/game/GameScreen.vue";
import * as interactionStories from "../../src/screens/game/InteractionScreen.stories";
import * as systemStories from "../../src/screens/game/SystemScreen.stories";
import * as tableStories from "../../src/screens/game/TableScreen.stories";
import {buildRouteSystemState} from "../../src/components/game/status/systemStateModel";
import {figmaStateDescriptors, figmaStateRuntime, type FigmaRuntimeSetup} from "../figmaStateMatrix";
import {fixtureAdapter} from "../fixtures/fixtureAdapter";
import {gameScreenArgs} from "../screenFixtures";
import {compact, renderStory, settle, visible, wide, type Viewport} from "./screen";

type ScreenArgs = ReturnType<typeof gameScreenArgs>;

const stories = {
  ...composeStories(tableStories),
  ...composeStories(interactionStories),
  ...composeStories(systemStories),
};

/** Renders GameScreen with explicit args and no play function. */
async function mount(args: ScreenArgs, viewport: Viewport): Promise<void> {
  await renderStory(composeStory({args}, {title: "Test/Semantics", component: GameScreen}), viewport);
}

async function click(selector: string, root: ParentNode = document): Promise<void> {
  await userEvent.click(visible(selector, root));
}

function openDialog(): HTMLDialogElement {
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  expect(dialogs).toHaveLength(1);
  return dialogs[0]!;
}

async function clickOption(root: ParentNode, name: RegExp): Promise<void> {
  const option = [...root.querySelectorAll<HTMLElement>("[role=option]")]
    .find((element) => element.checkVisibility() && name.test(element.textContent ?? ""));
  expect(option, String(name)).toBeDefined();
  await userEvent.click(option!);
}

/** The same user steps the removed app-level suite took to reach each Figma state. */
async function reach(setup: FigmaRuntimeSetup): Promise<void> {
  switch (setup) {
    case "hand":
      await click(".game-table__hand header button");
      return;
    case "fast-equip":
      await click(".mobile-game-table__dock-hand");
      await clickOption(openDialog(), /Учебный шлем/);
      return;
    case "character":
    case "exact-equip":
    case "gift":
      await click(".game-table__character, .mobile-game-table__dock-character");
      if (setup === "exact-equip") {
        await userEvent.click(openDialog().querySelector(".equipment-slot")!);
      } else if (setup === "gift") {
        await click(".character-equipment__summary-carried", openDialog());
        const tab = [...openDialog().querySelectorAll<HTMLElement>("[role=tab]")]
          .find((element) => element.textContent?.includes("подарок"));
        expect(tab).toBeDefined();
        await userEvent.click(tab!);
      }
      return;
    case "strength":
      await click(".game-table__strength");
      return;
    case "opponent":
      await userEvent.click(document.querySelector(".opponent-tile")!);
      return;
    case "board":
    case "loading":
    case "auth":
    case "unavailable":
    case "reconnecting":
    case "connection-failed":
    case "stale-choice":
      // Reached through the story's route/connection args; no user step.
      return;
  }
}

describe("Figma state owners", () => {
  const states = figmaStateDescriptors.map((descriptor) => [descriptor.name, descriptor] as const);
  it.each(states)("%s mounts its exact Figma owner, copy and server action", async (_name, descriptor) => {
    const runtime = figmaStateRuntime[descriptor.name];
    const args = stories[descriptor.name].args as ScreenArgs;
    if ("projection" in args.routeState) {
      // Transport-free states render exactly the descriptor fixture.
      expect(args.routeState.projection).toEqual(fixtureAdapter.getProjection(descriptor.fixtureID));
    }
    await mount(args, runtime.viewport === "compact" ? compact : wide);
    await reach(runtime.setup);
    await settle();

    const owner = document.querySelector<HTMLElement>(runtime.selector);
    expect(owner, runtime.selector).not.toBeNull();
    await expect.element(owner!).toBeVisible();
    expect(owner!.getAttribute(runtime.nodeAttribute)).toBe(descriptor.nodeId);
    expect(owner!.textContent).toMatch(new RegExp(runtime.visibleCopy, "i"));

    const projection = fixtureAdapter.getProjection(descriptor.fixtureID);
    const projectedActionTypes = new Set([
      ...projection.turn.available_actions.map((action) => action.type),
      ...(projection.turn.combat?.resolution_action ? [projection.turn.combat.resolution_action.type] : []),
    ]);
    for (const actionType of descriptor.serverActions) {
      expect(projectedActionTypes, `${descriptor.name} must source ${actionType} from projection`).toContain(actionType);
    }
    if (runtime.actionLabel) {
      await expect.element(page.getByRole(runtime.actionRole ?? "button", {name: runtime.actionLabel}).first()).toBeVisible();
    }
  });
});

describe("death-loot server closure", () => {
  it.each([["wide", wide], ["compact", compact]] as const)(
    "%s: a projection without the window removes the loot surface and its controls",
    async (_name, viewport) => {
      await page.viewport(viewport.width, viewport.height);
      document.body.innerHTML = "";
      const open = gameScreenArgs("death-loot");
      if (!("projection" in open.routeState) || !open.routeState.projection.interaction) {
        throw new Error("death-loot fixture must expose the actor window");
      }
      const pick = open.routeState.projection.interaction.actions[0]!;
      const closedProjection = structuredClone(open.routeState.projection);
      closedProjection.version += 1;
      delete closedProjection.interaction;

      const args = shallowRef<ScreenArgs>(open);
      const host = document.createElement("div");
      document.body.append(host);
      const app = createApp({
        render: () => h("div", {class: "app-shell"}, h("main", {id: "main-content", class: "app-main"}, h(GameScreen, args.value))),
      });
      app.mount(host);
      try {
        await nextTick();
        const surface = viewport === compact ? "[data-testid='death-loot-surface']" : ".game-table__death-loot";
        await clickOption(visible(surface), /Плащ обходчика/);
        await userEvent.click(page.getByRole("button", {name: /^Забрать (выбранную )?карту$/}));
        expect(open["onSubmit-interaction"]).toHaveBeenCalledExactlyOnceWith(pick);

        // The server answers with a newer projection whose priority window is closed.
        // GameScreen no longer renders a focused closure notice (removed in f828536), so only
        // the removal of the stale surface is asserted here.
        args.value = {
          ...open,
          routeState: buildRouteSystemState({hydrated: true, loading: false, projection: closedProjection, errorKind: null}),
        };
        await nextTick();
        await settle();

        expect(document.querySelector("[data-testid='death-loot-surface'], .game-table__death-loot, dialog[open]")).toBeNull();
        expect(document.body.textContent).not.toMatch(/Забрать (выбранную )?карту|Плащ обходчика/);
        expect([...document.querySelectorAll(".game-table")].filter((table) => table.checkVisibility())).toHaveLength(1);
        expect(open["onSubmit-interaction"]).toHaveBeenCalledOnce();
      } finally {
        app.unmount();
      }
    },
  );
});

describe("economy turn actions", () => {
  it.each([["wide", wide], ["compact", compact]] as const)("%s: sale enables and submits only the selected projected cards", async (_name, viewport) => {
    const args = gameScreenArgs("economy-actions");
    await mount(args, viewport);
    await click(".game-table__character, .mobile-game-table__dock-character");
    const carried = [...openDialog().querySelectorAll<HTMLElement>("button")].find((button) =>
      button.checkVisibility() && (viewport === compact ? /В РЮКЗАКЕ/ : /ПЕРЕНОСИМЫЕ ВЕЩИ/).test(button.textContent ?? ""));
    expect(carried).toBeDefined();
    await userEvent.click(carried!);
    const sheet = openDialog();
    const tab = [...sheet.querySelectorAll<HTMLElement>("[role=tab]")].find((element) => element.textContent?.startsWith("Продать предметы"));
    expect(tab).toBeDefined();
    await userEvent.click(tab!);
    const submit = page.getByRole("button", {name: "Продать предметы", exact: true});
    await expect.element(submit).toBeDisabled();
    await clickOption(openDialog(), /Старый шлем/);
    await clickOption(openDialog(), /Передаваемый фонарь/);
    await expect.element(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(args.onExecute).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({action: expect.objectContaining({type: "sell_items"})}),
      {instance_ids: ["equipped-sale-item", "transfer-card-1"]},
    );
  });
});

import {composeStory} from "@storybook/vue3-vite";
import {afterEach, describe, expect, it, vi} from "vitest";
import {page, userEvent} from "vitest/browser";
import GameScreen from "../../src/screens/game/GameScreen.vue";
import lobbyMeta from "../../src/screens/lobby/LobbyScreen.stories";
import LobbyScreen from "../../src/screens/lobby/LobbyScreen.vue";
import {gameScreenArgs} from "../screenFixtures";
import {
  box,
  compact,
  expectHorizontalContainment,
  expectNoDocumentVerticalOverflow,
  expectNoIntersections,
  expectNoRootOverflow,
  renderFixture,
  renderStory,
  visible,
  wide,
  type Viewport,
} from "./screen";

// Default frames of the former Playwright projects (chromium, -tablet, -mobile) for checks without their own viewport.
const projectViewports = [[1280, 720], [599, 720], [320, 720]] as const;

afterEach(() => {
  document.documentElement.style.fontSize = "";
});

/** Like renderFixture, but also accepts fixtures whose screen is a system surface instead of the table. */
async function renderScreen(fixtureID: string, viewport: Viewport): Promise<HTMLElement> {
  await renderStory(composeStory({args: gameScreenArgs(fixtureID)}, {title: "Test/Screen", component: GameScreen}), viewport);
  return visible(".game-table, .system-state-surface");
}

/** The bare lobby: its stories only accept their own 1440/360 frames. */
async function renderLobby(viewport: Viewport): Promise<void> {
  await renderStory(
    composeStory({args: lobbyMeta.args, parameters: lobbyMeta.parameters}, {title: "Test/Lobby", component: LobbyScreen}),
    viewport,
  );
}

function expectPresenter(table: HTMLElement, width: number): void {
  const mobile = width < 1024;
  visible(mobile ? ".mobile-game-header" : ".desktop-game-header", table);
  expect(table.querySelector(mobile ? ".desktop-game-header" : ".mobile-game-header")?.checkVisibility() ?? false).toBe(false);
}

function button(root: HTMLElement, name: string | RegExp) {
  return page.elementLocator(root).getByRole("button", {name, exact: true});
}

function centerOffset(element: Element, center: number): number {
  const {x, width} = box(element);
  return Math.abs(x + width / 2 - center);
}

describe("desktop table layout", () => {
  it("1440x900 keeps the exact desktop region grid", async () => {
    const table = await renderFixture("full-roster-combat", wide);

    expect(table.dataset.figmaDesktopNode).toBe("248:5");
    expect(box(visible(".desktop-game-header", table))).toMatchObject({x: 16, y: 16, width: 1408, height: 56});
    const regions = [".game-table__opponents", ".game-table__stage", ".game-table__hand", ".game-table__sidebar"]
      .map((selector) => visible(selector, table));
    expect(regions.map(box)).toMatchObject([
      {x: 16, y: 88, width: 248, height: 796},
      {x: 280, y: 88, width: 768, height: 502},
      {x: 280, y: 606, width: 768, height: 278},
      {x: 1064, y: 88, width: 360, height: 796},
    ]);
    expectNoIntersections(regions);
    const stage = box(regions[1]!);
    const selected = box(visible(".game-table__selected-encounter", table));
    expect(Math.abs((selected.x + selected.width / 2) - (stage.x + stage.width / 2))).toBeLessThanOrEqual(1);
    expectNoRootOverflow();
    expectNoDocumentVerticalOverflow();
  });
});

describe("responsive table layout", () => {
  const responsiveViewports = [
    [360, 640], [394, 800], [428, 926], [514, 900], [599, 900], [600, 900], [601, 900],
    [667, 375], [684, 900], [768, 1024], [896, 900], [1023, 768], [1024, 768], [1025, 768],
    [1152, 800], [1280, 720], [1340, 800], [1400, 900], [1660, 1000], [1920, 1080],
  ] as const;

  it.each(responsiveViewports)("%ix%i stays playable without horizontal escape", async (width, height) => {
    const table = await renderFixture("full-roster-combat", {width, height});
    expectPresenter(table, width);
    expectNoRootOverflow();
    expectHorizontalContainment(table);
    const primary = button(table, "Завершить бой");
    await expect.element(primary).toBeVisible();
    await expect.element(primary).toBeEnabled();

    if (width < 1024) {
      const regions = [".mobile-game-header", ".game-table__opponents", ".game-table__stage", ".mobile-game-table__dock"]
        .map((selector) => visible(selector, table));
      regions.forEach(expectHorizontalContainment);
      expectNoIntersections(regions);
      const [header, , stage, dock] = regions;
      expect(centerOffset(visible(".mobile-game-header__strength", header), width / 2)).toBeLessThanOrEqual(1);
      expect(centerOffset(visible(".game-table__selected-encounter", stage), width / 2)).toBeLessThanOrEqual(1);
      const dockBox = box(dock!);
      expect(height - (dockBox.y + dockBox.height)).toBe(width < 600 ? 24 : 16);
      expect(getComputedStyle(dock!).position).toBe("fixed");
    } else {
      const regions = [".game-table__opponents", ".game-table__stage", ".game-table__hand", ".game-table__sidebar"]
        .map((selector) => visible(selector, table));
      regions.forEach(expectHorizontalContainment);
      expectNoIntersections(regions);
    }
  });

  const exactBoundaryWidths = [
    373, 374, 375, 426, 427, 428, 598, 599, 600, 766, 767, 768,
    1022, 1023, 1024, 1278, 1279, 1280, 1438, 1439, 1440, 1899, 1900, 1901,
  ] as const;

  it.each(exactBoundaryWidths)("%ipx boundary keeps dense, multi-action, and open-sheet states contained", async (width) => {
    for (const fixtureID of ["full-roster-long-copy", "card-action-rail"]) {
      const table = await renderFixture(fixtureID, {width, height: 900});
      expectNoRootOverflow();
      expectNoDocumentVerticalOverflow();
      expectPresenter(table, width);
      expectHorizontalContainment(table);
    }

    const table = await renderFixture("full-roster-combat", {width, height: 900});
    await userEvent.click(width < 1024
      ? button(visible(".mobile-game-table__dock", table), "Персонаж")
      : page.elementLocator(visible(".game-table__character", table)));
    const dialog = await vi.waitFor(() => visible("dialog[open]"));
    expectHorizontalContainment(dialog);
    expectNoRootOverflow();
  });

  const nextMonsterViewports = [
    [360, 640], [428, 926], [600, 900], [768, 1024], [1023, 768], [1024, 768], [1280, 720], [1400, 900], [1920, 1080],
  ] as const;

  it.each(nextMonsterViewports)("next-monster choice stays selectable at %ix%i", async (width, height) => {
    const table = await renderFixture("run-away-next-monster", {width, height});
    expectNoRootOverflow();
    if (width < 1024) {
      const dialog = visible("dialog[data-figma-owner='game-modal:run-away-next'][open]");
      expectHorizontalContainment(dialog);
      const confirm = button(dialog, "Подтвердить");
      await expect.element(confirm).toBeDisabled();
      await userEvent.click(button(dialog, /Сторожевой слизень/));
      await expect.element(confirm).toBeEnabled();
      expect(getComputedStyle(visible(".mobile-game-table__dock", table)).position).toBe("fixed");
    } else {
      const surface = visible(".game-table__run-away-next", table);
      expectHorizontalContainment(surface);
      const confirm = button(visible(".game-table__action-panel", table), "Подтвердить");
      await expect.element(confirm).toBeDisabled();
      await userEvent.click(button(surface, /Костяной курьер/));
      await expect.element(confirm).toBeEnabled();
      expectNoIntersections([".game-table__opponents", ".game-table__stage", ".game-table__sidebar"]
        .map((selector) => visible(selector, table)));
    }
  });

  it("360x640 keeps the canonical compact frame and bottom safe padding", async () => {
    const table = await renderFixture("full-roster-combat", compact);
    expectPresenter(table, compact.width);
    expect(table.dataset.figmaCompactNode).toBe("147:731");
    expect([".mobile-game-header", ".game-table__opponents", ".game-table__stage", ".mobile-game-table__dock"]
      .map((selector) => box(visible(selector, table)))).toMatchObject([
      {x: 14, y: 12, width: 332, height: 32},
      {x: 14, y: 52, width: 332, height: 38},
      {x: 14, y: 98, width: 332, height: 416},
      {x: 16, y: 554, width: 328, height: 62},
    ]);
    expect(table.querySelectorAll(".opponent-tile")).toHaveLength(3);
    expectNoRootOverflow();
    expectNoDocumentVerticalOverflow();
  });

  it.each([["opponents-one", 1], ["mobile-combat-multiple", 2], ["opponents-three", 3]] as const)(
    "compact opponent row of %s uses Count=%i without clipping",
    async (fixtureID, count) => {
      const table = await renderFixture(fixtureID, {width: 428, height: 926});
      const chips = [...table.querySelectorAll<HTMLElement>(".opponent-tile")];
      expect(chips).toHaveLength(count);
      expect(chips.every((chip) => chip.checkVisibility())).toBe(true);
      expectNoIntersections(chips);
    },
  );

  it("run-away sheet keeps its Figma width tokens across compact viewports", async () => {
    for (const [width, height, expectedWidth] of [[600, 900, 560], [360, 640, 360]] as const) {
      await renderFixture("single-run-away", {width, height});
      expect(box(visible("dialog[open]")).width).toBe(expectedWidth);
    }
  });
});

describe("paper foundation", () => {
  it("paper token foundation fits the 360x640 lobby shell", async () => {
    await renderLobby(compact);
    const root = getComputedStyle(document.documentElement);
    expect(root.colorScheme).toContain("light");
    expect(root.getPropertyValue("--color-canvas").trim()).toBe("#f6f3ec");
    expect(root.getPropertyValue("--breakpoint-mobile-max").trim()).toBe("374px");
    expect(Number.parseFloat(getComputedStyle(document.body).minHeight)).toBeGreaterThanOrEqual(640);
    expectNoRootOverflow();
  });

  it("game fixture inherits the paper foundation without document overflow", async () => {
    const table = await renderFixture("single-combat", compact);
    const root = getComputedStyle(document.documentElement);
    expect(root.colorScheme).toContain("light");
    expect(root.getPropertyValue("--color-canvas").trim()).toBe("#f6f3ec");
    expect(getComputedStyle(table).minWidth).toBe("0px");
    expectNoRootOverflow();
  });
});

describe("interaction screens stay inside the viewport", () => {
  // Every state the former death-loot, advanced-combat, target-run-away and player-economy specs checked for root overflow.
  const overflowFixtures = [
    "death-loot", "death-loot-observer", "death-loot-single",
    "advanced-combat", "advanced-observer",
    "target-initiator", "target-response", "run-away-observer",
    "economy-actions", "charity-transfer", "theft-response",
  ];

  it.each(overflowFixtures.flatMap((fixtureID) => projectViewports.map(([width, height]) => [fixtureID, width, height] as const)))(
    "%s at %ix%i has no root overflow",
    async (fixtureID, width, height) => {
      await renderScreen(fixtureID, {width, height});
      expectNoRootOverflow();
    },
  );

  it.each(projectViewports)("all-pass terminal stays contained at 200 percent zoom at %ix%i", async (width, height) => {
    expect((await renderScreen("death-loot-all-pass", {width, height})).dataset.state).toBe("death-recovery");
    document.documentElement.style.fontSize = "200%";
    expectNoRootOverflow();
  });
});

describe("lobby layout", () => {
  it.each(projectViewports)("lobby stays within the %ix%i viewport, also at 200 percent zoom", async (width, height) => {
    await renderLobby({width, height});
    expectNoRootOverflow();
    document.documentElement.style.fontSize = "200%";
    expectNoRootOverflow();
    await expect.element(page.getByRole("textbox", {name: "Твоё имя"})).toBeVisible();
  });

  it.each([[360, 640], [1024, 768], [1440, 900]] as const)(
    "lobby copy and regions match the selected flow at %ipx",
    async (width, height) => {
      await renderLobby({width, height});
      // The compact hero hides its copy, so the heading is checked as text like the former toHaveText.
      const heading = document.querySelectorAll("#lobby-page-title");
      expect(heading).toHaveLength(1);
      expect(heading[0]!.textContent?.trim()).toBe("Собери друзей.Начни игру.");
      expect(document.querySelectorAll(".lobby-page__eyebrow")).toHaveLength(0);
      expect(heading[0]!.querySelectorAll("em, strong")).toHaveLength(0);
      expect(visible(".lobby-entry__header").textContent).toContain("Создай новую комнату или войди по приглашению.");
      for (const region of [visible(".lobby-page__hero"), visible(".lobby-entry")]) {
        const {x, width: regionWidth} = box(region);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + regionWidth).toBeLessThanOrEqual(width + 1);
      }
      expectNoRootOverflow();
    },
  );

  it("compact lobby keeps the focused field above the visual keyboard viewport", async () => {
    await renderLobby(compact);
    const input = visible(".lobby-form--create input[autocomplete='nickname']");
    input.focus();
    expect(document.activeElement).toBe(input);
    const {top, bottom} = input.getBoundingClientRect();
    expect(top).toBeGreaterThanOrEqual(0);
    expect(bottom).toBeLessThanOrEqual(window.visualViewport?.height ?? window.innerHeight);
  });
});

import {composeStories, composeStory} from "@storybook/vue3-vite";
import {afterEach, expect, it, vi} from "vitest";
import {commands, page, userEvent} from "vitest/browser";
import * as interactionStories from "../../src/screens/game/InteractionScreen.stories";
import * as systemStories from "../../src/screens/game/SystemScreen.stories";
import * as tableStories from "../../src/screens/game/TableScreen.stories";
import * as lobbyStories from "../../src/screens/lobby/LobbyScreen.stories";
import {compact, renderFixture, renderStory, settle, visible, wide, type Viewport} from "./screen";

const table = composeStories(tableStories);
const interaction = composeStories(interactionStories);
const system = composeStories(systemStories);
// The legacy lobby frames were the untouched entry screen, so the lobby renders without a play function.
const {beforeEach: _lobbyViewportGuard, ...lobbyMeta} = lobbyStories.default;
const lobby = (viewport: "wide" | "compact") =>
  composeStory({globals: {viewport: {value: viewport}}}, lobbyStories.default);

// Default Playwright project viewport of the legacy full-page feature snapshots.
const legacyFeature: Viewport = {width: 1280, height: 720};
// Countdowns are server-relative and elapse through performance.now(); the legacy suite froze its clock here.
const legacyClock = "2030-01-01T00:04:00.000Z";

type Capture = () => Promise<void>;
type PortableStory = {run: () => Promise<void>};

const story = (portable: PortableStory, viewport: Viewport): Capture => () => renderStory(portable, viewport);

function fixture(fixtureID: string, viewport: Viewport, open?: () => Promise<void>): Capture {
  return async () => {
    await renderFixture(fixtureID, viewport);
    if (open) {
      await open();
      await settle();
    }
  };
}

function openCharacter(node: string): () => Promise<void> {
  return async () => {
    await userEvent.click(visible(".game-table__character, .mobile-game-table__dock-character"));
    await expect.element(page.getByRole("dialog")).toHaveAttribute(
      window.innerWidth < 1024 ? "data-figma-compact-node" : "data-figma-desktop-node",
      node,
    );
  };
}

// Legacy frames were page screenshots; an inert fixed frame makes the element screenshot exactly the
// viewport, so content below the fold is neither captured nor replaced by blank runner pixels.
async function expectViewportScreenshot(name: string, fullPage: boolean): Promise<void> {
  if (fullPage) {
    // Playwright's fullPage frame: the viewport grows to the document height.
    await page.viewport(window.innerWidth, document.documentElement.scrollHeight);
    await settle();
  }
  const frame = document.createElement("div");
  frame.style.cssText = "position: fixed; inset: 0; pointer-events: none;";
  document.body.append(frame);
  await expect(page.elementLocator(frame)).toMatchScreenshot(name);
}

type Options = {clock?: string; fullPage?: true};
const fullPage: Options = {fullPage: true};

// Regression snapshots of Munchkin's own rendered screens, not a Figma pixel diff.
// Names are the legacy app-suite baselines; each case renders the same state at the same viewport.
const cases: [name: string, capture: Capture, options?: Options][] = [
  ["lobby-desktop", story(lobby("wide"), wide), fullPage],
  ["lobby-mobile", story(lobby("compact"), compact), fullPage],
  ["lobby-entry", story(composeStory({}, lobbyMeta), legacyFeature), fullPage],

  ["desktop-preparation", story(table.Preparation, wide)],
  ["desktop-door", story(table.DoorReady, wide)],
  ["desktop-combat-one", story(table.ActiveTurn, wide)],
  ["desktop-combat-multiple", story(table.RunAwayNextMonster, wide), {clock: "2030-01-01T00:04:40.000Z"}],
  ["desktop-reward", story(table.RewardReceived, wide)],
  ["desktop-run-away", story(table.RunAwayChoice, wide)],
  ["desktop-curse-result", story(table.CurseEffect, wide)],
  ["desktop-help-offer", story(interaction.HelpOffer, wide)],
  ["desktop-help-incoming", story(interaction.HelpIncoming, wide)],
  ["desktop-help-accepted", story(table.HelpAccepted, wide)],
  ["desktop-run-away-pending", story(interaction.RunAwayPending, wide)],
  ["desktop-run-away-success", story(table.RunAwaySuccess, wide)],
  ["desktop-run-away-failure", story(table.RunAwayFailure, wide)],
  ["desktop-end-turn-ready", story(table.EndTurnReady, wide)],
  ["desktop-waiting", story(system.Waiting, wide)],
  ["desktop-death", story(interaction.DeathLoot, wide)],
  ["desktop-victory", story(system.Victory, wide)],

  ["mobile-setup", story(table.PreparationCompact, compact)],
  ["mobile-door", story(table.DoorReadyCompact, compact)],
  ["mobile-combat-one", story(table.PostDoorChoiceCompact, compact)],
  ["mobile-combat-multiple", story(table.ActiveTurnCompact, compact)],
  ["mobile-reward", story(table.RewardReceivedCompact, compact)],
  ["mobile-run-away", story(table.NextRunAwayAttemptCompact, compact)],
  ["mobile-waiting", story(system.WaitingCompact, compact)],
  ["mobile-death", story(interaction.DeathLootCompact, compact)],

  ["desktop-character", fixture("full-roster-combat", wide, openCharacter("267:708"))],
  ["mobile-character", fixture("full-roster-combat", compact, openCharacter("165:42"))],
  ["desktop-fast-equip", story(table.HandFastEquip, wide)],
  ["mobile-fast-equip", story(table.HandFastEquipCompact, compact)],
  ["desktop-exact-equip", story(table.EquipmentSlotOpen, wide)],
  ["mobile-exact-equip", story(table.EquipmentSlotOpenCompact, compact)],
  ["desktop-charity-discard", story(interaction.CharityDiscard, wide)],
  ["mobile-charity-discard", story(interaction.CharityDiscardCompact, compact)],

  ["death-loot-actor", fixture("death-loot", wide), fullPage],
  ["advanced-combat", fixture("advanced-combat", legacyFeature), fullPage],
  ["player-economy-charity-transfer", fixture("charity-transfer", legacyFeature), fullPage],
  ["single-combat", fixture("single-combat", legacyFeature), fullPage],
  ["target-run-away", fixture("run-away-response", legacyFeature), fullPage],
];

afterEach(() => {
  vi.useRealTimers();
});

it.each(cases)("%s", async (name, capture, options = {}) => {
  // Date stays real: Vue's event-timestamp guard drops bubbled handlers when Date is frozen.
  vi.useFakeTimers({toFake: ["performance"], now: new Date(options.clock ?? legacyClock)});
  await capture();
  (document.activeElement as HTMLElement | null)?.blur();
  await commands.parkPointer();
  await expectViewportScreenshot(name, options.fullPage === true);
});

import {composeStories} from "@storybook/vue3-vite";
import {expect, it} from "vitest";
import {page} from "vitest/browser";
import * as tableStories from "../../src/screens/game/TableScreen.stories";
import {compact, renderStory, wide, type Viewport} from "./screen";

const table = composeStories(tableStories);

// Regression snapshots of Munchkin's own rendered screens, not a Figma pixel diff.
const cases: [name: string, story: {run: () => Promise<void>}, viewport: Viewport][] = [
  ["desktop-combat-one", table.ActiveTurn, wide],
  ["mobile-combat-multiple", table.ActiveTurnCompact, compact],
];

it.each(cases)("%s", async (name, story, viewport) => {
  await renderStory(story, viewport);
  (document.activeElement as HTMLElement | null)?.blur();
  await expect(page.elementLocator(document.body)).toMatchScreenshot(name);
});

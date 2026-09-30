import {composeStory} from "@storybook/vue3-vite";
import {expect} from "vitest";
import {page} from "vitest/browser";
import GameScreen from "../../src/screens/game/GameScreen.vue";
import {gameScreenArgs} from "../screenFixtures";

export type Viewport = {width: number; height: number};
export type Box = {x: number; y: number; width: number; height: number};
type PortableStory = {run: () => Promise<void>};

export const wide: Viewport = {width: 1440, height: 900};
export const compact: Viewport = {width: 360, height: 640};

/** Renders a portable story (including its play function) in a fixed frame. */
export async function renderStory(story: PortableStory, viewport: Viewport): Promise<void> {
  await page.viewport(viewport.width, viewport.height);
  // Dialogs and previous stories must not leak into the next frame.
  document.body.innerHTML = "";
  await story.run();
  await settle();
}

/** Renders GameScreen with a story fixture at an arbitrary viewport, without a play function. */
export async function renderFixture(fixtureID: string, viewport: Viewport): Promise<HTMLElement> {
  const story = composeStory(
    {args: gameScreenArgs(fixtureID)},
    {title: "Test/Fixture", component: GameScreen},
  );
  await renderStory(story, viewport);
  const tables = [...document.querySelectorAll<HTMLElement>(".game-table")]
    .filter((table) => table.checkVisibility());
  expect(tables).toHaveLength(1);
  return tables[0]!;
}

export async function settle(): Promise<void> {
  await document.fonts.ready;
  await Promise.all([...document.images].map((image) =>
    image.complete ? undefined : image.decode().catch(() => undefined)));
}

export function visible(selector: string, root: ParentNode = document): HTMLElement {
  const matches = [...root.querySelectorAll<HTMLElement>(selector)]
    .filter((element) => element.checkVisibility());
  expect(matches, selector).toHaveLength(1);
  return matches[0]!;
}

export function box(element: Element): Box {
  const {x, y, width, height} = element.getBoundingClientRect();
  return {x, y, width, height};
}

export function expectNoIntersections(elements: Element[]): void {
  const boxes = elements.map(box);
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left]!;
      const b = boxes[right]!;
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x &&
        a.y < b.y + b.height && a.y + a.height > b.y;
      expect(overlaps, `${elements[left]!.className} / ${elements[right]!.className}`).toBe(false);
    }
  }
}

export function expectHorizontalContainment(element: Element): void {
  const {x, width} = box(element);
  expect(x).toBeGreaterThanOrEqual(-0.5);
  expect(x + width).toBeLessThanOrEqual(window.innerWidth + 0.5);
}

export function expectNoRootOverflow(): void {
  const root = document.documentElement;
  expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth);
}

export function expectNoDocumentVerticalOverflow(): void {
  const root = document.documentElement;
  expect(root.scrollHeight).toBeLessThanOrEqual(root.clientHeight);
}

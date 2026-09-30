import {composeStories, composeStory} from "@storybook/vue3-vite";
import axe from "axe-core";
import {expect, it} from "vitest";
import GameScreen from "../../src/screens/game/GameScreen.vue";
import * as lobbyStories from "../../src/screens/lobby/LobbyScreen.stories";
import {fixtureAdapter} from "../fixtures/fixtureAdapter";
import {gameScreenArgs} from "../screenFixtures";
import {compact, renderStory, wide} from "./screen";

async function seriousViolations(): Promise<string[]> {
  const {violations} = await axe.run(document.body);
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

// Every fixture, including those that render a system surface instead of the table.
const fixtureCases = fixtureAdapter.list().flatMap(({id}) => [[id, "wide", wide], [id, "compact", compact]] as const);

it.each(fixtureCases)("axe serious and critical violations are absent: %s %s", async (fixtureID, _name, viewport) => {
  await renderStory(composeStory({args: gameScreenArgs(fixtureID)}, {title: "Test/A11y", component: GameScreen}), viewport);
  expect(await seriousViolations()).toEqual([]);
});

// Lobby stories run their play functions; each story's viewport guard rejects a wrong frame.
const lobbyCases = Object.entries(composeStories(lobbyStories))
  .map(([name, story]) => [name, story, name.endsWith("Compact") ? compact : wide] as const);

it.each(lobbyCases)("axe serious and critical violations are absent: lobby %s", async (_name, story, viewport) => {
  await renderStory(story, viewport);
  expect(await seriousViolations()).toEqual([]);
});

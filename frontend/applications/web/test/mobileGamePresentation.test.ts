import {describe, expect, it} from "vitest";

import {buildGamePresentation} from "../app/composables/useGamePresentation";
import {
  hasActionableDeadline,
  mobileEncounterCards,
  mobileOpponentStatus,
  mobileStateFamily,
} from "../app/components/game/mobile/mobileGameModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

describe("mobile game presentation", () => {
  it.each([
    ["single-setup", "setup"],
    ["single-preparation", "preparation"],
    ["single-door-choice", "door-choice"],
    ["single-combat", "combat"],
    ["single-run-away", "run-away"],
    ["single-charity", "charity"],
    ["single-finished", "finished"],
    ["stale-projection", "preparation"],
  ] as const)("maps %s to the named mobile state family", (fixtureID, family) => {
    const projection = fixtureAdapter.getProjection(fixtureID);

    expect(mobileStateFamily(projection)).toBe(family);
  });

  it("keeps authoritative actions and combat totals from the projection", () => {
    const projection = fixtureAdapter.getProjection("single-combat");
    const presentation = buildGamePresentation(projection);

    expect(presentation.turnActions.map(({action}) => action.type)).toEqual([
      "resolve_combat",
    ]);
    expect(presentation.combat).toMatchObject({
      kind: "active",
      combat: {
        player_strength: 4,
        monster_strength: 6,
        player_winning: false,
      },
    });
  });

  it("shows every public combat card without inventing a second total", () => {
    const projection = fixtureAdapter.getProjection("advanced-combat");
    const cards = mobileEncounterCards(projection);

    expect(cards.map((card) => card.instance_id)).toEqual([
      "encounter-monster",
      "paperwork-hydra-1",
    ]);
    expect(projection.turn.combat?.monster_strength).toBe(14);
  });

  it("exposes opponents as public summaries only", () => {
    const projection = fixtureAdapter.getProjection("full-roster-long-copy");
    const opponent = projection.players[0];

    expect(opponent).toBeDefined();
    expect(opponent?.hand_count).toBeGreaterThan(0);
    expect(Object.hasOwn(opponent ?? {}, "hand")).toBe(false);
    expect(mobileOpponentStatus(projection, opponent!)).toBe("ready");
  });

  it("only marks a server-projected response window as actionable deadline", () => {
    const noInteraction = fixtureAdapter.getProjection("single-combat");
    const withInteraction = fixtureAdapter.getProjection("interaction-material");

    expect(hasActionableDeadline(noInteraction)).toBe(false);
    expect(hasActionableDeadline(withInteraction)).toBe(true);
  });
});

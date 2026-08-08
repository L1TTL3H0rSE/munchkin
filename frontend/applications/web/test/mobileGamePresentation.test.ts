import {describe, expect, it} from "vitest";

import {
  buildGamePresentationModel,
  encounterCards,
  gameStateFamily,
  hasActionableDeadline,
  opponentStatus,
  projectedTurnActions,
} from "../app/components/game/gamePresentationModel";
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
    ["stale-projection", "combat"],
  ] as const)("maps %s to the named mobile state family", (fixtureID, family) => {
    const projection = fixtureAdapter.getProjection(fixtureID);

    expect(gameStateFamily(projection)).toBe(family);
  });

  it("keeps authoritative actions and combat totals from the projection", () => {
    const projection = fixtureAdapter.getProjection("single-combat");
    const presentation = buildGamePresentationModel(projection);

    expect(projectedTurnActions(projection).map((action) => action.type)).toEqual([
      "request_combat_resolution",
    ]);
    expect(projection.turn.combat).toMatchObject({
      player_strength: 4,
      monster_strength: 6,
      player_winning: false,
    });
    expect(presentation.primary.kind).toBe("combat");
  });

  it("shows every public combat card without inventing a second total", () => {
    const projection = fixtureAdapter.getProjection("advanced-combat");
    const cards = encounterCards(projection);

    expect(cards.map((card) => card.instance_id)).toEqual([
      "encounter-monster",
      "paperwork-hydra-1",
    ]);
    expect(projection.turn.combat?.monster_strength).toBe(14);
  });

  it("exposes opponents as public summaries only", () => {
    const projection = fixtureAdapter.getProjection("full-roster-long-copy");
    const opponent = projection.players.find((player) =>
      player.player_id !== projection.you.player_id,
    );

    expect(opponent).toBeDefined();
    expect(opponent?.hand_count).toBeGreaterThan(0);
    expect(Object.hasOwn(opponent ?? {}, "hand")).toBe(false);
    expect(opponentStatus(projection, opponent!)).toBe("ready");
  });

  it("only marks a server-projected response window as actionable deadline", () => {
    const noInteraction = fixtureAdapter.getProjection("single-combat");
    const withInteraction = fixtureAdapter.getProjection("interaction-material");

    expect(hasActionableDeadline(noInteraction)).toBe(false);
    expect(hasActionableDeadline(withInteraction)).toBe(true);
  });
});

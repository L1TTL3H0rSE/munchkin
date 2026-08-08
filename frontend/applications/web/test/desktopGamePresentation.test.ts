import {describe, expect, it} from "vitest";

import {
  buildGamePresentationModel,
  encounterCards,
  gameStateFamily,
  opponentStatus,
  projectedTurnActions,
} from "../app/components/game/gamePresentationModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

describe("desktop game presentation", () => {
  it.each([
    ["single-setup", "setup"],
    ["single-preparation", "preparation"],
    ["single-door-choice", "door-choice"],
    ["single-combat", "combat"],
    ["single-run-away", "run-away"],
    ["single-charity", "charity"],
    ["single-finished", "finished"],
    ["stale-projection", "combat"],
  ] as const)("maps %s to the named desktop state family", (fixtureID, family) => {
    expect(gameStateFamily(fixtureAdapter.getProjection(fixtureID))).toBe(family);
  });

  it("keeps direct actions and server combat totals authoritative", () => {
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

  it("keeps separate public monster cards and does not infer a total", () => {
    const projection = fixtureAdapter.getProjection("advanced-combat");

    expect(encounterCards(projection).map((card) => card.instance_id)).toEqual([
      "encounter-monster",
      "paperwork-hydra-1",
    ]);
    expect(projection.turn.combat?.monster_strength).toBe(14);
  });

  it("exposes only public opponent summary fields", () => {
    const projection = fixtureAdapter.getProjection("full-roster-long-copy");
    const opponent = projection.players.find((player) =>
      player.player_id !== projection.you.player_id,
    );

    expect(opponent).toBeDefined();
    expect(opponent?.hand_count).toBeGreaterThan(0);
    expect(Object.hasOwn(opponent ?? {}, "hand")).toBe(false);
    expect(opponentStatus(projection, opponent!)).toBe("ready");
  });
});

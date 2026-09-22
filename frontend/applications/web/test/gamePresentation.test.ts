import {describe, expect, it} from "vitest";

import {
  buildGamePresentationModel,
  hasActionableDeadline,
  projectedTurnActions,
} from "../../../packages/components/src/components/game/gamePresentationModel";
import {fixtureAdapter} from "../../../packages/components/test/fixtures/fixtureAdapter";

describe("game presentation model", () => {
  it("maps every actor-safe fixture into explicit state families", () => {
    for (const fixture of fixtureAdapter.list()) {
      const presentation = buildGamePresentationModel(fixture.projection);
      expect(presentation.family).toBeDefined();
      expect(presentation.primary.kind).toBeDefined();
      expect(presentation.desktopNodeID).toBeTruthy();
      expect(presentation.mobileNodeID).toBeTruthy();
    }
  });

  it("keeps authoritative combat and multiple monsters separate", () => {
    const projection = fixtureAdapter.getProjection("advanced-combat");
    const presentation = buildGamePresentationModel(projection);

    expect(presentation.family).toBe("combat");
    expect(presentation.primary.kind).toBe("combat");
    expect(presentation.encounterCards).toHaveLength(2);
    expect(projection.interaction?.actions).toHaveLength(5);
  });

  it("does not enable interaction actions for an observer projection", () => {
    const projection = fixtureAdapter.getProjection("advanced-observer");
    expect(projection.interaction?.actions ?? []).toHaveLength(0);
    expect(hasActionableDeadline(projection)).toBe(false);
  });

  it("retains server actions without inferring them from the phase", () => {
    const projection = fixtureAdapter.getProjection("single-preparation");
    const before = JSON.stringify(projection);
    expect(projectedTurnActions(projection).map((action) => action.type))
      .toEqual(["open_door"]);
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("does not promote a retained combat detail over the current end-turn action", () => {
    const projection = fixtureAdapter.getProjection("end-turn-ready");
    expect(projection.turn.combat?.resolution_action).toBeDefined();
    expect(projectedTurnActions(projection)).toEqual(projection.turn.available_actions);
    expect(projectedTurnActions(projection).map((action) => action.type)).toEqual(["end_turn"]);
    const combat = fixtureAdapter.getProjection("full-roster-combat");
    expect(projectedTurnActions(combat).map((action) => action.type))
      .toContain("request_combat_resolution");
    for (const id of ["victory-six-player", "single-finished"]) {
      expect(projectedTurnActions(fixtureAdapter.getProjection(id))).toEqual([]);
    }
  });
});

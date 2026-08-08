import {describe, expect, it} from "vitest";

import {
  buildGamePresentationModel,
  hasActionableDeadline,
  projectedTurnActions,
} from "../app/components/game/gamePresentationModel";
import {
  advisoryRemainingMilliseconds,
  formatAdvisoryTime,
} from "../app/components/ui/advisoryTimerModel";
import {phaseLabel} from "../app/components/ui/phaseModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

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

  it("keeps timer presentation advisory and deterministic", () => {
    expect(advisoryRemainingMilliseconds(
      "2030-01-01T00:05:00.000Z",
      "2030-01-01T00:04:00.000Z",
      1_000,
      1_000,
    )).toBe(60_000);
    expect(formatAdvisoryTime(0)).toBe("Время вышло — ждём сервер");
    expect(formatAdvisoryTime(null)).toBe("Таймер недоступен");
    expect(phaseLabel("combat")).toBe("Бой");
  });
});

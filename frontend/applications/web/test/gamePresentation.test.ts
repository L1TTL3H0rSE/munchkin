import {describe, expect, it} from "vitest";

import {
  buildGamePresentation,
  useGamePresentation,
} from "../app/composables/useGamePresentation";
import {
  advisoryRemainingMilliseconds,
  formatAdvisoryTime,
} from "../app/components/ui/advisoryTimerModel";
import {phaseLabel} from "../app/components/ui/phaseModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

describe("game presentation model", () => {
  it("maps every actor-safe fixture into explicit state families", () => {
    for (const fixture of fixtureAdapter.list()) {
      const presentation = buildGamePresentation(fixture.projection);

      expect(presentation.status.kind).toBeDefined();
      expect(presentation.phase.kind).toBeDefined();
      expect(presentation.encounter.kind).toBeDefined();
      expect(presentation.combat.kind).toBeDefined();
      expect(presentation.runAway.kind).toBeDefined();
      expect(presentation.decision.kind).toBeDefined();
    }
  });

  it("keeps authoritative combat and multiple monsters separate", () => {
    const projection = fixtureAdapter.getProjection("advanced-combat");
    const presentation = buildGamePresentation(projection);

    expect(presentation.phase.kind).toBe("combat");
    expect(presentation.encounter.kind).toBe("card");
    expect(presentation.combat.kind).toBe("active");
    if (presentation.combat.kind !== "active") {
      throw new Error("expected active combat");
    }
    expect(presentation.combat.combat.monsters).toHaveLength(2);
    expect(presentation.interactionActions).toHaveLength(5);
  });

  it("does not enable interaction actions for an observer projection", () => {
    const projection = fixtureAdapter.getProjection("advanced-observer");
    const presentation = buildGamePresentation(projection);

    expect(presentation.interactionActions).toHaveLength(0);
    expect(presentation.hasActionableInteraction).toBe(false);
  });

  it("retains server actions without inferring them from the phase", () => {
    const projection = fixtureAdapter.getProjection("single-preparation");
    const before = JSON.stringify(projection);
    const presentation = buildGamePresentation(projection);

    expect(presentation.turnActions.map((entry) => entry.action.type))
      .toEqual(["open_door"]);
    expect(JSON.stringify(projection)).toBe(before);
  });

  it("exposes the same pure model through the composable", () => {
    const projection = fixtureAdapter.getProjection("single-finished");
    const presentation = useGamePresentation(projection);

    expect(presentation.value?.status.kind).toBe("finished");
    expect(presentation.value?.status.isFinished).toBe(true);
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

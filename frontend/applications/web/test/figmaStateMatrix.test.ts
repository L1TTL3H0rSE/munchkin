import {describe, expect, it} from "vitest";

import {
  actionCoverage,
  excludedFigmaSources,
  figmaCompactHandoffs,
  figmaDesktopStateNames,
  figmaFlowModes,
  figmaStateDescriptors,
  interactionCoverage,
  phaseCoverage,
  statusCoverage,
} from "../../../test/browser/figmaStateMatrix.ts";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

const fixtures = new Map(
  fixtureAdapter.list().map((fixture) => [fixture.id, fixture]),
);

describe("Figma state matrix", () => {
  it("keeps every source desktop state mapped to a parsed actor fixture", () => {
    expect(figmaStateDescriptors).toHaveLength(40);
    expect(new Set(figmaStateDescriptors.map((state) => state.nodeId)).size)
      .toBe(figmaStateDescriptors.length);

    for (const state of figmaStateDescriptors) {
      const fixture = fixtures.get(state.fixtureID);
      expect(fixture, state.name).toBeDefined();
      expect(fixture?.projection.you.player_id, state.name)
        .toBe("player_hero");
      expect(state.route).toBe("/game/:id");
    }

    expect(figmaDesktopStateNames).toHaveLength(figmaStateDescriptors.length);
  });

  it("exhaustively maps every exported server action to a fixture descriptor", () => {
    for (const [actionType, coverage] of Object.entries(actionCoverage)) {
      const fixture = fixtures.get(coverage.fixtureID);
      expect(fixture, actionType).toBeDefined();
      expect(
        fixture?.projection.turn.available_actions.some((action) =>
          action.type === actionType,
        ),
        actionType,
      ).toBe(true);
      expect(coverage.semanticCheck).toContain("action-");
    }
  });

  it("covers every phase, status, interaction kind and flow-sheet mode", () => {
    for (const fixtureID of Object.values(phaseCoverage)) {
      expect(fixtures.has(fixtureID)).toBe(true);
    }
    for (const fixtureID of Object.values(statusCoverage)) {
      expect(fixtures.has(fixtureID)).toBe(true);
    }
    for (const fixtureID of Object.values(interactionCoverage)) {
      expect(fixtures.has(fixtureID)).toBe(true);
    }
    for (const mode of Object.values(figmaFlowModes)) {
      expect(fixtures.has(mode.fixtureID)).toBe(true);
    }
  });

  it("records the resolved compact and lobby source nodes without the excluded viewport", () => {
    expect(figmaCompactHandoffs.integratedStates.nodeId).toBe("147:671");
    expect(figmaCompactHandoffs.coreLoop.nodeId).toBe("160:1140");
    expect(figmaCompactHandoffs.lobbySelectedB.nodeId).toBe("225:14");
    expect(figmaCompactHandoffs.lobbyDesktopSelectedB.nodeId).toBe("240:50");
    expect([...figmaCompactHandoffs.integratedStates.fixtureIDs]).toContain("mobile-combat-multiple");
    expect(excludedFigmaSources).toEqual([
      expect.objectContaining({nodeId: "122:3", viewport: "360x800"}),
    ]);
    expect(excludedFigmaSources[0]?.reason).toContain("excluded");
  });
});

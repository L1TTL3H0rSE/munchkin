import {describe, expect, it} from "vitest";

import {
  actionCoverage,
  excludedFigmaSources,
  figmaCompactHandoffs,
  figmaAcceptanceReferences,
  figmaDesktopStateNames,
  figmaStateDescriptors,
  interactionCoverage,
  phaseCoverage,
  statusCoverage,
} from "../../../test/browser/figmaStateMatrix.ts";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";
import {buildGamePresentationModel} from "../app/components/game/gamePresentationModel";

const fixtures = new Map(
  fixtureAdapter.list().map((fixture) => [fixture.id, fixture]),
);

describe("Figma state matrix", () => {
  it("keeps every source desktop state mapped to a parsed actor fixture", () => {
    expect(figmaStateDescriptors).toHaveLength(43);
    expect(new Set(figmaStateDescriptors.map((state) => state.name)).size)
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

  it("records every direct frame used for side-by-side acceptance", () => {
    expect(figmaAcceptanceReferences.map((reference) => reference.nodeId)).toEqual([
      "228:14",
      "240:53",
      "147:731",
      "181:1634",
      "248:5",
      "253:96",
      "254:221",
      "258:2674",
      "285:1566",
      "267:708",
      "165:42",
      "271:3216",
      "166:42",
      "271:3010",
      "164:42",
      "291:1587",
      "340:3475",
      "342:3574",
      "256:316",
      "147:978",
      "174:1735",
    ]);
  });

  it.each([
    ["full-roster-combat", "248:5", "147:731"],
    ["single-door-choice", "285:1315", "181:1634"],
    ["single-run-away", "285:1473", "183:1671"],
    ["reward-received", "285:1566", "184:1687"],
    ["single-setup", "293:1617", "147:731"],
    ["run-away-success", "294:1998", "183:1671"],
    ["stale-projection", "257:447", "147:1082"],
  ])("maps runtime fixture %s to its desktop and compact Figma owners", (
    fixtureID,
    desktopNodeID,
    mobileNodeID,
  ) => {
    const fixture = fixtures.get(fixtureID);
    expect(fixture).toBeDefined();
    const model = buildGamePresentationModel(fixture!.projection);
    expect(model.desktopNodeID).toBe(desktopNodeID);
    expect(model.mobileNodeID).toBe(mobileNodeID);
  });

  it("exhaustively maps every exported server action to a fixture descriptor", () => {
    for (const [actionType, coverage] of Object.entries(actionCoverage)) {
      if (coverage.source === "not_projected") {
        expect(coverage.fixtureID, actionType).toBeUndefined();
        expect(coverage.semanticCheck, actionType).toContain("not-projected");
        expect([...fixtures.values()].some((fixture) =>
          fixture.projection.turn.available_actions.some((action) => action.type === actionType) ||
          fixture.projection.turn.combat?.resolution_action?.type === actionType,
        ), actionType).toBe(false);
        continue;
      }
      const fixture = fixtures.get(coverage.fixtureID);
      expect(fixture, actionType).toBeDefined();
      if (coverage.source === "combat_resolution") {
        expect(fixture?.projection.turn.combat?.resolution_action?.type, actionType)
          .toBe(actionType);
      } else {
        expect(
          fixture?.projection.turn.available_actions.some((action) =>
            action.type === actionType,
          ),
          actionType,
        ).toBe(true);
      }
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
  });

  it("records the resolved compact and lobby source nodes without the excluded viewport", () => {
    expect(figmaCompactHandoffs.integratedStates.nodeId).toBe("147:731");
    expect(figmaCompactHandoffs.coreLoop.nodeId).toBe("181:1634");
    expect(figmaCompactHandoffs.lobbySelectedB.nodeId).toBe("228:14");
    expect(figmaCompactHandoffs.lobbyDesktopSelectedB.nodeId).toBe("240:53");
    expect([...figmaCompactHandoffs.integratedStates.fixtureIDs]).toContain("mobile-combat-multiple");
    expect(excludedFigmaSources).toEqual([]);
  });
});

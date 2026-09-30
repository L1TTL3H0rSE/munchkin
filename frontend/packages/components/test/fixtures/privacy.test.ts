import {describe, expect, it} from "vitest";

import {projectionSchema} from "@munchkin/contracts";

import {fixtureAdapter} from "./fixtureAdapter.ts";
import {parseFixtureProjection} from "./fixtureData.ts";

describe("UI fixture privacy boundary", () => {
  it("keeps foreign hands out of actor-specific public players", () => {
    const source = fixtureAdapter.getProjection("full-roster-combat");
    const foreignPlayer = source.players[0];
    if (!foreignPlayer) {
      throw new Error("fixture must include a foreign player");
    }

    const invalidProjection = {
      ...source,
      players: source.players.map((player, index) => index === 0
        ? {...player, hand: source.you.hand}
        : player),
    };

    expect(() => projectionSchema.parse(invalidProjection)).toThrow();
    expect(foreignPlayer).not.toHaveProperty("hand");
  });

  it("rejects credentials and internal event fields", () => {
    const source = fixtureAdapter.getProjection("single-combat");
    const invalidProjection = {
      ...source,
      credential: "fixture-secret-that-is-not-a-fixture",
      events: [],
    };

    expect(() => projectionSchema.parse(invalidProjection)).toThrow();
  });

  it("provides at least twenty parsed, actor-safe states", () => {
    const fixtures = fixtureAdapter.list();

    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    for (const fixture of fixtures) {
      expect(() => parseFixtureProjection(fixture.projection)).not.toThrow();
      expect(fixture.projection.you).toBeDefined();
      for (const player of fixture.projection.players) {
        expect(player).not.toHaveProperty("hand");
      }
    }
  });
});

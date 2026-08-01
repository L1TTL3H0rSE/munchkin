import {describe, expect, it} from "vitest";

import {fixtureAdapter} from "./fixtures/fixtureAdapter";
import {
  buildOwnZones,
  opponentDensity,
  publicCardsForOpponent,
  uniqueCards,
} from "../app/components/game/gameTableViewModel";

describe("game table view model", () => {
  it("deduplicates visible card instances while preserving first-seen order", () => {
    const cards = fixtureAdapter.get("single-combat").projection.you.hand;
    expect(uniqueCards([cards[0]!, cards[1]!, cards[0]!]).map((card) => card.instance_id))
      .toEqual([cards[0]!.instance_id, cards[1]!.instance_id]);
  });

  it("keeps opponent hand private while exposing public zones", () => {
    const projection = fixtureAdapter.get("full-roster-combat").projection;
    const opponent = projection.players[0]!;
    const publicCards = publicCardsForOpponent(opponent);

    expect(Object.keys(opponent)).not.toContain("hand");
    expect(publicCards.map((card) => card.instance_id))
      .toEqual(opponent.equipped.map((card) => card.instance_id));
    expect(publicCards).toEqual(expect.arrayContaining(opponent.equipped));
    expect(publicCards).toEqual(expect.arrayContaining(opponent.carried));
  });

  it("builds separate own zones and stable density buckets", () => {
    const projection = fixtureAdapter.get("single-combat").projection;
    const zones = buildOwnZones(projection);

    expect(Object.keys(zones)).toEqual([
      "equipped",
      "carried",
      "traits",
      "attachments",
      "persistent_curses",
    ]);
    expect(opponentDensity(1)).toBe("solo");
    expect(opponentDensity(3)).toBe("small");
    expect(opponentDensity(6)).toBe("full");
  });
});

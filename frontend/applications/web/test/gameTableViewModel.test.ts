import {describe, expect, it} from "vitest";

import {fixtureAdapter} from "./fixtures/fixtureAdapter";
import {publicCardsForOpponent, uniqueCards} from "../app/components/game/gameTableViewModel";
import {
  buildGamePresentationModel,
  selectPrimarySurface,
} from "../app/components/game/gamePresentationModel";

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

  it("selects exactly one primary surface with required decisions first", () => {
    const projection = structuredClone(
      fixtureAdapter.get("single-run-away").projection,
    );
    projection.turn.combat = structuredClone(
      fixtureAdapter.get("single-combat").projection.turn.combat,
    );
    projection.turn.resolving = [projection.turn.encounter!];
    projection.turn.pending_decision = {
      type: "effect_choice",
      source_instance_id: projection.turn.encounter?.instance_id,
      options: ["left", "right"],
      minimum: 1,
      maximum: 1,
    };

    expect(selectPrimarySurface(projection)).toEqual({
      kind: "required-decision",
      optionCount: 2,
    });

    projection.turn.pending_decision = undefined;
    projection.turn.run_away!.completed = true;
    expect(selectPrimarySurface(projection)).toMatchObject({
      kind: "result",
      source: "run-away",
      escaped: false,
    });
  });

  it("derives the encounter pager from the active monster rather than opponents", () => {
    const projection = fixtureAdapter.get("run-away-result").projection;
    const model = buildGamePresentationModel(projection);

    expect(model.encounterCards).toHaveLength(2);
    expect(model.activeEncounterIndex).toBe(1);
    expect(model.encounterPage).toBe(2);
    expect(model.encounterPageCount).toBe(2);

    const withoutOpponents = structuredClone(projection);
    withoutOpponents.players = [];
    expect(buildGamePresentationModel(withoutOpponents)).toMatchObject({
      encounterPage: 2,
      encounterPageCount: 2,
    });
  });
});

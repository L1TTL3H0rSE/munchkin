import {describe, expect, it} from "vitest";

import {fixtureAdapter} from "./fixtures/fixtureAdapter";
import {
  charitySurfaceData,
  economyActions,
  ownCarriedCardsFor,
  ownHandCardsFor,
} from "../app/components/interaction/economyModel";

describe("player economy surface models", () => {
  it("keeps offer cards and theft costs actor-owned", () => {
    const projection = fixtureAdapter.getProjection("economy-actions");
    const entries = economyActions(projection.turn.available_actions);
    const gift = entries.find(({action}) => action.type === "propose_gift");
    const trade = entries.find(({action}) => action.type === "propose_trade");
    const theft = entries.find(({action}) => action.type === "attempt_theft");

    expect(gift && ownCarriedCardsFor(projection, gift.action).map((card) => card.instance_id))
      .toEqual(["transfer-card-1", "transfer-card-2"]);
    expect(trade?.action.requested_instance_ids).toEqual([
      "opaque-recipient-card-1",
      "opaque-recipient-card-2",
    ]);
    expect(theft && ownHandCardsFor(projection, theft.action).map((card) => card.instance_id))
      .toEqual(["hero-card-1", "hero-card-3"]);
    expect(ownCarriedCardsFor(projection, gift!.action)).not.toContainEqual(
      expect.objectContaining({instance_id: "opaque-recipient-card-1"}),
    );
  });

  it("keeps observer offer details opaque and charity exact", () => {
    const observer = fixtureAdapter.getProjection("economy-observer");
    expect(observer.interaction?.economy_offer).toBeUndefined();
    expect(observer.interaction?.actions).toEqual([]);

    const charity = fixtureAdapter.getProjection("charity-transfer");
    expect(charitySurfaceData(charity.interaction, undefined)).toEqual({
      excess: 2,
      instanceIDs: [
        "charity-card-1",
        "charity-card-2",
        "charity-card-3",
        "charity-card-4",
      ],
      eligibleRecipientIDs: ["player_1", "player_2"],
    });
  });

  it("exposes only an own counter descriptor in a theft response", () => {
    const projection = fixtureAdapter.getProjection("theft-response");
    const action = projection.interaction?.actions[0];

    expect(action).toMatchObject({
      source_instance_id: "counter-card",
      theft_capability: "counter_theft",
    });
    expect(projection.interaction?.economy_offer).toBeUndefined();
    expect(projection.players[0]).not.toHaveProperty("hand");
  });
});

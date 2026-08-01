import {describe, expect, it} from "vitest";

import {
  acceptedCombatHelper,
  helperOfferAction,
  helperOfferOptions,
  helperRewardsFor,
  isCombatantHelperOffer,
  isInvitedHelperOffer,
  projectedPlayerName,
} from "../app/components/interaction/helperOfferModel";
import {createFixtureAdapter} from "./fixtures/fixtureAdapter";

const fixtures = createFixtureAdapter();

describe("combat helper offer model", () => {
  it("derives only descriptor-backed helper and reward options", () => {
    const projection = fixtures.getProjection("helper-offer");
    const interaction = projection.interaction;
    if (!interaction) {
      throw new Error("helper offer fixture has no interaction");
    }

    const options = helperOfferOptions(interaction.actions);

    expect(isCombatantHelperOffer(interaction)).toBe(true);
    expect(options).toEqual([
      {helperPlayerID: "player_1", rewardTreasures: [1, 2]},
      {helperPlayerID: "player_2", rewardTreasures: [1]},
    ]);
    expect(helperRewardsFor(options, "player_1")).toEqual([1, 2]);
    expect(helperOfferAction(interaction.actions, "player_1", 2)?.action_id)
      .toBe("act_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(helperOfferAction(interaction.actions, "player_1", 9))
      .toBeUndefined();
    expect(projectedPlayerName(projection, "player_1")).toBe("Борис");
  });

  it("shows invited party terms only when the projection supplies them", () => {
    const invited = fixtures.getProjection("helper-invite");
    const invitedInteraction = invited.interaction;
    if (!invitedInteraction) {
      throw new Error("helper invite fixture has no interaction");
    }

    expect(isInvitedHelperOffer(invitedInteraction)).toBe(true);
    expect(invitedInteraction.combat_help_offer).toEqual({
      helper_player_id: "player_hero",
      reward_treasures: 2,
    });
    expect(projectedPlayerName(invited, invited.turn.player_id)).toBe("Борис");

    const observer = fixtures.getProjection("helper-observer");
    expect(isInvitedHelperOffer(observer.interaction)).toBe(false);
    expect(observer.interaction?.combat_help_offer).toBeUndefined();
    expect(helperOfferOptions(observer.interaction?.actions ?? [])).toEqual([]);
  });

  it("keeps accepted helper summary authoritative and immutable", () => {
    const projection = fixtures.getProjection("helper-accepted");

    expect(acceptedCombatHelper(projection)).toEqual({
      helperPlayerID: "player_hero",
      rewardTreasures: 2,
    });
    expect(projection.interaction).toBeUndefined();
  });
});

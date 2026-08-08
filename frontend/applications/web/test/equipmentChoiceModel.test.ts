import {describe, expect, it} from "vitest";

import {
  equipEntryFor,
  exactEquipCandidates,
  unequipEntryFor,
} from "../app/components/game/equipmentChoiceModel";
import {fixtureAdapter} from "./fixtures/fixtureAdapter";

describe("equipment choice model", () => {
  it("exposes only server-permitted cards for the selected equipment slot", () => {
    const projection = fixtureAdapter.getProjection("single-setup");

    expect(exactEquipCandidates(projection, "headgear").map((card) => card.instance_id))
      .toEqual(["setup-treasure-1"]);
    expect(exactEquipCandidates(projection, "armor").map((card) => card.instance_id))
      .toEqual(["setup-treasure-2"]);
    expect(exactEquipCandidates(projection, "hands").map((card) => card.instance_id))
      .toEqual(["setup-treasure-4"]);
  });

  it("finds only authoritative equip and unequip descriptors", () => {
    const projection = fixtureAdapter.getProjection("single-setup");
    expect(equipEntryFor(projection, "setup-treasure-1")?.action.type).toBe("equip_item");
    expect(equipEntryFor(projection, "setup-door-1")).toBeUndefined();

    projection.you.equipped = [{
      ...projection.you.hand[4]!,
      instance_id: "equipped-headgear",
    }];
    projection.turn.available_actions.push({
      type: "unequip_item",
      source_instance_id: "equipped-headgear",
    });
    expect(unequipEntryFor(projection, "equipped-headgear")?.action.type)
      .toBe("unequip_item");
  });
});

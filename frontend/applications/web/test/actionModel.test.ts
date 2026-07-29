import {describe, expect, it} from "vitest";
import {
  actionLabel,
  buildCommandPayload,
  reconcileActionState,
  selectionIsValid,
} from "../app/components/actionModel";
import {buildContentAssetURL} from "../app/composables/useGameApi";

describe("server-supplied action mapping", () => {
  it("maps a source and target without inventing authority fields", () => {
    const action = {
      type: "play_card" as const,
      source_instance_id: "stamped-exception-1",
      target_instance_ids: ["two-handed-sign-1"],
    };
    expect(buildCommandPayload(action, [], "two-handed-sign-1")).toEqual({
      instance_id: "stamped-exception-1",
      target_instance_id: "two-handed-sign-1",
    });
  });

  it("maps charity and effect choices to distinct typed fields", () => {
    const charity = {
      type: "resolve_charity" as const,
      instance_ids: ["card-a", "card-b", "card-c"],
      minimum: 2,
      maximum: 2,
    };
    expect(buildCommandPayload(charity, ["card-a", "card-c"])).toEqual({
      instance_ids: ["card-a", "card-c"],
    });

    const effect = {
      type: "choose_effect" as const,
      instance_ids: ["card-a", "card-b"],
      minimum: 1,
      maximum: 1,
    };
    expect(buildCommandPayload(effect, ["card-b"])).toEqual({
      choice_ids: ["card-b"],
    });
  });

  it("rejects forged, duplicate and incomplete selections locally", () => {
    const action = {
      type: "use_ability" as const,
      source_instance_id: "swift-courier-1",
      instance_ids: ["card-a", "card-b"],
      minimum: 1,
      maximum: 1,
      ability_index: 0,
    };
    expect(selectionIsValid(action, ["card-a"])).toBe(true);
    expect(selectionIsValid(action, [])).toBe(false);
    expect(selectionIsValid(action, ["forged"])).toBe(false);
    expect(selectionIsValid(action, ["card-a", "card-a"])).toBe(false);
    expect(() => buildCommandPayload(action, ["forged"])).toThrow();
  });

  it("enforces server-supplied sale totals", () => {
    const sale = {
      type: "sell_items" as const,
      instance_ids: ["cheap", "enough"],
      minimum: 1,
      maximum: 2,
      minimum_total: 1000,
      instance_values: {cheap: 400, enough: 600},
    };
    expect(selectionIsValid(sale, ["cheap"])).toBe(false);
    expect(selectionIsValid(sale, ["cheap", "enough"])).toBe(true);
  });

  it("drops selections and targets that disappeared from a new projection", () => {
    const selections = {
      "sell_items:::0": ["kept", "stale"],
      "old:::1": ["gone"],
    };
    const targets = {
      "sell_items:::0": "stale-target",
      "old:::1": "gone-target",
    };
    reconcileActionState([{
      type: "sell_items",
      instance_ids: ["kept"],
      target_instance_ids: ["new-target"],
    }], selections, targets);
    expect(selections).toEqual({"sell_items:::0": ["kept"]});
    expect(targets).toEqual({});
  });

  it("provides Russian labels for every core action", () => {
    expect(actionLabel({type: "open_door"})).toBe("Вышибить дверь");
    expect(actionLabel({type: "resolve_combat"})).toBe("Завершить бой");
    expect(actionLabel({type: "resolve_charity"})).toContain("благотворительность");
  });

  it("maps a pack-relative asset path to the protected HTTP route", () => {
    expect(buildContentAssetURL(
      "http://localhost:8080/",
      "demo original",
      "assets/cards/metro map.webp",
    )).toBe(
      "http://localhost:8080/api/v1/content/demo%20original/assets/cards/metro%20map.webp",
    );
  });
});

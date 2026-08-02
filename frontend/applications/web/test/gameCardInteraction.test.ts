import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";
import type {CardView} from "@munchkin/contracts";
import {
  actionMode,
  cardActionState,
  mapCardActions,
} from "../app/components/actionModel";
import {
  buildStrengthBreakdown,
} from "../app/components/game/gameTableViewModel";
import {
  parseGameProjection,
} from "../app/composables/useGameApi";
import {reconcileCardSelection} from "../app/composables/useCardSelection";

const card = (instanceID: string): CardView => ({
  instance_id: instanceID,
  definition_id: `definition-${instanceID}`,
  name: `Карта ${instanceID}`,
  deck: "treasure",
  kind: "item",
  value: 100,
});

describe("card-first action surface", () => {
  it("maps source and selectable card ids without changing descriptor indexes", () => {
    const cards = [card("play-me"), card("choose-me"), card("other")];
    const mapping = mapCardActions(cards, [
      {action: {type: "open_door"}, index: 0},
      {
        action: {
          type: "play_card",
          source_instance_id: "play-me",
        },
        index: 1,
      },
      {
        action: {
          type: "sell_items",
          instance_ids: ["choose-me", "other"],
          minimum: 1,
          maximum: 2,
        },
        index: 2,
      },
    ]);

    expect(mapping.cardBoundActionIndexes).toEqual(new Set([1, 2]));
    expect(mapping.byCard.get("play-me")?.[0]).toMatchObject({
      mode: "direct",
      cardInstanceID: "play-me",
      index: 1,
    });
    expect(mapping.byCard.get("choose-me")?.[0]).toMatchObject({
      mode: "contextual",
      cardInstanceID: "choose-me",
      index: 2,
    });
    expect(mapping.byCard.get("other")?.[0].index).toBe(2);
    expect(actionMode({type: "equip_item", source_instance_id: "other"}))
      .toBe("direct");
  });

  it("keeps every visible card state distinguishable", () => {
    const binding = {
      action: {type: "play_card" as const, source_instance_id: "card-1"},
      index: 0,
      cardInstanceID: "card-1",
      key: "play_card:card-1::0",
      mode: "direct" as const,
    };

    expect(cardActionState([], {
      busy: false,
      selected: false,
      pending: false,
      confirmed: false,
    })).toBe("idle");
    expect(cardActionState([binding], {
      busy: false,
      selected: false,
      pending: false,
      confirmed: false,
    })).toBe("available");
    expect(cardActionState([binding], {
      busy: false,
      selected: true,
      pending: false,
      confirmed: false,
    })).toBe("selected");
    expect(cardActionState([binding], {
      busy: true,
      selected: false,
      pending: true,
      confirmed: false,
    })).toBe("pending");
    expect(cardActionState([binding], {
      busy: true,
      selected: false,
      pending: false,
      confirmed: false,
    })).toBe("disabled");
    expect(cardActionState([binding], {
      busy: false,
      selected: false,
      pending: false,
      confirmed: true,
    })).toBe("confirmed");
  });

  it("keeps typed economy descriptors for the specialized surface", () => {
    const fixture = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "interaction-projection-v1.json",
      import.meta.url,
    ), "utf8")) as {
      turn: {available_actions: unknown[]};
    };
    fixture.turn.available_actions = [{
      type: "propose_trade",
    }];

    expect(parseGameProjection(fixture).turn.available_actions[0]?.type)
      .toBe("propose_trade");
  });

  it("clears a stale selected card while preserving a live card", () => {
    expect(reconcileCardSelection("card-1", ["card-1", "card-2"]))
      .toBe("card-1");
    expect(reconcileCardSelection("card-1", ["card-2"]))
      .toBeNull();
  });

  it("keeps authoritative strength and labels the unattributed remainder", () => {
    expect(buildStrengthBreakdown(14, [
      {id: "level", label: "Уровень", value: 2},
      {id: "sword", label: "Меч", value: 3},
    ])).toEqual([
      {id: "level", label: "Уровень", value: 2},
      {id: "sword", label: "Меч", value: 3},
      {id: "other-effects", label: "Прочие эффекты", value: 9},
    ]);
  });
});

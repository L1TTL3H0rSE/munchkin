import {readFileSync} from "node:fs";

import {describe, expect, it} from "vitest";
import {
  parseGameProjection,
} from "../app/composables/useGameApi";

describe("card-first action surface", () => {
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

});

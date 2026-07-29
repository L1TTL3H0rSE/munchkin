import { describe, expect, it } from "vitest";
import {
  invalidationSchema,
  projectionSchema,
} from "../src/index";

const projection = {
  game_id: "game_fixture",
  version: 4,
  status: "active",
  is_owner: true,
  you: {
    player_id: "player_a",
    name: "Alice",
    level: 1,
    combat_bonus: 0,
    hand: [{id: "wooden-spoon", name: "Wooden Spoon", kind: "treasure"}],
  },
  players: [
    {player_id: "player_a", name: "Alice", level: 1, combat_bonus: 0, hand_count: 1},
    {player_id: "player_b", name: "Bob", level: 1, combat_bonus: 0, hand_count: 4},
  ],
  turn: {
    player_id: "player_a",
    phase: "open_door",
    available_actions: ["open_door"],
  },
  door_deck_count: 8,
  treasure_deck_count: 8,
  content_set_id: "demo-original",
  content_version: 1,
};

describe("wire contracts", () => {
  it("accepts the privacy-safe projection fixture", () => {
    expect(projectionSchema.parse(projection).you.hand).toHaveLength(1);
  });

  it("rejects internal state and another hand", () => {
    expect(() => projectionSchema.parse({...projection, rng_state: 42})).toThrow();
    expect(() => projectionSchema.parse({
      ...projection,
      players: [{
        ...projection.players[1],
        hand: [{id: "secret", name: "Secret", kind: "treasure"}],
      }],
    })).toThrow();
  });

  it("accepts version-only invalidation and rejects payload state", () => {
    const event = {
      type: "game.v1.version_advanced",
      occurred_at: "2026-07-29T10:00:00.000Z",
      game_id: "game_fixture",
      version: 5,
      reason: "open_door",
    };
    expect(invalidationSchema.parse(event).version).toBe(5);
    expect(() => invalidationSchema.parse({...event, hand: []})).toThrow();
  });
});

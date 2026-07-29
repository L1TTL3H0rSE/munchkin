import {describe, expect, it} from "vitest";
import {
  actionViewSchema,
  commandPayloadSchema,
  invalidationSchema,
  projectionSchema,
} from "../src/index";

const item = {
  instance_id: "folding-umbrella-1",
  definition_id: "folding-umbrella",
  name: "Складной зонт",
  deck: "treasure",
  kind: "item",
  item_slot: "hands",
  item_size: "small",
  hands: 1,
  bonus: 2,
  value: 400,
};

const projection = {
  game_id: "game_fixture",
  version: 4,
  status: "active",
  is_owner: true,
  you: {
    player_id: "player_a",
    name: "Alice",
    level: 1,
    combat_strength: 1,
    escape_bonus: 0,
    hand_limit: 5,
    character_tags: null,
    hand: [item],
    carried: [],
    equipped: [],
    traits: [],
    attachments: [],
    persistent_curses: [],
    setup_done: false,
    dead: false,
    needs_redraw: false,
  },
  players: [
    {
      player_id: "player_a",
      name: "Alice",
      level: 1,
      hand_count: 1,
      carried: [],
      equipped: [],
      traits: [],
      attachments: [],
      persistent_curses: [],
      setup_done: false,
      dead: false,
    },
    {
      player_id: "player_b",
      name: "Bob",
      level: 1,
      hand_count: 8,
      carried: [],
      equipped: [],
      traits: [],
      attachments: [],
      persistent_curses: [],
      setup_done: false,
      dead: false,
    },
  ],
  turn: {
    player_id: "player_a",
    phase: "setup",
    resolving: [],
    available_actions: [
      {
        type: "play_card",
        source_instance_id: "folding-umbrella-1",
      },
      {type: "finish_setup"},
    ],
  },
  door_deck_count: 32,
  door_discard_count: 0,
  treasure_deck_count: 22,
  treasure_discard_count: 0,
  content_set_id: "demo-original",
  content_version: 2,
  rules_profile_id: "first-edition-core-v1",
  rules_profile_version: 1,
};

describe("wire contracts", () => {
  it("accepts the privacy-safe Go projection shape", () => {
    const parsed = projectionSchema.parse(projection);
    expect(parsed.you.hand).toHaveLength(1);
    expect(parsed.you.character_tags).toEqual([]);
    expect(parsed.turn.available_actions[0]?.type).toBe("play_card");
  });

  it("rejects internal state and another hand", () => {
    expect(() => projectionSchema.parse({...projection, rng_state: 42})).toThrow();
    expect(() => projectionSchema.parse({
      ...projection,
      players: [{
        ...projection.players[1],
        hand: [{...item, instance_id: "secret"}],
      }],
    })).toThrow();
  });

  it("accepts typed selection descriptors and rejects unknown commands", () => {
    expect(actionViewSchema.parse({
      type: "sell_items",
      instance_ids: ["one", "two"],
      minimum: 1,
      maximum: 2,
      minimum_total: 1000,
      instance_values: {one: 400, two: 600},
    }).minimum_total).toBe(1000);
    expect(commandPayloadSchema.parse({
      instance_ids: ["two", "one"],
      ability_index: 0,
    }).instance_ids).toEqual(["two", "one"]);
    expect(() => actionViewSchema.parse({type: "eval_card"})).toThrow();
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

import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import {
  actionViewSchema,
  combatHelpRequestSchema,
  combatResolutionRequestSchema,
  economyOfferRequestSchema,
  charityRequestSchema,
  commandPayloadSchema,
  interactionActionViewSchema,
  interactionCommandRequestSchema,
  invalidationSchema,
  projectionSchema,
  studioAPIErrorSchema,
  studioApproveRequestSchema,
  studioCompileRequestSchema,
  studioGenerateRequestSchema,
  studioJobSchema,
  theftRequestSchema,
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
    strength_breakdown: {
      base_strength: 1,
      equipment_bonus: 0,
      temporary_bonus: 0,
      total_strength: 1,
      hand_count: 1,
    },
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
    expect(actionViewSchema.parse({
      type: "propose_trade",
      instance_ids: ["offer-a"],
      requested_instance_ids: ["request-b"],
      target_player_ids: ["player_b"],
      minimum: 1,
      maximum: 1,
    }).requested_instance_ids).toEqual(["request-b"]);
  });

  it("keeps economy clauses typed and charity mappings authority-free", () => {
    expect(economyOfferRequestSchema.parse({
      expected_version: 12,
      recipient_player_id: "player_b",
      offered_instance_ids: ["item-a"],
      requested_instance_ids: ["item-b"],
    }).offered_instance_ids).toEqual(["item-a"]);
    expect(() => economyOfferRequestSchema.parse({
      expected_version: 12,
      recipient_player_id: "player_b",
      offered_instance_ids: ["item-a"],
      obligation: "pay later",
    })).toThrow();
    expect(charityRequestSchema.parse({
      expected_version: 13,
      allocations: [{
        instance_id: "item-a",
        recipient_player_id: "player_b",
      }],
    }).allocations).toHaveLength(1);
    expect(() => charityRequestSchema.parse({
      expected_version: 13,
      allocations: [{
        instance_id: "item-a",
        recipient_player_id: "player_b",
        recipient_hand: ["secret"],
      }],
    })).toThrow();
  });

  it("keeps theft victim public and hidden selection server-only", () => {
    expect(theftRequestSchema.parse({
      expected_version: 14,
      source_instance_id: "theft-class-1",
      ability_index: 0,
      cost_instance_ids: ["own-cost-1"],
      victim_player_id: "player_b",
    }).victim_player_id).toBe("player_b");
    expect(() => theftRequestSchema.parse({
      expected_version: 14,
      source_instance_id: "theft-class-1",
      ability_index: 0,
      cost_instance_ids: ["own-cost-1"],
      victim_player_id: "player_b",
      target_instance_id: "foreign-secret-1",
    })).toThrow();
    const theft = projectionSchema.parse({
      ...projection,
      rules_profile_id: "lobby-multiplayer-v3",
      turn: {...projection.turn, phase: "preparation"},
      interaction: {
        interaction_id: "interaction-theft",
        public_kind: "theft_response",
        parent_phase: "preparation",
        public_subject: "current_turn",
        status: "open",
        deadline_at: "2026-07-31T10:00:30.000Z",
        server_time: "2026-07-31T10:00:00.000Z",
        my_response_state: "pending",
        response_required_for_you: true,
        actions: [{
          action_id: `act_${"b".repeat(32)}`,
          interaction_id: "interaction-theft",
          revision: 1,
          type: "respond",
          source_instance_id: "own-counter-1",
          theft_capability: "counter_theft",
        }],
      },
    });
    expect(
      theft.interaction?.actions[0]?.theft_capability,
    ).toBe("counter_theft");
    expect(() => projectionSchema.parse({
      ...theft,
      interaction: {
        ...theft.interaction,
        victim_hand: ["foreign-secret-1"],
      },
    })).toThrow();
  });

  it("keeps death loot options private and descriptor-owned", () => {
    const deathLoot = projectionSchema.parse({
      ...projection,
      rules_profile_id: "lobby-multiplayer-v4",
      turn: {...projection.turn, phase: "charity"},
      interaction: {
        interaction_id: "interaction-death-loot",
        public_kind: "death_loot_priority",
        parent_phase: "charity",
        public_subject: "current_turn",
        status: "open",
        deadline_at: "2026-07-31T10:00:30.000Z",
        server_time: "2026-07-31T10:00:00.000Z",
        my_response_state: "pending",
        response_required_for_you: true,
        actions: [
          {
            action_id: `act_${"c".repeat(32)}`,
            interaction_id: "interaction-death-loot",
            revision: 1,
            type: "respond",
            choice_ids: [item.instance_id],
          },
          {
            action_id: `act_${"d".repeat(32)}`,
            interaction_id: "interaction-death-loot",
            revision: 1,
            type: "pass",
          },
        ],
        death_loot: {
          dead_player_id: "player_b",
          initial_count: 3,
          remaining_count: 3,
          picked_count: 0,
          discarded_count: 0,
          options: [item],
        },
      },
    });
    expect(deathLoot.interaction?.death_loot?.options).toHaveLength(1);
    const observer = projectionSchema.parse({
      ...deathLoot,
      interaction: {
        ...deathLoot.interaction,
        my_response_state: undefined,
        response_required_for_you: false,
        actions: [],
        death_loot: {
          ...deathLoot.interaction?.death_loot,
          options: [],
        },
      },
    });
    expect(observer.interaction?.death_loot?.remaining_count).toBe(3);
    expect(observer.interaction?.death_loot?.options).toEqual([]);
    expect(() => projectionSchema.parse({
      ...observer,
      interaction: {
        ...observer.interaction,
        death_loot: {
          ...observer.interaction?.death_loot,
          pool: ["foreign-hidden-card"],
        },
      },
    })).toThrow();
    expect(() => projectionSchema.parse({
      ...observer,
      interaction: {
        ...observer.interaction,
        seat_order: ["player_a"],
      },
    })).toThrow();
    expect(() => interactionCommandRequestSchema.parse({
      expected_version: deathLoot.version,
      interaction_id: "interaction-death-loot",
      action_id: `act_${"c".repeat(32)}`,
      intent: "respond",
      instance_id: item.instance_id,
    })).toThrow();
  });

  it("parses party-only economy and charity interaction DTOs strictly", () => {
    const economy = projectionSchema.parse({
      ...projection,
      rules_profile_id: "lobby-multiplayer-v2",
      interaction: {
        interaction_id: "interaction-economy",
        public_kind: "economy_offer",
        parent_phase: "preparation",
        public_subject: "current_turn",
        status: "open",
        deadline_at: "2026-07-31T10:00:30.000Z",
        server_time: "2026-07-31T10:00:00.000Z",
        response_required_for_you: false,
        actions: [{
          action_id: `act_${"a".repeat(32)}`,
          interaction_id: "interaction-economy",
          revision: 1,
          type: "cancel_offer",
        }],
        economy_offer: {
          kind: "gift",
          offerer_player_id: "player_a",
          recipient_player_id: "player_b",
          offered: [item],
          requested: [],
        },
      },
    });
    expect(economy.interaction?.economy_offer?.kind).toBe("gift");
    expect(() => projectionSchema.parse({
      ...economy,
      interaction: {
        ...economy.interaction,
        offered_instance_ids: ["private-clause"],
      },
    })).toThrow();

    const charity = projectionSchema.parse({
      ...projection,
      rules_profile_id: "lobby-multiplayer-v2",
      turn: {...projection.turn, phase: "charity"},
      interaction: {
        interaction_id: "interaction-charity",
        public_kind: "charity_transfer",
        parent_phase: "charity",
        public_subject: "current_turn",
        status: "open",
        deadline_at: "2026-07-31T10:00:30.000Z",
        server_time: "2026-07-31T10:00:00.000Z",
        my_response_state: "pending",
        response_required_for_you: true,
        actions: [],
        charity_transfer: {
          excess: 1,
          instance_ids: ["item-a"],
          eligible_recipient_ids: ["player_b"],
        },
      },
    });
    expect(charity.interaction?.charity_transfer?.excess).toBe(1);
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

  it("parses the Go-owned interaction projection without private state", () => {
    const fixture: unknown = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "interaction-projection-v1.json",
      import.meta.url,
    ), "utf8"));
    const parsed = projectionSchema.parse(fixture);
    const interaction = parsed.interaction;
    expect(interaction?.actions.map((action) => action.type))
      .toEqual(["pass", "respond"]);
    if (!interaction) {
      throw new Error("interaction fixture was not parsed");
    }
    expect(() => projectionSchema.parse({
      ...parsed,
      interaction: {
        ...interaction,
        eligible_actor_ids: ["player_b"],
      },
    })).toThrow();
    expect(() => projectionSchema.parse({
      ...parsed,
      interaction: {
        ...interaction,
        responses: {player_b: {state: "pending"}},
      },
    })).toThrow();
  });

  it("keeps interaction commands version-bound and authority-free", () => {
    const request = {
      expected_version: 7,
      interaction_id: "interaction_0123456789abcdef",
      action_id: "act_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      intent: "pass",
    };
    expect(interactionCommandRequestSchema.parse(request).intent).toBe("pass");
    expect(() => interactionCommandRequestSchema.parse({
      ...request,
      actor_id: "player_b",
    })).toThrow();
    expect(() => interactionCommandRequestSchema.parse({
      ...request,
      deadline_revision: 1,
    })).toThrow();
    expect(() => interactionCommandRequestSchema.parse({
      ...request,
      intent: "auto_resolve",
    })).toThrow();
    expect(combatResolutionRequestSchema.parse({
      expected_version: 7,
    }).expected_version).toBe(7);
    expect(() => combatResolutionRequestSchema.parse({
      expected_version: 7,
      actor_id: "player_a",
    })).toThrow();
  });

  it("accepts only actor-owned combat response descriptors", () => {
    const action = {
      action_id: "act_cccccccccccccccccccccccccccccccc",
      interaction_id: "interaction_combat",
      revision: 2,
      type: "respond",
      source_instance_id: "flash-mob-intervention-1",
      target: "player",
      combat_delta: 5,
    };
    expect(interactionActionViewSchema.parse(action).revision).toBe(2);
    expect(() => interactionActionViewSchema.parse({
      ...action,
      actor_id: "player_b",
    })).toThrow();
    expect(() => interactionActionViewSchema.parse({
      ...action,
      target: "arbitrary_player_id",
    })).toThrow();
    expect(() => interactionActionViewSchema.parse({
      ...action,
      realized_modifier: 999,
    })).toThrow();

    const parsed = projectionSchema.parse({
      ...projection,
      rules_profile_id: "lobby-multiplayer-v1",
    });
    expect(parsed.rules_profile_id).toBe("lobby-multiplayer-v1");

    const fixture: unknown = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "combat-response-projection-v1.json",
      import.meta.url,
    ), "utf8"));
    const combat = projectionSchema.parse(fixture);
    expect(combat.interaction?.public_kind).toBe("combat_response");
    expect(combat.interaction?.actions[1]).toMatchObject({
      revision: 1,
      source_instance_id: "flash-mob-intervention-1",
      target: "player",
      combat_delta: 5,
    });
  });

  it("keeps advanced combat targets closed, opaque, and server-projected", () => {
    const base = {
      action_id: "act_dddddddddddddddddddddddddddddddd",
      interaction_id: "interaction_combat",
      revision: 3,
      type: "respond",
      source_instance_id: "sudden-traffic-jam-1",
    } as const;
    expect(interactionActionViewSchema.parse({
      ...base,
      combat_capability: "enhance_monster",
      target_monster_instance_id: "paperwork-hydra-1",
      combat_delta: 4,
    })).toMatchObject({
      combat_capability: "enhance_monster",
      target_monster_instance_id: "paperwork-hydra-1",
    });
    expect(interactionActionViewSchema.parse({
      ...base,
      source_instance_id: "anonymous-complaint-1",
      combat_capability: "counter_combat_effect",
      target_effect_id: "fx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    }).target_effect_id).toBe("fx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(interactionActionViewSchema.parse({
      ...base,
      source_instance_id: "flash-mob-intervention-1",
      combat_capability: "force_combat_helper",
      helper_player_id: "player_c",
    }).helper_player_id).toBe("player_c");
    expect(() => interactionActionViewSchema.parse({
      ...base,
      combat_capability: "enhance_monster",
      target_monster_instance_id: "paperwork-hydra-1",
      target_path: "players[1].hand",
      combat_delta: 4,
    })).toThrow();
    expect(() => interactionActionViewSchema.parse({
      ...base,
      source_instance_id: "anonymous-complaint-1",
      combat_capability: "counter_combat_effect",
      target_effect_id: "sudden-traffic-jam-1",
    })).toThrow();
    expect(() => interactionActionViewSchema.parse({
      ...base,
      combat_capability: "enhance_monster",
      target_monster_instance_id: "paperwork-hydra-1",
      combat_delta: 11,
    })).toThrow();

    const parsed = projectionSchema.parse({
      ...projection,
      rules_profile_id: "lobby-multiplayer-v2",
    });
    expect(parsed.rules_profile_id).toBe("lobby-multiplayer-v2");

    const fixture: unknown = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "advanced-combat-projection-v1.json",
      import.meta.url,
    ), "utf8"));
    const advanced = projectionSchema.parse(fixture);
    expect(advanced.turn.combat?.monsters).toHaveLength(2);
    expect(advanced.turn.combat?.effects[0]).toMatchObject({
      kind: "enhance_monster",
      active: true,
    });
    expect(advanced.interaction?.actions[1]).toMatchObject({
      combat_capability: "counter_combat_effect",
      target_effect_id: "fx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("keeps target effects actor-scoped and private choices server-projected", () => {
    const fixture: unknown = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "target-effect-projection-v1.json",
      import.meta.url,
    ), "utf8"));
    const target = projectionSchema.parse(fixture);
    expect(target.interaction).toMatchObject({
      public_kind: "target_response",
      target_player_id: "player_b",
    });
    expect(target.interaction?.actions[1]).toMatchObject({
      combat_capability: "counter_combat_effect",
      target_effect_id: "tfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(commandPayloadSchema.parse({
      instance_id: "target-curse-1",
      target_player_id: "player_b",
    })).toEqual({
      instance_id: "target-curse-1",
      target_player_id: "player_b",
    });
    expect(() => commandPayloadSchema.parse({
      instance_id: "target-curse-1",
      target_player_id: "player_b",
      player_id: "player_b",
    })).toThrow();
    expect(interactionActionViewSchema.parse({
      action_id: "act_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      interaction_id: "interaction_target_choice",
      revision: 1,
      type: "respond",
      choice_ids: ["private-owned-card-1"],
    }).choice_ids).toEqual(["private-owned-card-1"]);
    expect(() => interactionActionViewSchema.parse({
      ...target.interaction?.actions[1],
      choice_ids: ["foreign-card-1"],
    })).toThrow();
  });

  it("exposes only persisted Run Away results and typed actor actions", () => {
    const fixture: unknown = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "run-away-projection-v1.json",
      import.meta.url,
    ), "utf8"));
    const runAway = projectionSchema.parse(fixture);
    expect(runAway.turn.run_away).toMatchObject({
      current_player_id: "player_b",
      current_monster_instance_id: "courtyard-pigeon-1",
      attempts: [{
        player_id: "player_a",
        monster_instance_id: "paperwork-hydra-1",
        roll: 2,
        modifier: 0,
        total: 2,
        escaped: false,
        bad_stuff_applied: true,
      }],
      completed: false,
    });
    expect(runAway.interaction?.actions[1]).toMatchObject({
      source_instance_id: "metro-shortcut-1",
      escape_delta: 2,
    });
    expect(() => interactionActionViewSchema.parse({
      ...runAway.interaction?.actions[1],
      combat_capability: "counter_combat_effect",
      target_effect_id: "rfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })).toThrow();
    expect(() => projectionSchema.parse({
      ...runAway,
      rng_state: 42,
    })).toThrow();
  });

  it("keeps combat-help terms server-owned and party-scoped", () => {
    const offer = {
      action_id: "act_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      interaction_id: "interaction_combat",
      revision: 2,
      type: "offer_help",
      helper_player_id: "player_b",
      reward_treasures: 1,
    };
    expect(interactionActionViewSchema.parse(offer)).toMatchObject({
      helper_player_id: "player_b",
      reward_treasures: 1,
    });
    expect(combatHelpRequestSchema.parse({
      expected_version: 14,
      action_id: offer.action_id,
    })).toEqual({
      expected_version: 14,
      action_id: offer.action_id,
    });
    expect(() => combatHelpRequestSchema.parse({
      expected_version: 14,
      action_id: offer.action_id,
      helper_player_id: "player_c",
    })).toThrow();
    expect(() => combatHelpRequestSchema.parse({
      expected_version: 14,
      action_id: offer.action_id,
      reward_treasures: 9,
    })).toThrow();
    expect(() => interactionActionViewSchema.parse({
      ...offer,
      reward_treasures: 0,
    })).toThrow();

    const fixture: unknown = JSON.parse(readFileSync(new URL(
      "../../../../backend/game/internal/transport/httpapi/testdata/"
        + "combat-help-projection-v1.json",
      import.meta.url,
    ), "utf8"));
    const parsed = projectionSchema.parse(fixture);
    expect(parsed.interaction).toMatchObject({
      public_kind: "combat_help_offer",
      combat_help_offer: {
        helper_player_id: "player_b",
        reward_treasures: 1,
      },
    });
    if (!parsed.interaction) {
      throw new Error("combat-help fixture was not parsed");
    }
    expect(() => projectionSchema.parse({
      ...parsed,
      interaction: {
        ...parsed.interaction,
        helper_candidates: ["player_c"],
      },
    })).toThrow();
  });

  it("keeps Card Studio generation requests closed and path-free", () => {
    const request = {
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
      card_id: "yard-evacuator",
      brief: {
        subject: "Старый эвакуатор с характером дворового дракона",
        setting: "Тесный московский двор после дождя",
        action: "Поднимает пустое парковочное место как трофей",
        composition: "Низкая точка, один крупный силуэт, чистый верхний край",
        palette: "Графит, бумажный кремовый, сигнальный лайм",
        mood: "Городской абсурд и энергичное движение",
        exclusions: "Без текста, логотипов, водяных знаков и карточной рамки",
      },
      settings: {
        quality: "low",
        size: "1024x1536",
      },
    };
    expect(studioGenerateRequestSchema.parse(request).card_id)
      .toBe("yard-evacuator");
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      provider: "openai",
    })).toThrow();
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      model: "arbitrary-model",
    })).toThrow();
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      output_path: "../../outside.webp",
    })).toThrow();
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      api_key: "secret",
    })).toThrow();
    expect(() => studioCompileRequestSchema.parse({
      ...request,
      request_id: undefined,
      brief: {...request.brief, rules_text: "full hidden rules"},
    })).toThrow();
  });

  it("accepts only safe Studio job and approval wire shapes", () => {
    const job = {
      id: "018f47a6-7884-7d15-a0cf-4ac22462f7d3",
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
      card_id: "yard-evacuator",
      status: "succeeded",
      provider: "fake",
      model: "fake-card-art-v1",
      quality: "low",
      size: "1024x1536",
      prompt_hash: `sha256:${"a".repeat(64)}`,
      output_sha256: `sha256:${"b".repeat(64)}`,
      preview_url:
        "/api/studio/jobs/018f47a6-7884-7d15-a0cf-4ac22462f7d3/image",
      created_at: "2026-07-29T18:00:00.000Z",
      updated_at: "2026-07-29T18:00:01.000Z",
    };
    expect(studioJobSchema.parse(job).status).toBe("succeeded");
    expect(() => studioJobSchema.parse({...job, staging_path: "C:\\secret"}))
      .toThrow();
    expect(() => studioApproveRequestSchema.parse({
      alt_text: "Дворовый эвакуатор",
      asset_path: "../../outside.webp",
    })).toThrow();
  });

  it("does not permit secrets or provider payloads in Studio errors", () => {
    const error = {
      error: true,
      code: "GENERATION_FAILED",
      message: "Генерация не завершена. Повторите явным действием.",
    };
    expect(studioAPIErrorSchema.parse(error).code)
      .toBe("GENERATION_FAILED");
    expect(() => studioAPIErrorSchema.parse({
      ...error,
      api_key: "secret",
    })).toThrow();
    expect(() => studioAPIErrorSchema.parse({
      ...error,
      provider_response: {body: "raw"},
    })).toThrow();
  });
});

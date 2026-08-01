import {
  projectionSchema,
  type CardView,
  type InteractionView,
  type Projection,
} from "../../../../packages/contracts/src/index.ts";

export type UiFixtureConnectionState = "connected" | "offline" | "stale";

export interface UiFixtureDefinition {
  id: string;
  label: string;
  connectionState: UiFixtureConnectionState;
  projection: Projection;
}

type OtherPlayerView = Projection["players"][number];
type InteractionAction = InteractionView["actions"][number];

export function parseFixtureProjection(value: unknown): Projection {
  return projectionSchema.parse(value);
}

const longRules = "Выбери момент для следующего шага: проверь открытые зоны, "
  + "сохрани доступ к обязательному действию и учитывай решение сервера. "
  + "Этот длинный русский текст нужен для проверки переноса строк, ширины "
  + "карточки, увеличенного текста и отсутствия обрезанного содержимого.";

function card(
  instanceID: string,
  name: string,
  kind: CardView["kind"],
  deck: CardView["deck"],
  overrides: Partial<CardView> = {},
): CardView {
  return {
    instance_id: instanceID,
    definition_id: `${deck}-${kind}-${instanceID}`,
    name,
    deck,
    kind,
    value: deck === "treasure" ? 100 : undefined,
    rules_text: "Оригинальная демонстрационная карта. Решение принимает сервер.",
    ...overrides,
  };
}

const heroHand = [
  card(
    "hero-card-1",
    "Карта с длинным названием для проверки переноса",
    "item",
    "treasure",
    {
      item_slot: "hands",
      item_size: "small",
      bonus: 2,
      hands: 1,
      value: 100,
    },
  ),
  card(
    "hero-card-2",
    "Спокойная подготовка",
    "class",
    "door",
    {trait_group: "class"},
  ),
  card(
    "hero-card-3",
    "Запасной план",
    "one_shot",
    "treasure",
    {treasure_count: 1, value: 50},
  ),
];

const encounter = card(
  "encounter-monster",
  "Городской монстр с длинным русским описанием",
  "monster",
  "door",
  {
    combat_strength: 6,
    treasure_count: 2,
    levels_reward: 1,
    rules_text: longRules,
    flavor_text: "Он пришёл за углом карты и задержался на перекрёстке.",
  },
);

const additionalMonster = card(
  "paperwork-hydra-1",
  "Гидра из справок",
  "monster",
  "door",
  {
    combat_strength: 9,
    treasure_count: 2,
    levels_reward: 1,
  },
);

const advancedEffectID = "fx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const targetEffectID = "tfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const runAwayEffectID = "rfx_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const baseProjection: Projection = {
  game_id: "fixture-base",
  version: 1,
  status: "active",
  is_owner: true,
  you: {
    player_id: "player_hero",
    name: "Алиса",
    level: 2,
    combat_strength: 4,
    escape_bonus: 1,
    hand_limit: 5,
    character_tags: ["городская", "смелая"],
    hand: structuredClone(heroHand),
    carried: [],
    equipped: [],
    traits: [],
    attachments: [],
    persistent_curses: [],
    setup_done: true,
    dead: false,
    needs_redraw: false,
  },
  players: [],
  turn: {
    player_id: "player_hero",
    phase: "preparation",
    resolving: [],
    available_actions: [],
  },
  door_deck_count: 28,
  door_discard_count: 2,
  treasure_deck_count: 19,
  treasure_discard_count: 1,
  content_set_id: "demo-original",
  content_version: 2,
  rules_profile_id: "lobby-multiplayer-v4",
  rules_profile_version: 1,
};

const rosterNames = ["Борис", "Вера", "Глеб", "Даша", "Егор"] as const;

function player(index: number): OtherPlayerView {
  return {
    player_id: `player_${index + 1}`,
    name: rosterNames[index] ?? `Игрок ${index + 2}`,
    level: Math.min(10, index + 1),
    hand_count: index + 2,
    carried: [],
    equipped: index === 0
      ? [card("public-sword", "Публичный фонарь", "item", "treasure", {bonus: 1})]
      : [],
    traits: [],
    attachments: [],
    persistent_curses: [],
    setup_done: true,
    dead: false,
  };
}

function action(type: Projection["turn"]["available_actions"][number]["type"]): Projection["turn"]["available_actions"][number] {
  return {type};
}

function interactionAction(
  type: InteractionAction["type"],
  hex: string,
  fields: Omit<InteractionAction, "action_id" | "interaction_id" | "revision" | "type"> = {},
): InteractionAction {
  return {
    action_id: `act_${hex.repeat(32).slice(0, 32)}`,
    interaction_id: "interaction_fixture_0001",
    revision: 1,
    type,
    ...fields,
  };
}

function interaction(
  publicKind: InteractionView["public_kind"],
  actions: InteractionAction[],
  fields: Partial<InteractionView> = {},
): InteractionView {
  return {
    interaction_id: "interaction_fixture_0001",
    public_kind: publicKind,
    parent_phase: "combat",
    public_subject: "current_context",
    status: "open",
    deadline_at: "2030-01-01T00:05:00.000Z",
    server_time: "2030-01-01T00:04:00.000Z",
    response_required_for_you: true,
    actions,
    ...fields,
  };
}

function configureAdvancedCombat(
  projection: Projection,
  actions: InteractionAction[],
  fields: Partial<InteractionView> = {},
): void {
  projection.players = [player(0), player(1), player(2)];
  projection.turn.phase = "combat";
  projection.turn.player_id = "player_hero";
  projection.turn.encounter = encounter;
  projection.turn.combat = {
    player_strength: 4,
    monster_strength: 14,
    player_winning: false,
    tie_wins: false,
    combat_closed: false,
    monsters: [encounter, additionalMonster],
    effects: [{
      effect_id: advancedEffectID,
      kind: "enhance_monster",
      target_monster_instance_id: additionalMonster.instance_id,
      amount: 4,
      active: true,
    }],
  };
  projection.you.hand = [
    ...structuredClone(heroHand),
    card("advanced-add-monster", "Вызов дополнительного монстра", "one_shot", "treasure"),
    card("advanced-enhancer", "Усиление монстра", "one_shot", "treasure"),
    card("advanced-helper", "Принудительная помощь", "one_shot", "treasure"),
  ];
  projection.turn.available_actions = [];
  projection.interaction = interaction("combat_response", actions, fields);
}

function makeFixture(
  id: string,
  label: string,
  configure: (projection: Projection) => void,
  connectionState: UiFixtureConnectionState = "connected",
): UiFixtureDefinition {
  const projection = structuredClone(baseProjection);
  projection.game_id = `fixture-${id}`;
  configure(projection);
  return {
    id,
    label,
    connectionState,
    projection: parseFixtureProjection(projection),
  };
}

export const fixtureDefinitions: readonly UiFixtureDefinition[] = [
  makeFixture("single-setup", "Один игрок: подготовка", (projection) => {
    projection.you.setup_done = false;
    projection.turn.phase = "setup";
    projection.turn.available_actions = [action("finish_setup")];
  }),
  makeFixture("single-preparation", "Один игрок: подготовка хода", (projection) => {
    projection.turn.phase = "preparation";
    projection.turn.available_actions = [action("open_door")];
  }),
  makeFixture("single-door-choice", "Один игрок: дверь", (projection) => {
    projection.turn.phase = "door_choice";
    projection.turn.available_actions = [action("open_door")];
  }),
  makeFixture("single-combat", "Один игрок: бой", (projection) => {
    projection.turn.phase = "combat";
    projection.turn.encounter = encounter;
    projection.turn.combat = {
      player_strength: 4,
      monster_strength: 6,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter],
      effects: [],
      resolution_action: {type: "request_combat_resolution"},
    };
    projection.turn.available_actions = [action("resolve_combat")];
  }),
  makeFixture("card-action-rail", "Карточное действие с contextual rail", (projection) => {
    projection.turn.available_actions = [{
      ...action("play_card"),
      source_instance_id: "hero-card-3",
      instance_ids: ["hero-card-3"],
      minimum: 1,
      maximum: 1,
    }];
  }),
  makeFixture("single-run-away", "Один игрок: побег", (projection) => {
    projection.turn.phase = "run_away";
    projection.turn.encounter = encounter;
    projection.turn.run_away = {
      current_player_id: "player_hero",
      current_monster_instance_id: encounter.instance_id,
      effects: [],
      attempts: [],
      completed: false,
    };
    projection.turn.available_actions = [action("run_away")];
  }),
  makeFixture("single-charity", "Один игрок: милостыня", (projection) => {
    projection.turn.phase = "charity";
    projection.you.hand = [
      ...structuredClone(heroHand),
      card("extra-card", "Лишний фонарь", "item", "treasure", {value: 30}),
    ];
    projection.turn.available_actions = [action("resolve_charity")];
  }),
  makeFixture("single-finished", "Один игрок: победа", (projection) => {
    projection.status = "finished";
    projection.winner_player_id = "player_hero";
    projection.turn.phase = "end_turn";
    projection.turn.available_actions = [];
  }),
  makeFixture("full-roster-combat", "Шесть игроков: бой", (projection) => {
    projection.players = [0, 1, 2, 3, 4].map(player);
    projection.turn.phase = "combat";
    projection.turn.player_id = "player_hero";
    projection.turn.encounter = encounter;
    projection.turn.combat = {
      player_strength: 9,
      monster_strength: 8,
      player_winning: true,
      tie_wins: true,
      combat_closed: false,
      monsters: [encounter],
      effects: [],
    };
    projection.turn.available_actions = [action("resolve_combat")];
  }),
  makeFixture("full-roster-long-copy", "Шесть игроков: длинный текст", (projection) => {
    projection.players = [0, 1, 2, 3, 4].map(player);
    projection.you.name = "Алиса с очень длинным именем для проверки переноса";
    projection.you.hand = Array.from({length: 6}, (_, index) => card(
      `long-card-${index}`,
      `Карта с длинным русским названием номер ${index + 1}`,
      "item",
      "treasure",
      {rules_text: longRules, value: 25 + index},
    ));
    projection.turn.encounter = encounter;
    projection.turn.available_actions = [action("open_door")];
  }),
  makeFixture("missing-art", "Карта без изображения", (projection) => {
    projection.you.hand = [card(
      "missing-art-card",
      "Карта без готовой иллюстрации",
      "curse",
      "door",
      {rules_text: longRules},
    )];
    projection.turn.available_actions = [action("play_card")];
  }),
  makeFixture("offline-stale", "Последнее состояние после offline", (projection) => {
    projection.version = 12;
    projection.turn.available_actions = [action("open_door")];
  }, "offline"),
  makeFixture("stale-projection", "Stale projection с безопасным ожиданием", (projection) => {
    projection.version = 13;
    projection.turn.player_id = "player_other";
    projection.turn.available_actions = [];
  }, "stale"),
  makeFixture("interaction-pass-only", "Окно: только pass", (projection) => {
    projection.turn.phase = "combat";
    projection.interaction = interaction(
      "response_window",
      [interactionAction("pass", "a")],
    );
  }),
  makeFixture("interaction-material", "Окно: material response", (projection) => {
    projection.turn.phase = "combat";
    projection.interaction = interaction(
      "combat_response",
      [
        interactionAction("pass", "b"),
        interactionAction("respond", "c", {
          source_instance_id: "hero-card-3",
          combat_capability: "enhance_monster",
          combat_delta: 2,
          target_monster_instance_id: encounter.instance_id,
        }),
      ],
    );
  }),
  makeFixture("interaction-opaque", "Окно: без текущего действия", (projection) => {
    projection.interaction = interaction(
      "response_window",
      [],
      {response_required_for_you: false},
    );
  }),
  makeFixture("helper-offer", "Окно: помощь в бою", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "combat";
    projection.turn.player_id = "player_hero";
    projection.turn.combat = {
      player_strength: 5,
      monster_strength: 8,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter],
      effects: [],
    };
    projection.interaction = interaction(
      "combat_response",
      [
        interactionAction("offer_help", "d", {
          helper_player_id: "player_1",
          reward_treasures: 1,
        }),
        interactionAction("offer_help", "e", {
          helper_player_id: "player_1",
          reward_treasures: 2,
        }),
        interactionAction("offer_help", "f", {
          helper_player_id: "player_2",
          reward_treasures: 1,
        }),
      ],
    );
  }),
  makeFixture("helper-invite", "Окно: приглашение помощника", (projection) => {
    projection.players = [player(0)];
    projection.turn.phase = "combat";
    projection.turn.player_id = "player_1";
    projection.turn.combat = {
      player_strength: 5,
      monster_strength: 8,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter],
      effects: [],
    };
    projection.interaction = interaction(
      "combat_help_offer",
      [
        interactionAction("accept", "1"),
        interactionAction("decline", "2"),
      ],
      {
        combat_help_offer: {
          helper_player_id: "player_hero",
          reward_treasures: 2,
        },
      },
    );
  }),
  makeFixture("helper-observer", "Наблюдатель без условий помощи", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "combat";
    projection.turn.player_id = "player_1";
    projection.turn.combat = {
      player_strength: 5,
      monster_strength: 8,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter],
      effects: [],
    };
    projection.interaction = interaction(
      "combat_response",
      [],
      {response_required_for_you: false},
    );
  }),
  makeFixture("helper-accepted", "Бой с принятой помощью", (projection) => {
    projection.players = [player(0)];
    projection.turn.phase = "combat";
    projection.turn.player_id = "player_1";
    projection.turn.combat = {
      player_strength: 7,
      monster_strength: 8,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter],
      effects: [],
      helper_player_id: "player_hero",
      helper_reward_treasures: 2,
    };
    projection.interaction = undefined;
  }),
  makeFixture("advanced-combat", "Бой: дополнительные монстры и эффекты", (projection) => {
    configureAdvancedCombat(projection, [
      interactionAction("pass", "a"),
      interactionAction("respond", "b", {
        source_instance_id: "advanced-add-monster",
        combat_capability: "add_monster",
      }),
      interactionAction("respond", "c", {
        source_instance_id: "advanced-enhancer",
        combat_capability: "enhance_monster",
        target_monster_instance_id: additionalMonster.instance_id,
        combat_delta: 4,
      }),
      interactionAction("respond", "d", {
        source_instance_id: "hero-card-3",
        combat_capability: "counter_combat_effect",
        target_effect_id: advancedEffectID,
      }),
      interactionAction("respond", "e", {
        source_instance_id: "advanced-helper",
        combat_capability: "force_combat_helper",
        helper_player_id: "player_1",
      }),
    ]);
  }),
  makeFixture("advanced-forced-helper", "Бой: обязательная помощь", (projection) => {
    configureAdvancedCombat(projection, [
      interactionAction("respond", "f", {
        source_instance_id: "advanced-helper",
        combat_capability: "force_combat_helper",
        helper_player_id: "player_1",
      }),
    ]);
  }),
  makeFixture("advanced-observer", "Бой: наблюдатель без вмешательства", (projection) => {
    configureAdvancedCombat(projection, [], {response_required_for_you: false});
    projection.you.hand = [card(
      "observer-card",
      "Карта наблюдателя",
      "item",
      "treasure",
      {bonus: 1},
    )];
  }),
  makeFixture("target-response", "Окно: выбор цели", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "resolve_effect";
    projection.interaction = interaction(
      "target_response",
      [
        interactionAction("pass", "e"),
        interactionAction("respond", "f", {
          source_instance_id: "hero-card-3",
          combat_capability: "counter_combat_effect",
          target_effect_id: targetEffectID,
        }),
      ],
      {
        public_subject: "current_effect",
        target_player_id: "player_1",
      },
    );
  }),
  makeFixture("target-initiator", "Действие: выбрать цель эффекта", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "combat";
    projection.turn.encounter = encounter;
    projection.turn.available_actions = [{
      ...action("play_target_effect"),
      source_instance_id: "target-effect-card",
      target_player_ids: ["player_1"],
    }];
    projection.you.hand = [
      ...structuredClone(heroHand),
      card(
        "target-effect-card",
        "Эффект с выбором цели",
        "one_shot",
        "treasure",
        {rules_text: "Сервер предложит допустимую цель из текущей проекции."},
      ),
    ];
  }),
  makeFixture("target-private-choice", "Окно: приватный выбор эффекта", (projection) => {
    projection.turn.phase = "resolve_effect";
    projection.interaction = interaction(
      "private_choice",
      [
        interactionAction("respond", "1", {choice_ids: ["hero-card-1"]}),
        interactionAction("respond", "2", {choice_ids: ["hero-card-2"]}),
      ],
      {public_subject: "current_effect"},
    );
  }),
  makeFixture("target-observer", "Окно: наблюдатель цели", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "resolve_effect";
    projection.interaction = interaction(
      "target_response",
      [],
      {
        public_subject: "current_effect",
        target_player_id: "player_1",
        response_required_for_you: false,
      },
    );
  }),
  makeFixture("run-away-response", "Окно: шаг побега", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "run_away";
    projection.turn.encounter = encounter;
    projection.turn.player_id = "player_1";
    projection.turn.run_away = {
      current_player_id: "player_1",
      current_monster_instance_id: encounter.instance_id,
      effects: [{
        effect_id: runAwayEffectID,
        kind: "modifier",
        amount: 2,
        active: true,
      }],
      attempts: [{
        player_id: "player_hero",
        monster_instance_id: encounter.instance_id,
        roll: 2,
        modifier: 0,
        total: 2,
        escaped: false,
        bad_stuff_applied: true,
      }],
      completed: false,
    };
    projection.interaction = interaction(
      "run_away_response",
      [
        interactionAction("pass", "3"),
        interactionAction("respond", "4", {
          source_instance_id: "hero-card-3",
          escape_delta: 2,
        }),
      ],
      {public_subject: "current_encounter"},
    );
  }),
  makeFixture("run-away-result", "Побег: подтверждённая последовательность", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "charity";
    projection.turn.player_id = "player_1";
    projection.turn.encounter = encounter;
    projection.turn.combat = {
      player_strength: 4,
      monster_strength: 15,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter, additionalMonster],
      effects: [],
    };
    projection.turn.run_away = {
      current_player_id: "player_1",
      current_monster_instance_id: additionalMonster.instance_id,
      effects: [{
        effect_id: runAwayEffectID,
        kind: "modifier",
        amount: 2,
        active: false,
      }],
      attempts: [
        {
          player_id: "player_hero",
          monster_instance_id: encounter.instance_id,
          roll: 2,
          modifier: 0,
          total: 2,
          escaped: false,
          bad_stuff_applied: true,
        },
        {
          player_id: "player_1",
          monster_instance_id: additionalMonster.instance_id,
          roll: 5,
          modifier: 2,
          total: 7,
          escaped: true,
        },
      ],
      completed: true,
    };
  }),
  makeFixture("run-away-observer", "Окно: наблюдатель побега", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "run_away";
    projection.turn.player_id = "player_1";
    projection.turn.encounter = encounter;
    projection.turn.run_away = {
      current_player_id: "player_1",
      current_monster_instance_id: encounter.instance_id,
      effects: [],
      attempts: [],
      completed: false,
    };
    projection.interaction = interaction(
      "run_away_response",
      [],
      {
        public_subject: "current_encounter",
        response_required_for_you: false,
      },
    );
  }),
  makeFixture("economy-offer", "Окно: обмен", (projection) => {
    projection.players = [player(0), player(1)];
    projection.interaction = interaction(
      "economy_offer",
      [
        interactionAction("accept", "1"),
        interactionAction("decline", "2"),
      ],
      {
        economy_offer: {
          kind: "trade",
          offerer_player_id: "player_2",
          recipient_player_id: "player_hero",
          offered: [card("offer-card", "Предложенный предмет", "item", "treasure")],
          requested: [],
        },
      },
    );
  }),
  makeFixture("economy-actions", "Действия: обмен, подарок и кража", (projection) => {
    const carriedCards = [
      card("transfer-card-1", "Передаваемый фонарь", "item", "treasure", {
        item_slot: "hands",
        item_size: "small",
        bonus: 1,
      }),
      card("transfer-card-2", "Передаваемый плащ", "item", "treasure", {
        item_slot: "armor",
        item_size: "small",
        bonus: 2,
      }),
    ];
    projection.players = [player(0), player(1), player(2)];
    projection.you.hand = [structuredClone(heroHand[0]!), structuredClone(heroHand[2]!)];
    projection.you.carried = carriedCards;
    projection.you.traits = [card(
      "theft-trait",
      "Оригинальная способность кражи",
      "class",
      "door",
      {trait_group: "class"},
    )];
    projection.turn.phase = "preparation";
    projection.turn.available_actions = [
      {
        type: "propose_gift",
        instance_ids: carriedCards.map((item) => item.instance_id),
        target_player_ids: ["player_1"],
        minimum: 1,
        maximum: carriedCards.length,
      },
      {
        type: "propose_trade",
        instance_ids: carriedCards.map((item) => item.instance_id),
        requested_instance_ids: ["opaque-recipient-card-1", "opaque-recipient-card-2"],
        target_player_ids: ["player_2"],
        minimum: 1,
        maximum: carriedCards.length,
      },
      {
        type: "attempt_theft",
        source_instance_id: "theft-trait",
        instance_ids: projection.you.hand.map((item) => item.instance_id),
        target_player_ids: ["player_1", "player_2"],
        minimum: 1,
        maximum: 1,
        ability_index: 0,
      },
    ];
  }),
  makeFixture("economy-observer", "Окно: observer без карт предложения", (projection) => {
    projection.players = [player(0), player(1), player(2)];
    projection.interaction = interaction(
      "economy_offer",
      [],
      {
        response_required_for_you: false,
      },
    );
  }),
  makeFixture("charity-transfer", "Окно: обязательное распределение", (projection) => {
    const hand = [
      card("charity-card-1", "Карта для charity 1", "item", "treasure"),
      card("charity-card-2", "Карта для charity 2", "item", "treasure"),
      card("charity-card-3", "Карта для charity 3", "item", "treasure"),
      card("charity-card-4", "Карта для charity 4", "item", "treasure"),
    ];
    projection.players = [player(0), player(1), player(2)];
    projection.you.hand = hand;
    projection.turn.phase = "charity";
    projection.interaction = interaction(
      "charity_transfer",
      [],
      {
        parent_phase: "charity",
        charity_transfer: {
          excess: 2,
          instance_ids: hand.map((item) => item.instance_id),
          eligible_recipient_ids: ["player_1", "player_2"],
        },
      },
    );
  }),
  makeFixture("theft-response", "Окно: counter кражи", (projection) => {
    projection.players = [player(0), player(1), player(2)];
    projection.you.hand = [
      card("counter-card", "Оригинальная counter-карта", "one_shot", "treasure"),
      structuredClone(heroHand[0]!),
    ];
    projection.turn.phase = "preparation";
    projection.interaction = interaction(
      "theft_response",
      [interactionAction("respond", "7", {
        source_instance_id: "counter-card",
        theft_capability: "counter_theft",
      })],
      {
        parent_phase: "preparation",
      },
    );
  }),
  makeFixture("death-loot", "Окно: приоритет добычи", (projection) => {
    projection.you.dead = true;
    projection.interaction = interaction(
      "death_loot_priority",
      [
        interactionAction("respond", "3", {choice_ids: ["loot-option-1"]}),
        interactionAction("pass", "4"),
      ],
      {
        death_loot: {
          dead_player_id: "player_2",
          initial_count: 3,
          remaining_count: 2,
          picked_count: 1,
          discarded_count: 0,
          options: [card("loot-option-1", "Добыча из комнаты", "item", "treasure")],
        },
      },
    );
  }),
  makeFixture("victory-six-player", "Шесть игроков: финал", (projection) => {
    projection.players = [0, 1, 2, 3, 4].map(player);
    projection.status = "finished";
    projection.winner_player_id = "player_hero";
    projection.turn.phase = "end_turn";
    projection.turn.available_actions = [];
  }),
];

export const parsedFixtureCatalog = fixtureDefinitions.map((fixture) => ({
  ...fixture,
  projection: parseFixtureProjection(fixture.projection),
}));

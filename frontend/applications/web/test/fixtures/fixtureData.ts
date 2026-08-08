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

const longRules = "Выбери момент для следующего шага: проверь открытые карты, "
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
    strength_breakdown: {
      base_strength: 2,
      equipment_bonus: 0,
      temporary_bonus: 2,
      total_strength: 4,
      hand_count: heroHand.length,
    },
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
  const level = Math.min(10, index + 1);
  const equipmentBonus = index === 0 ? 1 : 0;
  return {
    player_id: `player_${index + 1}`,
    name: rosterNames[index] ?? `Игрок ${index + 2}`,
    level,
    combat_strength: level + equipmentBonus,
    strength_breakdown: {
      base_strength: level,
      equipment_bonus: equipmentBonus,
      temporary_bonus: 0,
      total_strength: level + equipmentBonus,
      hand_count: index + 2,
    },
    escape_bonus: 0,
    hand_count: index + 2,
    carried: [],
    equipped: index === 0
      ? [card("public-sword", "Публичный фонарь", "item", "treasure", {
        item_slot: "hands",
        item_size: "small",
        hands: 1,
        bonus: 1,
      })]
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

function configureFigmaBattle(projection: Projection): void {
  const sentry = card("sentry-slime", "Сторожевой слизень", "monster", "door", {
    combat_strength: 4,
    treasure_count: 1,
    levels_reward: 1,
    rules_text: "Бонус +2 против Воина.",
  });
  const archiveDust = card("archive-dust", "Архивная пыль", "monster", "door", {
    combat_strength: 7,
    treasure_count: 2,
    levels_reward: 1,
    rules_text: "Курьера не преследует. При победе возьми 2 сокровища.",
  });
  const boneCourier = card("bone-courier", "Костяной курьер", "monster", "door", {
    combat_strength: 3,
    treasure_count: 1,
    levels_reward: 1,
    rules_text: "Не получает бонусов от класса.",
  });
  projection.you.name = "Макс";
  projection.you.level = 8;
  projection.you.combat_strength = 16;
  projection.you.strength_breakdown = {
    base_strength: 8,
    equipment_bonus: 6,
    temporary_bonus: 2,
    total_strength: 16,
    hand_count: 4,
  };
  projection.you.character_tags = [];
  projection.you.traits = [
    card("figma-class-warrior", "Воин", "class", "door", {trait_group: "class"}),
    card("figma-race-human", "Человек", "race", "door", {trait_group: "race"}),
  ];
  projection.you.equipped = [
    card("figma-equipped-helmet", "Шлем отваги", "item", "treasure", {item_slot: "headgear", item_size: "small", bonus: 2, value: 200}),
    card("figma-equipped-armor", "Кольчуга архивариуса", "item", "treasure", {item_slot: "armor", item_size: "small", bonus: 3, value: 300}),
    card("figma-equipped-boots", "Сапоги спешки", "item", "treasure", {item_slot: "footgear", item_size: "small", bonus: 1, value: 200}),
  ];
  projection.you.carried = [
    card("figma-carried-courage", "Зелье смелости", "one_shot", "treasure", {value: 100, bonus: 2, rules_text: "+2 к следующему бою."}),
    card("figma-carried-pack", "Тяжёлый рюкзак", "item", "treasure", {value: 400, item_size: "big"}),
  ];
  projection.you.hand = [
    card("figma-hand-plan", "Запасной план", "one_shot", "treasure", {value: 200, bonus: 2, rules_text: "+2 к любой стороне в бою."}),
    card("figma-hand-smoke", "Дымовая завеса", "one_shot", "treasure", {value: 300, rules_text: "Монстр получает −3."}),
    card("figma-hand-pack", "Тяжёлый рюкзак", "item", "treasure", {value: 400, bonus: 2, item_size: "big", rules_text: "+2 к твоей силе."}),
    card("figma-hand-haste", "Зелье спешки", "one_shot", "treasure", {value: 100, rules_text: "+1 к броску побега."}),
  ];
  projection.players = [
    {
      ...player(0),
      name: "Лена",
      level: 6,
      combat_strength: 12,
      strength_breakdown: {base_strength: 6, equipment_bonus: 6, temporary_bonus: 0, total_strength: 12, hand_count: 3},
      hand_count: 3,
      equipped: [
        card("figma-lena-helmet", "Тихий шлем", "item", "treasure", {item_slot: "headgear", item_size: "small", bonus: 2}),
        card("figma-lena-armor", "Куртка следопыта", "item", "treasure", {item_slot: "armor", item_size: "small", bonus: 2}),
        card("figma-lena-sword", "Длинный меч", "item", "treasure", {item_slot: "hands", item_size: "small", hands: 1, bonus: 2}),
      ],
      traits: [card("figma-lena-race", "Эльф", "race", "door", {trait_group: "race"})],
    },
    {
      ...player(1),
      name: "Илья",
      level: 4,
      combat_strength: 9,
      strength_breakdown: {base_strength: 4, equipment_bonus: 5, temporary_bonus: 0, total_strength: 9, hand_count: 5},
      escape_bonus: 1,
      hand_count: 5,
      carried: [
        card("figma-ilya-potion", "Зелье скорости", "one_shot", "treasure", {value: 100}),
        card("figma-ilya-shield", "Запасной щит", "item", "treasure", {value: 200, item_size: "small"}),
      ],
      equipped: [
        card("figma-ilya-helmet", "Шлем дозорного", "item", "treasure", {item_slot: "headgear", item_size: "small", bonus: 1}),
        card("figma-ilya-armor", "Кожаная броня", "item", "treasure", {item_slot: "armor", item_size: "small", bonus: 2}),
        card("figma-ilya-boots", "Сапоги разведчика", "item", "treasure", {item_slot: "footgear", item_size: "small", bonus: 1}),
        card("figma-ilya-sword", "Короткий меч", "item", "treasure", {item_slot: "hands", item_size: "small", hands: 1, bonus: 1}),
      ],
      traits: [
        card("figma-ilya-class", "Воин", "class", "door", {trait_group: "class"}),
        card("figma-ilya-race", "Дварф", "race", "door", {trait_group: "race"}),
      ],
    },
    {
      ...player(2),
      name: "Саша",
      level: 7,
      combat_strength: 14,
      strength_breakdown: {base_strength: 7, equipment_bonus: 7, temporary_bonus: 0, total_strength: 14, hand_count: 2},
      hand_count: 2,
      equipped: [
        card("figma-sasha-armor", "Мантия заклинателя", "item", "treasure", {item_slot: "armor", item_size: "small", bonus: 3}),
        card("figma-sasha-staff", "Посох архивов", "item", "treasure", {item_slot: "hands", item_size: "big", hands: 2, bonus: 4}),
      ],
      traits: [card("figma-sasha-class", "Волшебник", "class", "door", {trait_group: "class"})],
    },
  ];
  projection.turn.phase = "combat";
  projection.turn.player_id = "player_hero";
  projection.turn.number = 4;
  projection.turn.encounter = archiveDust;
  projection.turn.combat = {
    player_strength: 16,
    monster_strength: 15,
    player_winning: true,
    tie_wins: true,
    combat_closed: false,
    monsters: [sentry, archiveDust, boneCourier],
    effects: [{
      effect_id: "fx_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      kind: "enhance_monster",
      target_monster_instance_id: archiveDust.instance_id,
      amount: 1,
      active: true,
    }],
    resolution_action: {type: "request_combat_resolution"},
  };
  projection.turn.available_actions = [
    {...action("play_card"), source_instance_id: "figma-hand-plan"},
    {...action("play_card"), source_instance_id: "figma-hand-smoke"},
  ];
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

function normalizePublicRoster(projection: Projection): void {
  if (projection.players.some((candidate) =>
    candidate.player_id === projection.you.player_id,
  )) {
    return;
  }
  projection.players = [{
    player_id: projection.you.player_id,
    name: projection.you.name,
    level: projection.you.level,
    combat_strength: projection.you.combat_strength,
    strength_breakdown: structuredClone(projection.you.strength_breakdown),
    escape_bonus: projection.you.escape_bonus,
    hand_count: projection.you.hand.length,
    carried: structuredClone(projection.you.carried),
    equipped: structuredClone(projection.you.equipped),
    traits: structuredClone(projection.you.traits),
    attachments: structuredClone(projection.you.attachments),
    persistent_curses: structuredClone(projection.you.persistent_curses),
    setup_done: projection.you.setup_done,
    dead: projection.you.dead,
  }, ...projection.players];
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
  projection.you.strength_breakdown.hand_count = projection.you.hand.length;
  normalizePublicRoster(projection);
  return {
    id,
    label,
    connectionState,
    projection: parseFixtureProjection(projection),
  };
}

function configureDeathLootRoster(projection: Projection): void {
  projection.you.dead = false;
  projection.players = [0, 1, 2, 3, 4].map(player);
  const deadPlayer = projection.players.find((candidate) =>
    candidate.player_id === "player_2",
  );
  if (deadPlayer) {
    deadPlayer.dead = true;
  }
}

export const fixtureDefinitions: readonly UiFixtureDefinition[] = [
  makeFixture("single-setup", "Один игрок: подготовка", (projection) => {
    configureFigmaBattle(projection);
    projection.you.setup_done = false;
    projection.turn.phase = "setup";
    projection.turn.encounter = undefined;
    projection.turn.combat = undefined;
    projection.you.hand = [
      card("setup-door-1", "Класс следопыта", "class", "door", {trait_group: "class"}),
      card("setup-door-2", "Раса путника", "race", "door", {trait_group: "race"}),
      card("setup-door-3", "Осторожный монстр", "monster", "door", {combat_strength: 2}),
      card("setup-door-4", "Лёгкое проклятие", "curse", "door"),
      card("setup-treasure-1", "Учебный шлем", "item", "treasure", {item_slot: "headgear", item_size: "small", bonus: 1}),
      card("setup-treasure-2", "Учебная броня", "item", "treasure", {item_slot: "armor", item_size: "small", bonus: 1}),
      card("setup-treasure-3", "Учебные ботинки", "item", "treasure", {item_slot: "footgear", item_size: "small", bonus: 1}),
      card("setup-treasure-4", "Учебный меч", "item", "treasure", {item_slot: "hands", item_size: "small", hands: 1, bonus: 1}),
    ];
    projection.you.carried = [];
    projection.you.equipped = [];
    projection.you.traits = [];
    projection.you.attachments = [];
    projection.turn.available_actions = [
      {...action("play_card"), source_instance_id: "setup-door-1"},
      {...action("play_card"), source_instance_id: "setup-door-2"},
      {...action("equip_item"), source_instance_id: "setup-treasure-1"},
      {...action("equip_item"), source_instance_id: "setup-treasure-2"},
      {...action("equip_item"), source_instance_id: "setup-treasure-3"},
      {...action("equip_item"), source_instance_id: "setup-treasure-4"},
      action("finish_setup"),
    ];
  }),
  makeFixture("single-preparation", "Один игрок: подготовка хода", (projection) => {
    projection.turn.phase = "preparation";
    projection.turn.available_actions = [action("open_door")];
  }),
  makeFixture("single-door-choice", "Один игрок: дверь", (projection) => {
    configureFigmaBattle(projection);
    projection.turn.phase = "door_choice";
    projection.turn.combat = undefined;
    const trouble = card("door-choice-monster", "Монстр из руки", "monster", "door", {
      combat_strength: 3,
      treasure_count: 1,
      levels_reward: 1,
    });
    projection.you.hand = [...projection.you.hand, trouble];
    projection.turn.available_actions = [
      {...action("look_for_trouble"), source_instance_id: trouble.instance_id},
      action("loot_room"),
    ];
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
    projection.turn.available_actions = [];
  }),
  makeFixture("mobile-combat-multiple", "Мобильный бой: несколько карт", (projection) => {
    projection.players = [player(0), player(1)];
    projection.turn.phase = "combat";
    projection.turn.encounter = encounter;
    projection.turn.combat = {
      player_strength: 4,
      monster_strength: 14,
      player_winning: false,
      tie_wins: false,
      combat_closed: false,
      monsters: [encounter, additionalMonster],
      effects: [],
      resolution_action: {type: "request_combat_resolution"},
    };
    projection.turn.available_actions = [];
  }),
  makeFixture("opponents-one", "Мобильный стол: один оппонент", (projection) => {
    projection.players = [player(0)];
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
    projection.turn.available_actions = [];
  }),
  makeFixture("opponents-three", "Мобильный стол: три оппонента", (projection) => {
    projection.players = [player(0), player(1), player(2)];
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
    projection.turn.available_actions = [];
  }),
  makeFixture("card-action-rail", "Карточное действие с contextual rail", (projection) => {
    projection.turn.available_actions = [{
      ...action("play_card"),
      source_instance_id: "hero-card-3",
    }];
  }),
  makeFixture("single-run-away", "Один игрок: побег", (projection) => {
    configureFigmaBattle(projection);
    projection.turn.phase = "run_away";
    projection.turn.run_away = {
      current_player_id: "player_hero",
      current_monster_instance_id: "archive-dust",
      effects: [],
      attempts: [],
      completed: false,
    };
    projection.turn.available_actions = [];
    projection.interaction = interaction(
      "run_away_response",
      [interactionAction("pass", "8")],
      {parent_phase: "run_away"},
    );
  }),
  makeFixture("reward-received", "Награда после закрытого боя", (projection) => {
    configureFigmaBattle(projection);
    const rewardedMonster = projection.turn.combat?.monsters[1];
    if (!rewardedMonster || !projection.turn.combat) {
      throw new Error("Figma reward fixture requires the archive monster");
    }
    const treasures = [
      card("reward-boots", "Быстрые ботинки", "item", "treasure", {item_slot: "footgear", bonus: 2, value: 400}),
      card("reward-potion", "Зелье уверенности", "one_shot", "treasure", {bonus: 3, value: 300}),
    ];
    projection.turn.phase = "end_turn";
    projection.turn.encounter = undefined;
    projection.turn.combat = undefined;
    projection.recent_combat_result = {
      outcome: "victory",
      public_rewards: [{
        player_id: projection.you.player_id,
        treasure_count: treasures.length,
        levels_gained: rewardedMonster.levels_reward ?? 0,
      }],
      viewer_reward: {
        player_id: projection.you.player_id,
        treasures,
        levels_gained: rewardedMonster.levels_reward ?? 0,
      },
    };
    projection.turn.available_actions = [action("end_turn")];
  }),
  makeFixture("single-charity", "Один игрок: милостыня", (projection) => {
    projection.turn.phase = "charity";
    projection.you.hand = [
      ...structuredClone(heroHand),
      card("extra-card-1", "Лишний фонарь", "item", "treasure", {value: 30}),
      card("extra-card-2", "Лишняя броня", "item", "treasure", {value: 40}),
      card("extra-card-3", "Лишнее зелье", "one_shot", "treasure", {value: 50}),
      card("extra-card-4", "Лишний шлем", "item", "treasure", {value: 60}),
    ];
    const excess = projection.you.hand.length - projection.you.hand_limit;
    projection.turn.available_actions = [{
      type: "resolve_charity",
      instance_ids: projection.you.hand.map((item) => item.instance_id),
      minimum: excess,
      maximum: excess,
    }];
  }),
  makeFixture("single-finished", "Один игрок: победа", (projection) => {
    projection.status = "finished";
    projection.winner_player_id = "player_hero";
    projection.turn.phase = "end_turn";
    projection.turn.available_actions = [];
  }),
  makeFixture("full-roster-combat", "Шесть игроков: бой", (projection) => {
    configureFigmaBattle(projection);
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
  makeFixture("offline-stale", "Последнее состояние после offline", (projection) => {
    projection.version = 12;
    projection.turn.available_actions = [action("open_door")];
  }, "offline"),
  makeFixture("stale-projection", "Stale projection с безопасным ожиданием", (projection) => {
    configureFigmaBattle(projection);
    projection.version = 13;
    projection.turn.player_id = "player_2";
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
    projection.turn.pending_decision = {
      type: "effect_choice",
      options: ["hero-card-1", "hero-card-2"],
      minimum: 1,
      maximum: 1,
    };
    projection.turn.available_actions = [{
      type: "choose_effect",
      instance_ids: ["hero-card-1", "hero-card-2"],
      minimum: 1,
      maximum: 1,
    }];
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
  makeFixture("run-away-success", "Побег: успешный результат", (projection) => {
    configureFigmaBattle(projection);
    projection.turn.phase = "run_away";
    projection.turn.run_away = {
      current_player_id: "player_hero",
      current_monster_instance_id: "archive-dust",
      effects: [],
      attempts: [
        {
          player_id: "player_hero",
          monster_instance_id: "archive-dust",
          roll: 5,
          modifier: 1,
          total: 6,
          escaped: true,
        },
      ],
      completed: true,
    };
    projection.turn.available_actions = [action("end_turn")];
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
    const requestedCards = [
      card("opaque-recipient-card-1", "Запасной щит", "item", "treasure", {item_slot: "hands", item_size: "small", bonus: 1}),
      card("opaque-recipient-card-2", "Зелье скорости", "one_shot", "treasure"),
    ];
    projection.players = [player(0), {...player(1), carried: requestedCards}, player(2)];
    projection.you.hand = [structuredClone(heroHand[0]!), structuredClone(heroHand[2]!)];
    projection.you.carried = carriedCards;
    projection.you.equipped = [card("equipped-sale-item", "Старый шлем", "item", "treasure", {
      item_slot: "headgear",
      item_size: "small",
      bonus: 1,
      value: 200,
    })];
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
        type: "discard_card",
        source_instance_id: "theft-trait",
      },
      {
        type: "unequip_item",
        source_instance_id: "equipped-sale-item",
      },
      {
        type: "sell_items",
        instance_ids: ["transfer-card-1", "transfer-card-2", "equipped-sale-item"],
        minimum: 1,
        maximum: 3,
        minimum_total: 300,
        instance_values: {
          "transfer-card-1": 100,
          "transfer-card-2": 100,
          "equipped-sale-item": 200,
        },
      },
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
      action("open_door"),
    ];
  }),
  makeFixture("ability-combat", "Бой: способность со стоимостью", (projection) => {
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
    const source = card("ability-source", "Воинская ярость", "class", "door", {trait_group: "class"});
    projection.you.traits = [source];
    projection.turn.available_actions = [{
      type: "use_ability",
      source_instance_id: source.instance_id,
      instance_ids: projection.you.hand.map((item) => item.instance_id),
      minimum: 1,
      maximum: 1,
      ability_index: 0,
    }];
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
    configureDeathLootRoster(projection);
    projection.interaction = interaction(
      "death_loot_priority",
      [
        interactionAction("respond", "3", {choice_ids: ["loot-option-1"]}),
        interactionAction("respond", "5", {choice_ids: ["loot-option-2"]}),
        interactionAction("pass", "4"),
      ],
      {
        response_required_for_you: true,
        death_loot: {
          dead_player_id: "player_2",
          initial_count: 3,
          remaining_count: 2,
          picked_count: 1,
          discarded_count: 0,
          options: [
            card("loot-option-1", "Добыча из комнаты", "item", "treasure"),
            card("loot-option-2", "Старый фонарь", "item", "treasure"),
          ],
        },
      },
    );
  }),
  makeFixture("death-loot-observer", "Наблюдатель: добыча opaque", (projection) => {
    configureDeathLootRoster(projection);
    projection.interaction = interaction(
      "death_loot_priority",
      [],
      {
        response_required_for_you: false,
        death_loot: {
          dead_player_id: "player_2",
          initial_count: 3,
          remaining_count: 2,
          picked_count: 1,
          discarded_count: 0,
          options: [],
        },
      },
    );
  }),
  makeFixture("death-loot-all-pass", "Пул добычи: все пропустили", (projection) => {
    configureDeathLootRoster(projection);
    projection.interaction = interaction(
      "death_loot_priority",
      [],
      {
        response_required_for_you: false,
        death_loot: {
          dead_player_id: "player_2",
          initial_count: 3,
          remaining_count: 0,
          picked_count: 0,
          discarded_count: 3,
          options: [],
        },
      },
    );
  }),
  makeFixture("death-loot-single", "Один игрок: пустой пул добычи", (projection) => {
    projection.you.dead = true;
    projection.interaction = interaction(
      "death_loot_priority",
      [],
      {
        response_required_for_you: false,
        death_loot: {
          dead_player_id: "player_hero",
          initial_count: 0,
          remaining_count: 0,
          picked_count: 0,
          discarded_count: 0,
          options: [],
        },
      },
    );
  }),
  makeFixture("lobby-state", "Лобби: состояние комнаты", (projection) => {
    projection.status = "lobby";
    projection.turn.phase = "";
    projection.turn.available_actions = [action("start")];
  }),
  makeFixture("empty-hand", "Пустая рука: безопасная композиция", (projection) => {
    projection.you.hand = [];
    projection.turn.phase = "preparation";
    projection.turn.available_actions = [action("open_door")];
  }),
  makeFixture("expired-choice", "Окно: подтверждённый timeout", (projection) => {
    projection.turn.phase = "combat";
    projection.interaction = interaction(
      "response_window",
      [],
      {
        response_required_for_you: false,
        my_response_state: "timed_out",
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

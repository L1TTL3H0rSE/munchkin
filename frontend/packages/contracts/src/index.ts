import {z} from "zod";

const nullableArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).nullable().transform((value) => value ?? []);

export const deckKindSchema = z.enum(["door", "treasure"]);
export const cardKindSchema = z.enum([
  "monster",
  "curse",
  "class",
  "race",
  "trait_attachment",
  "item",
  "one_shot",
  "level_up",
  "cheat",
]);
export const phaseSchema = z.enum([
  "setup",
  "preparation",
  "door_choice",
  "combat",
  "run_away",
  "resolve_effect",
  "charity",
  "end_turn",
]);
export const statusSchema = z.enum(["lobby", "active", "finished"]);
export const actionTypeSchema = z.enum([
  "start",
  "finish_setup",
  "play_card",
  "equip_item",
  "unequip_item",
  "discard_card",
  "sell_items",
  "open_door",
  "look_for_trouble",
  "loot_room",
  "use_ability",
  "resolve_combat",
  "run_away",
  "choose_effect",
  "resolve_charity",
  "end_turn",
  "fight",
  "loot",
]);

export const cardViewSchema = z.object({
  instance_id: z.string().min(1),
  definition_id: z.string().min(1),
  name: z.string().min(1),
  deck: deckKindSchema,
  kind: cardKindSchema,
  combat_strength: z.number().int().positive().optional(),
  treasure_count: z.number().int().positive().optional(),
  levels_reward: z.number().int().positive().optional(),
  item_slot: z.enum(["none", "headgear", "armor", "footgear", "hands"]).optional(),
  item_size: z.enum(["small", "big"]).optional(),
  hands: z.number().int().min(1).max(2).optional(),
  bonus: z.number().int().positive().optional(),
  value: z.number().int().nonnegative().optional(),
  trait_group: z.enum(["class", "race"]).optional(),
  rules_text: z.string().max(800).optional(),
  flavor_text: z.string().max(300).optional(),
  image: z.string()
    .regex(/^assets\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/)
    .optional(),
  alt_text: z.string().min(1).max(200).optional(),
}).strict();

export const selfViewSchema = z.object({
  player_id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(1).max(10),
  combat_strength: z.number().int(),
  escape_bonus: z.number().int(),
  hand_limit: z.number().int().nonnegative(),
  character_tags: nullableArray(z.string().min(1)),
  hand: nullableArray(cardViewSchema),
  carried: nullableArray(cardViewSchema),
  equipped: nullableArray(cardViewSchema),
  traits: nullableArray(cardViewSchema),
  attachments: nullableArray(cardViewSchema),
  persistent_curses: nullableArray(cardViewSchema),
  setup_done: z.boolean(),
  dead: z.boolean(),
  needs_redraw: z.boolean(),
}).strict();

export const otherPlayerViewSchema = z.object({
  player_id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().min(1).max(10),
  hand_count: z.number().int().nonnegative(),
  carried: nullableArray(cardViewSchema),
  equipped: nullableArray(cardViewSchema),
  traits: nullableArray(cardViewSchema),
  attachments: nullableArray(cardViewSchema),
  persistent_curses: nullableArray(cardViewSchema),
  setup_done: z.boolean(),
  dead: z.boolean(),
}).strict();

export const combatViewSchema = z.object({
  player_strength: z.number().int(),
  monster_strength: z.number().int(),
  player_winning: z.boolean(),
  tie_wins: z.boolean(),
  combat_closed: z.boolean(),
}).strict();

export const decisionViewSchema = z.object({
  type: z.literal("effect_choice"),
  source_instance_id: z.string().min(1).optional(),
  options: z.array(z.string().min(1)),
  minimum: z.number().int().nonnegative(),
  maximum: z.number().int().nonnegative(),
}).strict();

export const actionViewSchema = z.object({
  type: actionTypeSchema,
  source_instance_id: z.string().min(1).optional(),
  instance_ids: z.array(z.string().min(1)).optional(),
  target_instance_ids: z.array(z.string().min(1)).optional(),
  minimum: z.number().int().nonnegative().optional(),
  maximum: z.number().int().nonnegative().optional(),
  minimum_total: z.number().int().positive().optional(),
  instance_values: z.record(z.number().int().nonnegative()).optional(),
  ability_index: z.number().int().nonnegative().optional(),
}).strict();

export const turnViewSchema = z.object({
  player_id: z.string(),
  phase: phaseSchema.or(z.literal("")),
  encounter: cardViewSchema.optional(),
  resolving: nullableArray(cardViewSchema),
  combat: combatViewSchema.optional(),
  pending_decision: decisionViewSchema.optional(),
  available_actions: nullableArray(actionViewSchema),
}).strict();

export const projectionSchema = z.object({
  game_id: z.string().min(1),
  version: z.number().int().nonnegative(),
  status: statusSchema,
  is_owner: z.boolean(),
  you: selfViewSchema,
  players: z.array(otherPlayerViewSchema),
  turn: turnViewSchema,
  door_deck_count: z.number().int().nonnegative(),
  door_discard_count: z.number().int().nonnegative(),
  treasure_deck_count: z.number().int().nonnegative(),
  treasure_discard_count: z.number().int().nonnegative(),
  winner_player_id: z.string().optional(),
  content_set_id: z.string().min(1),
  content_version: z.number().int().positive(),
  rules_profile_id: z.literal("first-edition-core-v1"),
  rules_profile_version: z.literal(1),
}).strict();

export const lobbySummarySchema = z.object({
  game_id: z.string().min(1),
  version: z.number().int().positive(),
  status: statusSchema,
  player_count: z.number().int().positive(),
  min_players: z.literal(1),
  max_players: z.literal(6),
  rules_profile_id: z.literal("first-edition-core-v1"),
  rules_profile_version: z.literal(1),
}).strict();

export const lobbyResultSchema = z.object({
  game_id: z.string().min(1),
  player_id: z.string().min(1),
  credential: z.string().min(32),
  projection: projectionSchema,
}).strict();

export const commandResultSchema = z.object({
  game_id: z.string().min(1),
  command_id: z.string().min(1),
  version: z.number().int().positive(),
  replayed: z.boolean(),
  projection: projectionSchema,
}).strict();

export const commandPayloadSchema = z.object({
  instance_id: z.string().min(1).optional(),
  target_instance_id: z.string().min(1).optional(),
  instance_ids: z.array(z.string().min(1)).optional(),
  choice_ids: z.array(z.string().min(1)).optional(),
  ability_index: z.number().int().nonnegative().optional(),
}).strict();

export const invalidationSchema = z.object({
  type: z.literal("game.v1.version_advanced"),
  occurred_at: z.string().datetime(),
  game_id: z.string().min(1),
  version: z.number().int().positive(),
  reason: actionTypeSchema.or(z.literal("join")),
}).strict();

export const apiErrorSchema = z.object({
  error: z.literal(true),
  code: z.string(),
  message: z.string(),
}).strict();

export type CardView = z.infer<typeof cardViewSchema>;
export type Projection = z.infer<typeof projectionSchema>;
export type LobbyResult = z.infer<typeof lobbyResultSchema>;
export type CommandResult = z.infer<typeof commandResultSchema>;
export type Invalidation = z.infer<typeof invalidationSchema>;
export type ActionDescriptor = z.infer<typeof actionViewSchema>;
export type ActionType = z.infer<typeof actionTypeSchema>;
export type CommandPayload = z.infer<typeof commandPayloadSchema>;

import { z } from "zod";

export const cardKindSchema = z.enum(["monster", "curse", "door", "treasure"]);
export const phaseSchema = z.enum([
  "open_door",
  "combat_decision",
  "loot_decision",
  "end_turn",
]);
export const statusSchema = z.enum(["lobby", "active", "finished"]);

export const cardViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: cardKindSchema,
  combat_strength: z.number().int().positive().optional(),
  treasure_count: z.number().int().positive().optional(),
  rules_text: z.string().max(800).optional(),
  flavor_text: z.string().max(300).optional(),
  image: z.string().regex(/^assets\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/).optional(),
  alt_text: z.string().min(1).max(200).optional(),
}).strict();

export const selfViewSchema = z.object({
  player_id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().positive(),
  combat_bonus: z.number().int(),
  hand: z.array(cardViewSchema),
}).strict();

export const otherPlayerViewSchema = z.object({
  player_id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().positive(),
  combat_bonus: z.number().int(),
  hand_count: z.number().int().nonnegative(),
}).strict();

export const turnViewSchema = z.object({
  player_id: z.string(),
  phase: phaseSchema.or(z.literal("")),
  encounter: cardViewSchema.optional(),
  available_actions: z.array(z.enum([
    "open_door",
    "fight",
    "run_away",
    "loot",
    "end_turn",
  ])).nullable().transform((value) => value ?? []),
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
  treasure_deck_count: z.number().int().nonnegative(),
  winner_player_id: z.string().optional(),
  content_set_id: z.string().min(1),
  content_version: z.number().int().positive(),
}).strict();

export const lobbySummarySchema = z.object({
  game_id: z.string().min(1),
  version: z.number().int().positive(),
  status: statusSchema,
  player_count: z.number().int().positive(),
  max_players: z.number().int().positive(),
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

export const invalidationSchema = z.object({
  type: z.literal("game.v1.version_advanced"),
  occurred_at: z.string().datetime(),
  game_id: z.string().min(1),
  version: z.number().int().positive(),
  reason: z.string().min(1),
}).strict();

export const apiErrorSchema = z.object({
  error: z.literal(true),
  code: z.string(),
  message: z.string(),
}).strict();

export type Projection = z.infer<typeof projectionSchema>;
export type LobbyResult = z.infer<typeof lobbyResultSchema>;
export type CommandResult = z.infer<typeof commandResultSchema>;
export type Invalidation = z.infer<typeof invalidationSchema>;

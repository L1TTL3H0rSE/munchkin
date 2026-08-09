import {z} from "zod";

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
  bad_stuff_text: z.string().trim().min(1).refine(
    (value) => [...value].length <= 400,
    "bad_stuff_text must contain at most 400 Unicode code points",
  ).optional(),
  flavor_text: z.string().max(300).optional(),
  image: z.string()
    .regex(/^assets\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|jpe?g|png|webp)$/)
    .optional(),
  alt_text: z.string().min(1).max(200).optional(),
}).strict().superRefine((card, context) => {
  if (card.bad_stuff_text !== undefined && card.kind !== "monster") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["bad_stuff_text"],
      message: "bad_stuff_text is only valid for monster cards",
    });
  }
});

export type CardView = z.infer<typeof cardViewSchema>;

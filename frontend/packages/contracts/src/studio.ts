import {z} from "zod";

import {cardKindSchema, deckKindSchema} from "./card.ts";

export const studioCardIDSchema = z.string()
  .min(1)
  .max(96)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const studioQualitySchema = z.enum(["low", "medium", "high"]);
export const studioSizeSchema = z.literal("1024x1536");
export const studioProviderSchema = z.enum(["fake", "openai"]);
export const studioJobStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "failed",
  "interrupted",
  "approved",
]);

const studioBriefFieldSchema = z.string().trim().min(1).max(240);

export const studioArtBriefSchema = z.object({
  subject: studioBriefFieldSchema,
  setting: studioBriefFieldSchema,
  action: studioBriefFieldSchema,
  composition: studioBriefFieldSchema,
  palette: studioBriefFieldSchema,
  mood: studioBriefFieldSchema,
  exclusions: z.string().trim().min(1).max(400),
}).strict();

export const studioGenerationSettingsSchema = z.object({
  quality: studioQualitySchema,
  size: studioSizeSchema,
}).strict();

export const studioCompileRequestSchema = z.object({
  card_id: studioCardIDSchema,
  brief: studioArtBriefSchema,
  settings: studioGenerationSettingsSchema,
}).strict();

export const studioCompileResultSchema = z.object({
  prompt: z.string().min(1).max(4000),
  prompt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();

export const studioGenerateRequestSchema = studioCompileRequestSchema.extend({
  request_id: z.string().uuid(),
}).strict();

export const studioCardDefinitionSchema = z.object({
  id: studioCardIDSchema,
  name: z.string().min(1).max(120),
  deck: deckKindSchema,
  kind: cardKindSchema,
  art_status: z.enum(["missing", "generated", "approved"]),
  image: z.string()
    .regex(/^assets\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/)
    .optional(),
  alt_text: z.string().min(1).max(200).optional(),
}).strict();

export const studioProviderInfoSchema = z.object({
  provider: studioProviderSchema,
  model: z.string().min(1).max(120),
  size: studioSizeSchema,
  default_quality: studioQualitySchema,
  real_generation: z.boolean(),
  cost_warning: z.string().min(1).max(400),
}).strict();

export const studioCardsResultSchema = z.object({
  source_set_id: z.literal("moscow-core"),
  source_version: z.literal(1),
  source_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  cards: z.array(studioCardDefinitionSchema),
  provider: studioProviderInfoSchema,
}).strict();

export const studioJobErrorSchema = z.object({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(240),
}).strict();

export const studioJobSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid(),
  card_id: studioCardIDSchema,
  status: studioJobStatusSchema,
  provider: studioProviderSchema,
  model: z.string().min(1).max(120),
  quality: studioQualitySchema,
  size: studioSizeSchema,
  prompt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  preview_url: z.string().startsWith("/api/studio/jobs/").optional(),
  output_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  error: studioJobErrorSchema.optional(),
}).strict();

export const studioJobsResultSchema = z.object({
  jobs: z.array(studioJobSchema),
}).strict();

export const studioApproveRequestSchema = z.object({
  alt_text: z.string().trim().min(1).max(200),
}).strict();

export const studioApprovalSchema = z.object({
  job_id: z.string().uuid(),
  card_id: studioCardIDSchema,
  asset_path: z.string()
    .regex(/^assets\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/),
  output_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  content_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  approved_at: z.string().datetime(),
  idempotent: z.boolean(),
}).strict();

export const studioAPIErrorSchema = z.object({
  error: z.literal(true),
  code: z.enum([
    "STUDIO_DISABLED",
    "UNAUTHORIZED",
    "INVALID_REQUEST",
    "NOT_FOUND",
    "CONFLICT",
    "PROVIDER_UNAVAILABLE",
    "GENERATION_FAILED",
    "INVALID_IMAGE",
    "INTERNAL_ERROR",
  ]),
  message: z.string().min(1).max(240),
}).strict();

export type StudioArtBrief = z.infer<typeof studioArtBriefSchema>;
export type StudioGenerationSettings = z.infer<
  typeof studioGenerationSettingsSchema
>;
export type StudioCompileRequest = z.infer<typeof studioCompileRequestSchema>;
export type StudioCompileResult = z.infer<typeof studioCompileResultSchema>;
export type StudioGenerateRequest = z.infer<typeof studioGenerateRequestSchema>;
export type StudioApproveRequest = z.infer<typeof studioApproveRequestSchema>;
export type StudioCardDefinition = z.infer<typeof studioCardDefinitionSchema>;
export type StudioProviderInfo = z.infer<typeof studioProviderInfoSchema>;
export type StudioCardsResult = z.infer<typeof studioCardsResultSchema>;
export type StudioJob = z.infer<typeof studioJobSchema>;
export type StudioJobsResult = z.infer<typeof studioJobsResultSchema>;
export type StudioApproval = z.infer<typeof studioApprovalSchema>;

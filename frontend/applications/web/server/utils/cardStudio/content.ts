import {
  access,
  lstat,
  mkdir,
  realpath,
  rename,
  rm,
  unlink,
} from "node:fs/promises";
import {createHash, randomUUID} from "node:crypto";
import path from "node:path";
import {z} from "zod";
import {
  cardKindSchema,
  deckKindSchema,
  studioApprovalSchema,
  studioCardIDSchema,
  studioProviderSchema,
  studioQualitySchema,
  studioSizeSchema,
  type StudioApproval,
} from "@munchkin/contracts";
import {StudioError} from "./errors";
import {
  assertInside,
  atomicWriteFile,
  isNodeError,
  readSafeFile,
  resolveRelative,
} from "./filesystem";
import {sniffImageMime} from "./image";
import type {InternalStudioJob} from "./types";

export const MOSCOW_V1_DIGEST =
  "sha256:e87f280cc53667659c38308dc213510749c8c87495c38cefc07f58f8bb094854";
const SOURCE_PACK_PATH = "content/sets/moscow/v1/cards.json";
const MOSCOW_ROOT_PATH = "content/sets/moscow";
const TRANSACTION_FILE = ".v2-transaction.json";

const sourceCardSchema = z.object({
  id: studioCardIDSchema,
  name: z.string().min(1).max(120),
  deck: deckKindSchema,
  kind: cardKindSchema,
}).passthrough();

const sourcePackSchema = z.object({
  schema_version: z.literal(1),
  set_id: z.literal("moscow-core"),
  version: z.literal(1),
  author: z.string().min(1),
  license: z.string().min(1),
  source: z.string().min(1),
  content_digest: z.literal(MOSCOW_V1_DIGEST),
  cards: z.array(sourceCardSchema).length(168),
}).passthrough();

const draftPackSchema = sourcePackSchema.extend({
  version: z.literal(2),
  source: z.literal("original-moscow-core-visual-2026"),
  content_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();

const provenanceQualitySchema = z.union([
  studioQualitySchema,
  z.literal("unexposed"),
]);

const provenanceRecordSchema = z.object({
  card_id: studioCardIDSchema,
  asset_path: z.string()
    .regex(/^assets\/[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/),
  alt_text: z.string().min(1).max(200),
  provider: studioProviderSchema,
  model: z.string().min(1).max(120),
  quality: provenanceQualitySchema,
  size: studioSizeSchema,
  prompt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  output_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  provider_request_id: z.string().min(1).max(240),
  approved_at: z.string().datetime(),
}).strict().superRefine((record, context) => {
  const hasBuiltInMarker = record.quality === "unexposed" ||
    record.model === "codex-imagegen-built-in";
  const isBuiltInImageGen = record.provider === "openai" &&
    record.model === "codex-imagegen-built-in" &&
    record.quality === "unexposed";
  if (hasBuiltInMarker && !isBuiltInImageGen) {
    context.addIssue({
      code: "custom",
      path: ["quality"],
      message: "unexposed quality is reserved for built-in ImageGen",
    });
  }
});

export const provenanceManifestSchema = z.object({
  schema_version: z.literal(1),
  set_id: z.literal("moscow-core"),
  version: z.literal(2),
  status: z.enum(["draft", "published"]),
  source_version: z.literal(1),
  source_digest: z.literal(MOSCOW_V1_DIGEST),
  content_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  records: z.array(provenanceRecordSchema),
}).strict();

const draftTransactionSchema = z.object({
  schema_version: z.literal(1),
  stage_name: z.string().regex(/^\.v2-stage-[0-9a-f-]{36}$/),
  backup_name: z.string().regex(/^\.v2-backup-[0-9a-f-]{36}$/),
  expected_state_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();

export type MoscowSourcePack = z.infer<typeof sourcePackSchema>;
export type MoscowDraftPack = z.infer<typeof draftPackSchema>;
export type ProvenanceManifest = z.infer<typeof provenanceManifestSchema>;

export async function findRepositoryRoot(start = process.cwd()) {
  let current = path.resolve(start);
  for (let depth = 0; depth < 8; depth++) {
    try {
      await access(path.join(current, SOURCE_PACK_PATH));
      return realpath(current);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
  }
  throw new StudioError(
    "PROVIDER_UNAVAILABLE",
    "Card Studio не нашла repository content root.",
    503,
  );
}

export async function loadMoscowSourcePack(repositoryRoot: string) {
  const raw = await readSafeFile(repositoryRoot, SOURCE_PACK_PATH);
  const pack = sourcePackSchema.parse(parseJSON(raw));
  if (cardsDigest(pack.cards) !== MOSCOW_V1_DIGEST) {
    throw new StudioError(
      "CONFLICT",
      "Immutable Moscow v1 не совпадает с ожидаемым digest.",
      409,
    );
  }
  return pack;
}

export async function loadMoscowDraft(
  repositoryRoot: string,
): Promise<{
  pack: MoscowDraftPack;
  provenance: ProvenanceManifest;
} | undefined> {
  const moscowRoot = await safeMoscowRoot(repositoryRoot);
  if (await pathExists(path.join(moscowRoot, TRANSACTION_FILE))) {
    throw new StudioError(
      "CONFLICT",
      "Moscow v2 имеет незавершённую approval transaction.",
      409,
    );
  }
  const draftRoot = resolveRelative(moscowRoot, "v2");
  if (!await pathExists(draftRoot)) {
    return undefined;
  }
  const safeDraftRoot = await safeChildDirectory(moscowRoot, draftRoot);
  const source = await loadMoscowSourcePack(repositoryRoot);
  return validateDraftDirectory(safeDraftRoot, source);
}

export async function approveIntoMoscowDraft(options: {
  repositoryRoot: string;
  job: InternalStudioJob;
  candidate: Buffer;
  altText: string;
}): Promise<StudioApproval> {
  const {repositoryRoot, job, candidate, altText} = options;
  if (
    !job.provider_request_id ||
    !job.output_sha256 ||
    job.output_sha256 !== sha256Buffer(candidate)
  ) {
    throw new StudioError(
      "CONFLICT",
      "Candidate metadata не совпадает с job.",
      409,
    );
  }
  const source = await loadMoscowSourcePack(repositoryRoot);
  const sourceCard = source.cards.find((card) => card.id === job.card_id);
  if (!sourceCard) {
    throw new StudioError("NOT_FOUND", "Card definition не найдена.", 404);
  }
  const existing = await loadMoscowDraft(repositoryRoot);
  const assetPath = `assets/${job.card_id}.webp`;
  const existingRecord = existing?.provenance.records.find(
    (entry) => entry.card_id === job.card_id,
  );
  if (
    existing &&
    existingRecord &&
    approvalRecordMatches(existingRecord, job, assetPath, altText)
  ) {
    return studioApprovalSchema.parse({
      job_id: job.id,
      card_id: job.card_id,
      asset_path: assetPath,
      output_sha256: job.output_sha256,
      content_digest: existing.pack.content_digest,
      approved_at: existingRecord.approved_at,
      idempotent: true,
    });
  }
  if (existing?.provenance.status === "published") {
    throw new StudioError(
      "CONFLICT",
      "Published Moscow v2 immutable; создайте следующую version.",
      409,
    );
  }
  const pack = existing
    ? structuredClone(existing.pack)
    : createDraftPack(source);
  const card = pack.cards.find((entry) => entry.id === job.card_id);
  if (!card) {
    throw new StudioError("CONFLICT", "Draft потерял source card.", 409);
  }
  card.image = assetPath;
  card.alt_text = altText;
  const nextDigest = cardsDigest(pack.cards);
  pack.content_digest = nextDigest;
  const approvedAt = new Date().toISOString();
  const record = provenanceRecordSchema.parse({
    card_id: job.card_id,
    asset_path: assetPath,
    alt_text: altText,
    provider: job.provider,
    model: job.model,
    quality: job.quality,
    size: job.size,
    prompt_hash: job.prompt_hash,
    output_sha256: job.output_sha256,
    provider_request_id: job.provider_request_id,
    approved_at: approvedAt,
  });
  const provenance = existing
    ? structuredClone(existing.provenance)
    : createProvenance();
  provenance.records = provenance.records
    .filter((entry) => entry.card_id !== job.card_id)
    .concat(record)
    .sort((left, right) => left.card_id.localeCompare(right.card_id));
  provenance.content_digest = nextDigest;

  const checkedPack = draftPackSchema.parse(pack);
  const checkedProvenance = provenanceManifestSchema.parse(provenance);
  await replaceDraftDirectory({
    repositoryRoot,
    source,
    existing,
    pack: checkedPack,
    provenance: checkedProvenance,
    assetPath,
    candidate,
  });
  return studioApprovalSchema.parse({
    job_id: job.id,
    card_id: job.card_id,
    asset_path: assetPath,
    output_sha256: job.output_sha256,
    content_digest: nextDigest,
    approved_at: approvedAt,
    idempotent: false,
  });
}

export async function recoverMoscowDraftTransaction(repositoryRoot: string) {
  const moscowRoot = await safeMoscowRoot(repositoryRoot);
  let transaction;
  try {
    transaction = draftTransactionSchema.parse(parseJSON(
      await readSafeFile(moscowRoot, TRANSACTION_FILE),
    ));
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return;
    }
    throw error;
  }

  const stagePath = resolveRelative(moscowRoot, transaction.stage_name);
  const backupPath = resolveRelative(moscowRoot, transaction.backup_name);
  const draftPath = resolveRelative(moscowRoot, "v2");
  const source = await loadMoscowSourcePack(repositoryRoot);
  const draftExists = await pathExists(draftPath);
  const stageExists = await pathExists(stagePath);
  const backupExists = await pathExists(backupPath);

  if (draftExists) {
    const current = await validateDraftDirectory(
      await safeChildDirectory(moscowRoot, draftPath),
      source,
    );
    if (
      draftStateDigest(current.pack, current.provenance) ===
        transaction.expected_state_digest
    ) {
      await cleanupDraftTransaction(
        moscowRoot,
        stagePath,
        backupPath,
      );
      return;
    }
  }

  if (stageExists) {
    let staged;
    try {
      staged = await validateDraftDirectory(
        await safeChildDirectory(moscowRoot, stagePath),
        source,
      );
    } catch (error) {
      if (!draftExists && backupExists) {
        await rename(backupPath, draftPath);
        await removeSafeDirectory(moscowRoot, stagePath);
        await unlink(path.join(moscowRoot, TRANSACTION_FILE));
        return;
      }
      throw error;
    }
    if (
      draftStateDigest(staged.pack, staged.provenance) !==
        transaction.expected_state_digest
    ) {
      throw invalidDraft("transaction state digest не совпадает со staging");
    }
    if (draftExists) {
      if (backupExists) {
        throw invalidDraft("transaction содержит ambiguous backup");
      }
      await rename(draftPath, backupPath);
    }
    try {
      await rename(stagePath, draftPath);
      const committed = await validateDraftDirectory(
        await safeChildDirectory(moscowRoot, draftPath),
        source,
      );
      if (
        draftStateDigest(committed.pack, committed.provenance) !==
          transaction.expected_state_digest
      ) {
        throw invalidDraft(
          "committed state digest не совпадает с transaction",
        );
      }
    } catch (error) {
      await removeSafeDirectory(moscowRoot, draftPath);
      if (await pathExists(backupPath)) {
        await rename(backupPath, draftPath);
      }
      await unlink(path.join(moscowRoot, TRANSACTION_FILE))
        .catch(() => undefined);
      throw error;
    }
    await cleanupDraftTransaction(moscowRoot, stagePath, backupPath);
    return;
  }

  if (!draftExists && backupExists) {
    await rename(backupPath, draftPath);
    await unlink(path.join(moscowRoot, TRANSACTION_FILE));
    return;
  }
  throw invalidDraft("approval transaction нельзя восстановить");
}

async function replaceDraftDirectory(options: {
  repositoryRoot: string;
  source: MoscowSourcePack;
  existing: {
    pack: MoscowDraftPack;
    provenance: ProvenanceManifest;
  } | undefined;
  pack: MoscowDraftPack;
  provenance: ProvenanceManifest;
  assetPath: string;
  candidate: Buffer;
}) {
  const {
    repositoryRoot,
    source,
    existing,
    pack,
    provenance,
    assetPath,
    candidate,
  } = options;
  const moscowRoot = await safeMoscowRoot(repositoryRoot);
  if (await pathExists(path.join(moscowRoot, TRANSACTION_FILE))) {
    throw invalidDraft("предыдущая approval transaction не завершена");
  }
  const transactionID = randomUUID();
  const stageName = `.v2-stage-${transactionID}`;
  const backupName = `.v2-backup-${transactionID}`;
  const stagePath = resolveRelative(moscowRoot, stageName);
  await mkdir(stagePath, {mode: 0o700});
  const stageRoot = await safeChildDirectory(moscowRoot, stagePath);
  try {
    if (existing) {
      const currentRoot = await safeChildDirectory(
        moscowRoot,
        resolveRelative(moscowRoot, "v2"),
      );
      for (const record of existing.provenance.records) {
        if (record.asset_path === assetPath) {
          continue;
        }
        await atomicWriteFile(
          stageRoot,
          record.asset_path,
          await readSafeFile(currentRoot, record.asset_path),
        );
      }
    }
    await atomicWriteFile(stageRoot, assetPath, candidate);
    await atomicWriteFile(
      stageRoot,
      "cards.json",
      `${JSON.stringify(pack, null, 2)}\n`,
    );
    await atomicWriteFile(
      stageRoot,
      "provenance.json",
      `${JSON.stringify(provenance, null, 2)}\n`,
    );
    await validateDraftDirectory(stageRoot, source);
    const expectedStateDigest = draftStateDigest(pack, provenance);
    await atomicWriteFile(
      moscowRoot,
      TRANSACTION_FILE,
      `${JSON.stringify({
        schema_version: 1,
        stage_name: stageName,
        backup_name: backupName,
        expected_state_digest: expectedStateDigest,
      }, null, 2)}\n`,
    );
  } catch (error) {
    await removeSafeDirectory(moscowRoot, stagePath);
    throw error;
  }
  await recoverMoscowDraftTransaction(repositoryRoot);
}

async function validateDraftDirectory(
  draftRoot: string,
  source: MoscowSourcePack,
) {
  let packRaw;
  let provenanceRaw;
  try {
    [packRaw, provenanceRaw] = await Promise.all([
      readSafeFile(draftRoot, "cards.json"),
      readSafeFile(draftRoot, "provenance.json"),
    ]);
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      throw invalidDraft("cards.json или provenance.json отсутствует");
    }
    throw error;
  }
  let pack;
  let provenance;
  try {
    pack = draftPackSchema.parse(parseJSON(packRaw));
    provenance = provenanceManifestSchema.parse(parseJSON(provenanceRaw));
  } catch {
    throw invalidDraft("cards.json или provenance.json не прошли проверку");
  }
  if (
    pack.content_digest !== cardsDigest(pack.cards) ||
    provenance.content_digest !== pack.content_digest
  ) {
    throw invalidDraft("pack и provenance digest не совпадают");
  }
  const mechanics = pack.cards.map((card) => {
    const result = {...card};
    delete result.image;
    delete result.alt_text;
    return result;
  });
  if (
    canonicalJSONString(mechanics) !== canonicalJSONString(source.cards)
  ) {
    throw invalidDraft("mechanics отличаются от immutable Moscow v1");
  }

  const recordByCard = new Map(
    provenance.records.map((record) => [record.card_id, record]),
  );
  if (recordByCard.size !== provenance.records.length) {
    throw invalidDraft("provenance содержит duplicate card record");
  }
  let visualCards = 0;
  for (const card of pack.cards) {
    const image = typeof card.image === "string" ? card.image : undefined;
    const altText = typeof card.alt_text === "string"
      ? card.alt_text
      : undefined;
    if (!image && !altText) {
      continue;
    }
    if (
      !image ||
      !altText ||
      image !== `assets/${card.id}.webp`
    ) {
      throw invalidDraft(`visual metadata ${card.id} небезопасна`);
    }
    visualCards++;
    const record = recordByCard.get(card.id);
    if (
      !record ||
      record.asset_path !== image ||
      record.alt_text !== altText
    ) {
      throw invalidDraft(`provenance ${card.id} не совпадает с card`);
    }
    let asset;
    try {
      asset = await readSafeFile(draftRoot, record.asset_path);
    } catch (error) {
      if (isNodeError(error, "ENOENT")) {
        throw invalidDraft(`asset ${card.id} отсутствует`);
      }
      throw error;
    }
    if (
      sniffImageMime(asset) !== "image/webp" ||
      sha256Buffer(asset) !== record.output_sha256
    ) {
      throw invalidDraft(`asset ${card.id} не совпадает с provenance SHA`);
    }
  }
  if (visualCards !== provenance.records.length) {
    throw invalidDraft("visual cards и provenance records не взаимно-однозначны");
  }
  return {pack, provenance};
}

function approvalRecordMatches(
  record: ProvenanceManifest["records"][number],
  job: InternalStudioJob,
  assetPath: string,
  altText: string,
) {
  return record.asset_path === assetPath &&
    record.alt_text === altText &&
    record.provider === job.provider &&
    record.model === job.model &&
    record.quality === job.quality &&
    record.size === job.size &&
    record.prompt_hash === job.prompt_hash &&
    record.output_sha256 === job.output_sha256 &&
    record.provider_request_id === job.provider_request_id;
}

async function safeMoscowRoot(repositoryRoot: string) {
  const root = await realpath(repositoryRoot);
  const moscowRoot = await realpath(path.join(root, MOSCOW_ROOT_PATH));
  assertInside(root, moscowRoot);
  return moscowRoot;
}

async function safeChildDirectory(root: string, candidate: string) {
  const stat = await lstat(candidate);
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw invalidDraft("content directory должна быть обычной directory");
  }
  const resolved = await realpath(candidate);
  assertInside(root, resolved);
  return resolved;
}

async function pathExists(candidate: string) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (isNodeError(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

async function cleanupDraftTransaction(
  moscowRoot: string,
  stagePath: string,
  backupPath: string,
) {
  await removeSafeDirectory(moscowRoot, stagePath);
  await removeSafeDirectory(moscowRoot, backupPath);
  await unlink(path.join(moscowRoot, TRANSACTION_FILE));
}

async function removeSafeDirectory(root: string, candidate: string) {
  if (!await pathExists(candidate)) {
    return;
  }
  await safeChildDirectory(root, candidate);
  await rm(candidate, {recursive: true});
}

function invalidDraft(detail: string) {
  return new StudioError(
    "CONFLICT",
    `Draft Moscow v2 повреждён: ${detail}.`,
    409,
  );
}

export function cardsDigest(cards: unknown[]) {
  const hash = createHash("sha256");
  hash.update("munchkin-cards-v2\n");
  for (const card of cards) {
    const raw = Buffer.from(canonicalJSONString(card), "utf8");
    hash.update(`${raw.length}:`);
    hash.update(raw);
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

export function draftStateDigest(
  pack: MoscowDraftPack,
  provenance: ProvenanceManifest,
) {
  return sha256Buffer(Buffer.from(
    `munchkin-moscow-v2-draft-state-v1\n${canonicalJSONString({
      pack,
      provenance,
    })}\n`,
    "utf8",
  ));
}

export function canonicalJSONString(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJSONString).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJSONString(record[key])}`).join(",")}}`;
}

function createDraftPack(source: MoscowSourcePack): MoscowDraftPack {
  const pack = structuredClone(source) as unknown as MoscowDraftPack;
  pack.version = 2;
  pack.source = "original-moscow-core-visual-2026";
  pack.content_digest = cardsDigest(pack.cards);
  return draftPackSchema.parse(pack);
}

function createProvenance(): ProvenanceManifest {
  return {
    schema_version: 1,
    set_id: "moscow-core",
    version: 2,
    status: "draft",
    source_version: 1,
    source_digest: MOSCOW_V1_DIGEST,
    content_digest: MOSCOW_V1_DIGEST,
    records: [],
  };
}

function parseJSON(raw: Buffer) {
  try {
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(raw));
  } catch {
    throw new StudioError(
      "CONFLICT",
      "Card Studio data содержит invalid UTF-8 или JSON.",
      409,
    );
  }
}

function sha256Buffer(buffer: Buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

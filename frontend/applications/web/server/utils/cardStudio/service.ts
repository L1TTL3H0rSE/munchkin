import path from "node:path";
import {
  studioApprovalSchema,
  studioApproveRequestSchema,
  studioCardsResultSchema,
  studioCompileRequestSchema,
  studioCompileResultSchema,
  studioGenerateRequestSchema,
  studioJobsResultSchema,
  type StudioApproveRequest,
  type StudioCompileRequest,
  type StudioGenerateRequest,
} from "@munchkin/contracts";
import type {CardStudioConfig} from "./config";
import {providerInfo} from "./config";
import {
  approveIntoMoscowDraft,
  canonicalJSONString,
  findRepositoryRoot,
  loadMoscowDraft,
  loadMoscowSourcePack,
  recoverMoscowDraftTransaction,
} from "./content";
import {safeStudioError, StudioError} from "./errors";
import {normalizeCandidateImage, sniffImageMime} from "./image";
import {compileCardArtPrompt, sha256} from "./prompt";
import {createCardArtProvider} from "./provider";
import {CardStudioStore, publicStudioJob} from "./store";
import type {CardArtProvider, InternalStudioJob} from "./types";

export class CardStudioService {
  readonly config: CardStudioConfig;
  readonly repositoryRoot: string;
  readonly store: CardStudioStore;
  readonly provider: CardArtProvider;

  private constructor(options: {
    config: CardStudioConfig;
    repositoryRoot: string;
    store: CardStudioStore;
    provider: CardArtProvider;
  }) {
    this.config = options.config;
    this.repositoryRoot = options.repositoryRoot;
    this.store = options.store;
    this.provider = options.provider;
  }

  static async create(
    config: CardStudioConfig,
    overrides: {
      repositoryRoot?: string;
      dataRoot?: string;
      provider?: CardArtProvider;
    } = {},
  ) {
    const repositoryRoot = overrides.repositoryRoot ??
      await findRepositoryRoot();
    const dataRoot = overrides.dataRoot ??
      (path.isAbsolute(config.dataDir)
        ? path.resolve(config.dataDir)
        : path.resolve(repositoryRoot, config.dataDir));
    const store = await CardStudioStore.open(dataRoot);
    await store.withMoscowDraftLock(
      () => recoverMoscowDraftTransaction(repositoryRoot),
    );
    return new CardStudioService({
      config,
      repositoryRoot,
      store,
      provider: overrides.provider ?? createCardArtProvider(config),
    });
  }

  async listCards() {
    const [source, draft, jobs] = await Promise.all([
      loadMoscowSourcePack(this.repositoryRoot),
      loadMoscowDraft(this.repositoryRoot),
      this.store.listJobs(),
    ]);
    const generated = new Set(
      jobs
        .filter((job) => job.status === "succeeded")
        .map((job) => job.card_id),
    );
    const approved = new Map(
      (draft?.pack.cards ?? [])
        .filter((card) => card.image && card.alt_text)
        .map((card) => [card.id, card]),
    );
    return studioCardsResultSchema.parse({
      source_set_id: source.set_id,
      source_version: source.version,
      source_digest: source.content_digest,
      provider: providerInfo(this.config),
      cards: source.cards.map((card) => {
        const visual = approved.get(card.id);
        return {
          id: card.id,
          name: card.name,
          deck: card.deck,
          kind: card.kind,
          art_status: visual
            ? "approved"
            : generated.has(card.id) ? "generated" : "missing",
          ...(visual?.image ? {image: visual.image} : {}),
          ...(visual?.alt_text ? {alt_text: visual.alt_text} : {}),
        };
      }),
    });
  }

  async compile(input: StudioCompileRequest) {
    const request = studioCompileRequestSchema.parse(input);
    const card = await this.sourceCard(request.card_id);
    return studioCompileResultSchema.parse(
      compileCardArtPrompt(card.name, request.brief),
    );
  }

  async queueGeneration(input: StudioGenerateRequest) {
    const request = studioGenerateRequestSchema.parse(input);
    const card = await this.sourceCard(request.card_id);
    const compiled = compileCardArtPrompt(card.name, request.brief);
    const requestFingerprint = sha256(canonicalJSONString(request));
    const result = await this.store.createOrReuseJob({
      request_id: request.request_id,
      request_fingerprint: requestFingerprint,
      card_id: request.card_id,
      status: "queued",
      provider: this.provider.id,
      model: this.provider.model,
      quality: request.settings.quality,
      size: request.settings.size,
      prompt: compiled.prompt,
      prompt_hash: compiled.prompt_hash,
      brief: request.brief,
    });
    return {
      job: publicStudioJob(result.job),
      created: result.created,
    };
  }

  async runJob(jobID: string) {
    const job = await this.store.claimQueuedJob(jobID);
    if (!job) {
      return this.getJob(jobID);
    }
    try {
      const providerResult = await withTimeout(
        this.provider.generate({
          prompt: job.prompt,
          quality: job.quality,
          size: job.size,
        }),
        this.config.jobTimeoutMs,
      );
      if (providerResult.model !== job.model) {
        throw new StudioError(
          "GENERATION_FAILED",
          "Provider model metadata не совпадает с job.",
          502,
        );
      }
      const normalized = await normalizeCandidateImage(
        providerResult,
        this.config.maxImageBytes,
      );
      await this.store.writeCandidate(job.id, normalized.bytes);
      const finished = await this.store.updateJob(job.id, (current) => ({
        ...current,
        status: "succeeded",
        provider_request_id: providerResult.providerRequestID,
        output_sha256: normalized.output_sha256,
        error: undefined,
      }));
      return publicStudioJob(finished);
    } catch (error) {
      const safe = safeStudioError(error);
      const failed = await this.store.updateJob(job.id, (current) => ({
        ...current,
        status: "failed",
        error: {
          code: safe.code,
          message: safe.code === "INVALID_IMAGE"
            ? safe.message
            : "Генерация не завершена. Повторите явным действием.",
        },
      }));
      return publicStudioJob(failed);
    }
  }

  async getJob(jobID: string) {
    return publicStudioJob(await this.store.readJob(jobID));
  }

  async listJobs(cardID?: string) {
    if (
      cardID !== undefined &&
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cardID)
    ) {
      throw new StudioError("INVALID_REQUEST", "Invalid card ID.", 400);
    }
    const jobs = await this.store.listJobs(cardID);
    return studioJobsResultSchema.parse({
      jobs: jobs.map(publicStudioJob),
    });
  }

  async candidate(jobID: string) {
    const job = await this.store.readJob(jobID);
    if (job.status !== "succeeded" && job.status !== "approved") {
      throw new StudioError("NOT_FOUND", "Candidate ещё не готов.", 404);
    }
    const bytes = await this.store.readCandidate(job.id);
    if (
      sniffImageMime(bytes) !== "image/webp" ||
      sha256(bytes) !== job.output_sha256
    ) {
      throw new StudioError(
        "CONFLICT",
        "Candidate bytes не совпадают с job metadata.",
        409,
      );
    }
    return bytes;
  }

  async approve(jobID: string, input: StudioApproveRequest) {
    const request = studioApproveRequestSchema.parse(input);
    return this.store.withMoscowDraftLock(
      async () => {
        await recoverMoscowDraftTransaction(this.repositoryRoot);
        const job = await this.store.readJob(jobID);
        if (job.approval) {
          return studioApprovalSchema.parse({
            ...job.approval,
            idempotent: true,
          });
        }
        assertApprovable(job);
        const candidate = await this.candidate(job.id);
        const approval = await approveIntoMoscowDraft({
          repositoryRoot: this.repositoryRoot,
          job,
          candidate,
          altText: request.alt_text,
        });
        await this.store.updateJob(job.id, (current) => ({
          ...current,
          status: "approved",
          approval,
        }));
        return approval;
      },
    );
  }

  private async sourceCard(cardID: string) {
    const source = await loadMoscowSourcePack(this.repositoryRoot);
    const card = source.cards.find((entry) => entry.id === cardID);
    if (!card) {
      throw new StudioError("NOT_FOUND", "Card definition не найдена.", 404);
    }
    return card;
  }
}

function assertApprovable(job: InternalStudioJob) {
  if (
    job.status !== "succeeded" ||
    !job.output_sha256 ||
    !job.provider_request_id
  ) {
    throw new StudioError(
      "CONFLICT",
      "Approve доступен только для завершённого candidate.",
      409,
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new StudioError(
          "GENERATION_FAILED",
          "Image provider превысил timeout.",
          504,
        )), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

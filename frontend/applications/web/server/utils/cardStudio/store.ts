import {randomUUID} from "node:crypto";
import path from "node:path";
import {z} from "zod";
import {
  studioApprovalSchema,
  studioArtBriefSchema,
  studioJobSchema,
  studioJobStatusSchema,
  studioProviderSchema,
  studioQualitySchema,
  studioSizeSchema,
  type StudioJob,
} from "@munchkin/contracts";
import {StudioError} from "./errors";
import {
  atomicWriteFile,
  ensureSafeRoot,
  isNodeError,
  listSafeFiles,
  readSafeFile,
  withStudioLock,
} from "./filesystem";
import type {InternalStudioJob} from "./types";

const jobIDSchema = z.string().uuid();
const internalJobSchema = z.object({
  id: jobIDSchema,
  request_id: z.string().uuid(),
  request_fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  card_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  status: studioJobStatusSchema,
  provider: studioProviderSchema,
  model: z.string().min(1).max(120),
  quality: studioQualitySchema,
  size: studioSizeSchema,
  prompt: z.string().min(1).max(4000),
  prompt_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  brief: studioArtBriefSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  provider_request_id: z.string().min(1).max(240).optional(),
  output_sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  error: z.object({
    code: z.string().min(1).max(80),
    message: z.string().min(1).max(240),
  }).strict().optional(),
  approval: studioApprovalSchema.optional(),
}).strict();

const requestIndexSchema = z.object({
  request_fingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  job_id: jobIDSchema,
}).strict();

export class CardStudioStore {
  readonly root: string;

  private constructor(root: string) {
    this.root = root;
  }

  static async open(root: string) {
    const safeRoot = await ensureSafeRoot(root);
    const store = new CardStudioStore(safeRoot);
    await withStudioLock(
      store.root,
      "jobs",
      () => store.recoverInterruptedJobs(),
    );
    return store;
  }

  async createOrReuseJob(
    input: Omit<InternalStudioJob, "id" | "created_at" | "updated_at">,
  ) {
    return withStudioLock(this.root, "jobs", async () => {
      const indexPath = requestPath(input.request_id);
      try {
        const index = requestIndexSchema.parse(
          parseJSON(await readSafeFile(this.root, indexPath)),
        );
        if (index.request_fingerprint !== input.request_fingerprint) {
          throw new StudioError(
            "CONFLICT",
            "request_id уже связан с другим generation intent.",
            409,
          );
        }
        return {
          job: await this.readJob(index.job_id),
          created: false,
        };
      } catch (error) {
        if (!isNodeError(error, "ENOENT")) {
          throw error;
        }
      }
      const now = new Date().toISOString();
      const job = internalJobSchema.parse({
        ...input,
        id: randomUUID(),
        created_at: now,
        updated_at: now,
      });
      await this.writeJob(job);
      await atomicWriteFile(
        this.root,
        indexPath,
        json({
          request_fingerprint: job.request_fingerprint,
          job_id: job.id,
        }),
      );
      return {job, created: true};
    });
  }

  async readJob(jobID: string) {
    const safeID = jobIDSchema.parse(jobID);
    return internalJobSchema.parse(
      parseJSON(await readSafeFile(this.root, jobPath(safeID))),
    );
  }

  async listJobs(cardID?: string) {
    const names = await listSafeFiles(this.root, "jobs");
    const jobs: InternalStudioJob[] = [];
    for (const name of names) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(name)) {
        throw new StudioError(
          "CONFLICT",
          "Job store содержит unexpected file.",
          409,
        );
      }
      const job = internalJobSchema.parse(
        parseJSON(await readSafeFile(this.root, `jobs/${name}`)),
      );
      if (!cardID || job.card_id === cardID) {
        jobs.push(job);
      }
    }
    return jobs.sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at));
  }

  async claimQueuedJob(jobID: string) {
    return withStudioLock(this.root, "jobs", async () => {
      const job = await this.readJob(jobID);
      if (job.status !== "queued") {
        return undefined;
      }
      const claimed = internalJobSchema.parse({
        ...job,
        status: "running",
        updated_at: new Date().toISOString(),
      });
      await this.writeJob(claimed);
      return claimed;
    });
  }

  async updateJob(
    jobID: string,
    update: (job: InternalStudioJob) => InternalStudioJob,
  ) {
    return withStudioLock(this.root, "jobs", async () => {
      const current = await this.readJob(jobID);
      const next = internalJobSchema.parse({
        ...update(structuredClone(current)),
        updated_at: new Date().toISOString(),
      });
      if (next.id !== current.id || next.request_id !== current.request_id) {
        throw new StudioError("CONFLICT", "Job identity immutable.", 409);
      }
      await this.writeJob(next);
      return next;
    });
  }

  async writeCandidate(jobID: string, bytes: Buffer) {
    const safeID = jobIDSchema.parse(jobID);
    await atomicWriteFile(this.root, candidatePath(safeID), bytes);
  }

  async readCandidate(jobID: string) {
    const safeID = jobIDSchema.parse(jobID);
    return readSafeFile(this.root, candidatePath(safeID));
  }

  async withMoscowDraftLock<T>(callback: () => Promise<T>) {
    return withStudioLock(this.root, "approve-moscow-v2", callback);
  }

  private async recoverInterruptedJobs() {
    const names = await listSafeFiles(this.root, "jobs");
    for (const name of names) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(name)) {
        continue;
      }
      const job = internalJobSchema.parse(
        parseJSON(await readSafeFile(this.root, `jobs/${name}`)),
      );
      if (job.status !== "queued" && job.status !== "running") {
        continue;
      }
      await this.writeJob(internalJobSchema.parse({
        ...job,
        status: "interrupted",
        updated_at: new Date().toISOString(),
        error: {
          code: "INTERRUPTED",
          message: "Server restart прервал job; повторите явным действием.",
        },
      }));
    }
  }

  private async writeJob(job: InternalStudioJob) {
    const parsed = internalJobSchema.parse(job);
    await atomicWriteFile(this.root, jobPath(parsed.id), json(parsed));
  }
}

export function publicStudioJob(job: InternalStudioJob): StudioJob {
  const preview = job.status === "succeeded" || job.status === "approved";
  return studioJobSchema.parse({
    id: job.id,
    request_id: job.request_id,
    card_id: job.card_id,
    status: job.status,
    provider: job.provider,
    model: job.model,
    quality: job.quality,
    size: job.size,
    prompt_hash: job.prompt_hash,
    created_at: job.created_at,
    updated_at: job.updated_at,
    ...(preview
      ? {preview_url: `/api/studio/jobs/${job.id}/image`}
      : {}),
    ...(job.output_sha256 ? {output_sha256: job.output_sha256} : {}),
    ...(job.error ? {error: job.error} : {}),
  });
}

function jobPath(jobID: string) {
  return path.posix.join("jobs", `${jobID}.json`);
}

function candidatePath(jobID: string) {
  return path.posix.join("candidates", `${jobID}.webp`);
}

function requestPath(requestID: string) {
  return path.posix.join("requests", `${requestID}.json`);
}

function parseJSON(raw: Buffer) {
  try {
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(raw));
  } catch {
    throw new StudioError(
      "CONFLICT",
      "Job store содержит invalid UTF-8 или JSON.",
      409,
    );
  }
}

function json(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

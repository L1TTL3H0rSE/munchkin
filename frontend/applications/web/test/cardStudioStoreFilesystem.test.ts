import {mkdtemp, rm, symlink, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {
  atomicWriteFile,
  readSafeFile,
  withStudioLock,
} from "../server/utils/cardStudio/filesystem";
import {CardStudioStore} from "../server/utils/cardStudio/store";

const temporaryRoots: string[] = [];
const brief = {
  subject: "Городской объект",
  setting: "Самостоятельная городская сцена",
  action: "Ясное действие",
  composition: "Крупный силуэт",
  palette: "Графит и лайм",
  mood: "Городской абсурд",
  exclusions: "Без текста и логотипов",
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(
    (root) => rm(root, {recursive: true, force: true}),
  ));
});

describe("Card Studio filesystem boundary", () => {
  it("writes atomically inside the selected root and rejects traversal", async () => {
    const root = await temporaryRoot("studio-files-");
    await atomicWriteFile(root, "jobs/safe.json", "{\"ok\":true}\n");
    expect((await readSafeFile(root, "jobs/safe.json")).toString("utf8"))
      .toContain("\"ok\"");
    await expect(atomicWriteFile(
      root,
      "../outside.json",
      "unsafe",
    )).rejects.toMatchObject({code: "INVALID_REQUEST"});
    await expect(atomicWriteFile(
      root,
      "jobs\\..\\outside.json",
      "unsafe",
    )).rejects.toMatchObject({code: "INVALID_REQUEST"});
  });

  it("rejects a pre-existing symlink target when the platform permits it", async () => {
    const root = await temporaryRoot("studio-link-");
    const outside = path.join(root, "outside.txt");
    await writeFile(outside, "outside");
    await atomicWriteFile(root, "jobs/seed.json", "{}");
    const link = path.join(root, "jobs", "linked.json");
    try {
      await symlink(outside, link, "file");
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        ["EPERM", "EACCES"].includes(
          String((error as NodeJS.ErrnoException).code),
        )
      ) {
        return;
      }
      throw error;
    }
    await expect(atomicWriteFile(
      root,
      "jobs/linked.json",
      "unsafe",
    )).rejects.toMatchObject({code: "INVALID_REQUEST"});
    await expect(readSafeFile(
      root,
      "jobs/linked.json",
    )).rejects.toMatchObject({code: "INVALID_REQUEST"});
  });
});

describe("Card Studio job store", () => {
  it("ignores a legacy stale lock artifact", async () => {
    const root = await temporaryRoot("studio-stale-lock-");
    await atomicWriteFile(
      root,
      "locks/jobs.lock",
      `${JSON.stringify({
        schema_version: 1,
        pid: process.pid,
        process_started_at_ms: 1,
        owner_id: "018f47a6-7884-7d15-a0cf-4ac22462f7e2",
        created_at: "2026-01-01T00:00:00.000Z",
      })}\n`,
    );

    const store = await CardStudioStore.open(root);
    const created = await store.createOrReuseJob(jobInput());
    expect(created.created).toBe(true);
    expect(created.job.status).toBe("queued");
  });

  it("serializes concurrent callbacks with an OS-owned lock", async () => {
    const root = await temporaryRoot("studio-os-lock-");
    let active = 0;
    let maximumActive = 0;
    const run = () => withStudioLock(root, "concurrency-test", async () => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 40));
      active--;
    });

    await Promise.all([run(), run()]);
    expect(maximumActive).toBe(1);
  });

  it("reuses an exact request and rejects request-id fingerprint drift", async () => {
    const root = await temporaryRoot("studio-store-");
    const store = await CardStudioStore.open(root);
    const input = jobInput();
    const first = await store.createOrReuseJob(input);
    const replay = await store.createOrReuseJob(input);
    expect(first.created).toBe(true);
    expect(replay.created).toBe(false);
    expect(replay.job.id).toBe(first.job.id);
    await expect(store.createOrReuseJob({
      ...input,
      request_fingerprint: `sha256:${"b".repeat(64)}`,
    })).rejects.toMatchObject({code: "CONFLICT"});
  });

  it("marks nonterminal jobs interrupted after restart without rerunning", async () => {
    const root = await temporaryRoot("studio-recovery-");
    const store = await CardStudioStore.open(root);
    const created = await store.createOrReuseJob(jobInput());
    expect(created.job.status).toBe("queued");

    const reopened = await CardStudioStore.open(root);
    const recovered = await reopened.readJob(created.job.id);
    expect(recovered.status).toBe("interrupted");
    expect(recovered.error).toMatchObject({code: "INTERRUPTED"});
  });
});

function jobInput() {
  return {
    request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
    request_fingerprint: `sha256:${"a".repeat(64)}`,
    card_id: "yard-evacuator",
    status: "queued" as const,
    provider: "fake" as const,
    model: "fake-card-art-v1",
    quality: "low" as const,
    size: "1024x1536" as const,
    prompt: "Original image only. No words or frame.",
    prompt_hash: `sha256:${"c".repeat(64)}`,
    brief,
  };
}

async function temporaryRoot(prefix: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

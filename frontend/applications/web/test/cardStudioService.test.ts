import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import type {CardStudioConfig} from "../server/utils/cardStudio/config";
import {
  cardsDigest,
  draftStateDigest,
  findRepositoryRoot,
  provenanceManifestSchema,
} from "../server/utils/cardStudio/content";
import {sniffImageMime} from "../server/utils/cardStudio/image";
import {FakeCardArtProvider} from "../server/utils/cardStudio/provider";
import {CardStudioService} from "../server/utils/cardStudio/service";
import type {CardArtProvider} from "../server/utils/cardStudio/types";

const roots: string[] = [];
const config: CardStudioConfig = {
  enabled: true,
  token: "studio-token-which-is-longer-than-32-bytes",
  provider: "fake",
  dataDir: ".card-studio",
  jobTimeoutMs: 120_000,
  maxImageBytes: 4_000_000,
  openai: {
    apiKey: "",
    model: "gpt-image-2",
  },
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map(
    (root) => rm(root, {recursive: true, force: true}),
  ));
});

it("accepts committed provenance produced by built-in ImageGen", async () => {
  const repositoryRoot = await findRepositoryRoot();
  const provenance = provenanceManifestSchema.parse(JSON.parse(
    await readFile(path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
      "provenance.json",
    ), "utf8"),
  ));

  expect(provenance.records).toContainEqual(expect.objectContaining({
    card_id: "yard-evacuator",
    provider: "openai",
    model: "codex-imagegen-built-in",
    quality: "unexposed",
  }));

  const mismatchedBuiltIn = structuredClone(provenance);
  mismatchedBuiltIn.records[0].quality = "low";
  expect(() => provenanceManifestSchema.parse(mismatchedBuiltIn)).toThrow(
    /unexposed quality is reserved/,
  );
});

describe("Card Studio fake-provider flow", () => {
  it("queues, polls, previews and approves idempotently into draft v2", async () => {
    const repositoryRoot = await testRepository();
    const sourcePath = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v1",
      "cards.json",
    );
    const sourceBefore = await readFile(sourcePath);
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const queued = await service.queueGeneration(generationRequest());
    expect(queued.created).toBe(true);
    expect(queued.job.status).toBe("queued");
    const queuedReplay = await service.queueGeneration(generationRequest());
    expect(queuedReplay).toMatchObject({
      created: false,
      job: {
        id: queued.job.id,
        status: "queued",
      },
    });

    const completed = await service.runJob(queued.job.id);
    expect(completed.status).toBe("succeeded");
    expect(completed.preview_url).toContain(queued.job.id);
    const candidate = await service.candidate(queued.job.id);
    expect(sniffImageMime(candidate)).toBe("image/webp");

    const approval = await service.approve(queued.job.id, {
      alt_text: "Геометрический дворовый эвакуатор в московском дворе",
    });
    expect(approval.idempotent).toBe(false);
    const replay = await service.approve(queued.job.id, {
      alt_text: "Геометрический дворовый эвакуатор в московском дворе",
    });
    expect(replay).toMatchObject({
      job_id: approval.job_id,
      content_digest: approval.content_digest,
      idempotent: true,
    });

    const v2Root = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
    );
    const pack = JSON.parse(
      await readFile(path.join(v2Root, "cards.json"), "utf8"),
    );
    const provenance = provenanceManifestSchema.parse(JSON.parse(
      await readFile(path.join(v2Root, "provenance.json"), "utf8"),
    ));
    const asset = await readFile(
      path.join(v2Root, "assets", "yard-evacuator.webp"),
    );
    expect(pack).toMatchObject({
      set_id: "moscow-core",
      version: 2,
      source: "original-moscow-core-visual-2026",
      content_digest: cardsDigest(pack.cards),
    });
    expect(pack.cards).toHaveLength(168);
    expect(pack.cards.find(
      (card: {id: string}) => card.id === "yard-evacuator",
    )).toMatchObject({
      image: "assets/yard-evacuator.webp",
      alt_text: "Геометрический дворовый эвакуатор в московском дворе",
    });
    expect(provenance).toMatchObject({
      status: "draft",
      content_digest: pack.content_digest,
      records: [{
        card_id: "yard-evacuator",
        output_sha256: approval.output_sha256,
      }],
    });
    expect(sniffImageMime(asset)).toBe("image/webp");
    expect(await readFile(sourcePath)).toEqual(sourceBefore);
    expect((await service.listCards()).cards.find(
      (card) => card.id === "yard-evacuator",
    )?.art_status).toBe("approved");
  });

  it("serializes concurrent approvals for different cards", async () => {
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const first = await service.queueGeneration(generationRequest());
    const second = await service.queueGeneration({
      ...generationRequest(),
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d3",
      card_id: "sleepy-turnstile",
      brief: {
        ...generationRequest().brief,
        subject: "Сонный турникет как городской страж",
        action: "Неохотно пропускает поток фантастических пассажиров",
      },
    });
    await Promise.all([
      service.runJob(first.job.id),
      service.runJob(second.job.id),
    ]);
    await Promise.all([
      service.approve(first.job.id, {
        alt_text: "Геометрический дворовый эвакуатор",
      }),
      service.approve(second.job.id, {
        alt_text: "Сонный турникет в фантастическом метро",
      }),
    ]);

    const v2Root = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
    );
    const pack = JSON.parse(
      await readFile(path.join(v2Root, "cards.json"), "utf8"),
    );
    const provenance = provenanceManifestSchema.parse(JSON.parse(
      await readFile(path.join(v2Root, "provenance.json"), "utf8"),
    ));
    expect(provenance.records.map((record) => record.card_id)).toEqual([
      "sleepy-turnstile",
      "yard-evacuator",
    ]);
    for (const cardID of ["sleepy-turnstile", "yard-evacuator"]) {
      expect(pack.cards.find(
        (card: {id: string}) => card.id === cardID,
      )?.image).toBe(`assets/${cardID}.webp`);
      await expect(access(
        path.join(v2Root, "assets", `${cardID}.webp`),
      )).resolves.toBeUndefined();
    }
  });

  it("claims a replayed queued job only once before calling the provider", async () => {
    const repositoryRoot = await testRepository();
    const delegate = new FakeCardArtProvider();
    let generationCalls = 0;
    const provider: CardArtProvider = {
      id: "fake",
      model: delegate.model,
      async generate(request) {
        generationCalls++;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return delegate.generate(request);
      },
    };
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
      provider,
    });
    const queued = await service.queueGeneration(generationRequest());

    await Promise.all([
      service.runJob(queued.job.id),
      service.runJob(queued.job.id),
    ]);

    expect(generationCalls).toBe(1);
    expect(await service.getJob(queued.job.id)).toMatchObject({
      status: "succeeded",
    });
  });

  it("rejects source bytes that do not match immutable v1 digest", async () => {
    const repositoryRoot = await testRepository();
    const sourcePath = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v1",
      "cards.json",
    );
    const source = JSON.parse(await readFile(sourcePath, "utf8"));
    source.cards[0].name = "Подменённая механика";
    await writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    await expect(service.listCards()).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects mechanics and asset drift in an existing draft", async () => {
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const queued = await service.queueGeneration(generationRequest());
    await service.runJob(queued.job.id);
    await service.approve(queued.job.id, {
      alt_text: "Первая одобренная иллюстрация",
    });
    const v2Root = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
    );
    const packPath = path.join(v2Root, "cards.json");
    const provenancePath = path.join(v2Root, "provenance.json");
    const pack = JSON.parse(await readFile(packPath, "utf8"));
    const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    pack.cards[0].monster.strength += 1;
    pack.content_digest = cardsDigest(pack.cards);
    provenance.content_digest = pack.content_digest;
    await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`);
    await writeFile(
      provenancePath,
      `${JSON.stringify(provenance, null, 2)}\n`,
    );
    await expect(service.listCards()).rejects.toMatchObject({
      code: "CONFLICT",
    });

    pack.cards[0].monster.strength -= 1;
    pack.content_digest = cardsDigest(pack.cards);
    provenance.content_digest = pack.content_digest;
    await writeFile(packPath, `${JSON.stringify(pack, null, 2)}\n`);
    await writeFile(
      provenancePath,
      `${JSON.stringify(provenance, null, 2)}\n`,
    );
    await writeFile(
      path.join(v2Root, "assets", "yard-evacuator.webp"),
      Buffer.from("not-a-webp", "utf8"),
    );
    await expect(service.listCards()).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects an incomplete existing draft instead of treating it as absent", async () => {
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const queued = await service.queueGeneration(generationRequest());
    await service.runJob(queued.job.id);
    await service.approve(queued.job.id, {
      alt_text: "Первая одобренная иллюстрация",
    });
    await rm(path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
      "provenance.json",
    ));

    await expect(service.listCards()).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("recovers a directory swap interrupted between renames", async () => {
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const queued = await service.queueGeneration(generationRequest());
    await service.runJob(queued.job.id);
    const approval = await service.approve(queued.job.id, {
      alt_text: "Первая одобренная иллюстрация",
    });
    const moscowRoot = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
    );
    const stageName = ".v2-stage-018f47a6-7884-7d15-a0cf-4ac22462f7e1";
    const backupName = ".v2-backup-018f47a6-7884-7d15-a0cf-4ac22462f7e1";
    const v2Root = path.join(moscowRoot, "v2");
    const stageRoot = path.join(moscowRoot, stageName);
    const backupRoot = path.join(moscowRoot, backupName);
    await cp(v2Root, stageRoot, {recursive: true});
    const stagedPack = JSON.parse(
      await readFile(path.join(stageRoot, "cards.json"), "utf8"),
    );
    const stagedProvenance = provenanceManifestSchema.parse(JSON.parse(
      await readFile(path.join(stageRoot, "provenance.json"), "utf8"),
    ));
    await rename(v2Root, backupRoot);
    await writeFile(
      path.join(moscowRoot, ".v2-transaction.json"),
      `${JSON.stringify({
        schema_version: 1,
        stage_name: stageName,
        backup_name: backupName,
        expected_state_digest: draftStateDigest(
          stagedPack,
          stagedProvenance,
        ),
      }, null, 2)}\n`,
    );
    const legacyLockDirectory = path.join(
      repositoryRoot,
      ".card-studio",
      "locks",
    );
    await mkdir(legacyLockDirectory, {recursive: true});
    await writeFile(
      path.join(legacyLockDirectory, "approve-moscow-v2.lock"),
      `${JSON.stringify({
        schema_version: 1,
        pid: process.pid,
        process_started_at_ms: 1,
        owner_id: "018f47a6-7884-7d15-a0cf-4ac22462f7e2",
        created_at: "2026-01-01T00:00:00.000Z",
      })}\n`,
    );

    await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const recovered = JSON.parse(
      await readFile(path.join(v2Root, "cards.json"), "utf8"),
    );
    expect(recovered.content_digest).toBe(approval.content_digest);
    await expect(access(stageRoot)).rejects.toMatchObject({code: "ENOENT"});
    await expect(access(backupRoot)).rejects.toMatchObject({code: "ENOENT"});
    await expect(access(
      path.join(moscowRoot, ".v2-transaction.json"),
    )).rejects.toMatchObject({code: "ENOENT"});
  });

  it("commits regenerated draft asset when card metadata digest is unchanged", async () => {
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const first = await service.queueGeneration(generationRequest());
    await service.runJob(first.job.id);
    const firstApproval = await service.approve(first.job.id, {
      alt_text: "Стабильное описание иллюстрации",
    });
    const assetPath = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
      "assets",
      "yard-evacuator.webp",
    );
    const firstAsset = await readFile(assetPath);

    const second = await service.queueGeneration({
      ...generationRequest(),
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d5",
      brief: {
        ...generationRequest().brief,
        action: "Другое самостоятельное действие для нового изображения",
      },
    });
    const completed = await service.runJob(second.job.id);
    expect(completed.output_sha256).not.toBe(firstApproval.output_sha256);
    const secondCandidate = await service.candidate(second.job.id);
    const secondApproval = await service.approve(second.job.id, {
      alt_text: "Стабильное описание иллюстрации",
    });
    expect(secondApproval).toMatchObject({
      content_digest: firstApproval.content_digest,
      output_sha256: completed.output_sha256,
      idempotent: false,
    });
    expect(await readFile(assetPath)).toEqual(secondCandidate);
    expect(await readFile(assetPath)).not.toEqual(firstAsset);
    const provenance = provenanceManifestSchema.parse(JSON.parse(
      await readFile(path.join(
        repositoryRoot,
        "content",
        "sets",
        "moscow",
        "v2",
        "provenance.json",
      ), "utf8"),
    ));
    expect(provenance.records[0]?.output_sha256)
      .toBe(secondApproval.output_sha256);
  });

  it("does not overwrite a published v2 identity with another digest", async () => {
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
    });
    const first = await service.queueGeneration(generationRequest());
    await service.runJob(first.job.id);
    await service.approve(first.job.id, {
      alt_text: "Первая одобренная иллюстрация",
    });

    const provenancePath = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
      "provenance.json",
    );
    const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    provenance.status = "published";
    await writeFile(
      provenancePath,
      `${JSON.stringify(provenance, null, 2)}\n`,
    );
    const assetPath = path.join(
      repositoryRoot,
      "content",
      "sets",
      "moscow",
      "v2",
      "assets",
      "yard-evacuator.webp",
    );
    const publishedAsset = await readFile(assetPath);
    const publishedProvenance = await readFile(provenancePath);

    const second = await service.queueGeneration({
      ...generationRequest(),
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d4",
      brief: {
        ...generationRequest().brief,
        action: "Другое самостоятельное действие",
      },
    });
    await service.runJob(second.job.id);
    await expect(service.approve(second.job.id, {
      alt_text: "Первая одобренная иллюстрация",
    })).rejects.toMatchObject({code: "CONFLICT"});
    expect(await readFile(assetPath)).toEqual(publishedAsset);
    expect(await readFile(provenancePath)).toEqual(publishedProvenance);
  });
});

function generationRequest() {
  return {
    request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
    card_id: "yard-evacuator",
    brief: {
      subject: "Дворовый эвакуатор как городской зверь",
      setting: "Самостоятельная московская fantasy-сцена",
      action: "Поднимает пустое парковочное место как трофей",
      composition: "Крупный силуэт и crop-safe края",
      palette: "Графит, бумажный, лайм и кирпичный",
      mood: "Доброжелательный городской абсурд",
      exclusions: "Без текста, логотипов, рамки и водяных знаков",
    },
    settings: {
      quality: "low" as const,
      size: "1024x1536" as const,
    },
  };
}

async function testRepository() {
  const root = await mkdtemp(path.join(os.tmpdir(), "munchkin-studio-repo-"));
  roots.push(root);
  const sourceDirectory = path.join(
    root,
    "content",
    "sets",
    "moscow",
    "v1",
  );
  await mkdir(sourceDirectory, {recursive: true});
  await copyFile(
    path.resolve(
      process.cwd(),
      "../../../content/sets/moscow/v1/cards.json",
    ),
    path.join(sourceDirectory, "cards.json"),
  );
  return root;
}

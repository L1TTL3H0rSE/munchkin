import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";
import {
  studioArtBriefSchema,
  studioCompileResultSchema,
  type StudioArtBrief,
} from "@munchkin/contracts";
import {authorizeCardStudio} from "../server/utils/cardStudio/auth";
import {
  normalizeCardStudioConfig,
  providerInfo,
  requireCardStudioEnabled,
  type CardStudioConfig,
} from "../server/utils/cardStudio/config";
import {StudioError} from "../server/utils/cardStudio/errors";
import {
  compileCardArtPrompt,
} from "../server/utils/cardStudio/prompt";
import {CardStudioService} from "../server/utils/cardStudio/service";
import type {CardArtProvider} from "../server/utils/cardStudio/types";

const token = "studio-token-which-is-longer-than-32-bytes";
const temporaryRoots: string[] = [];
const config: CardStudioConfig = {
  enabled: true,
  token,
  provider: "fake",
  dataDir: ".card-studio",
  jobTimeoutMs: 120_000,
  maxImageBytes: 25_165_824,
  openai: {
    apiKey: "",
    model: "gpt-image-2",
  },
};

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(
    (root) => rm(root, {recursive: true, force: true}),
  ));
});

const brief: StudioArtBrief = {
  subject: "Дворовый эвакуатор как упрямый городской зверь",
  setting: "Тесный двор после тёплого дождя",
  action: "Поднимает пустое парковочное место как трофей",
  composition: "Один крупный силуэт, низкая точка, свободные края",
  palette: "Графит, бумажный кремовый, лайм и кирпичный",
  mood: "Доброжелательный городской абсурд",
  exclusions: "Без текста, букв, логотипов, рамки и водяных знаков",
};

describe("Card Studio auth and config", () => {
  it("fails closed when disabled or the configured token is unsafe", () => {
    expectStudioCode(
      () => requireCardStudioEnabled(undefined),
      "STUDIO_DISABLED",
    );
    expectStudioCode(
      () => requireCardStudioEnabled({enabled: false, provider: "broken"}),
      "STUDIO_DISABLED",
    );
    expectStudioCode(
      () => authorizeCardStudio({...config, enabled: false}, `Bearer ${token}`),
      "STUDIO_DISABLED",
    );
    expectStudioCode(
      () => authorizeCardStudio({...config, token: "short"}, "Bearer short"),
      "STUDIO_DISABLED",
    );
  });

  it("requires an exact separate bearer token", () => {
    for (const header of [
      undefined,
      token,
      `Basic ${token}`,
      "Bearer game-guest-credential-which-is-not-authoring",
      `Bearer ${token} extra`,
    ]) {
      expectStudioCode(
        () => authorizeCardStudio(config, header),
        "UNAUTHORIZED",
      );
    }
    expect(() => authorizeCardStudio(config, `Bearer ${token}`)).not.toThrow();
  });

  it("keeps provider selection closed and server-only", () => {
    expect(normalizeCardStudioConfig({provider: ""}).provider).toBe("fake");
    expect(() => normalizeCardStudioConfig({
      provider: "arbitrary",
    })).toThrowError(StudioError);
    expect(() => normalizeCardStudioConfig({
      provider: false,
    })).toThrowError(StudioError);
    expect(() => normalizeCardStudioConfig({
      provider: "openai",
      openai: {model: "arbitrary-model"},
    })).toThrowError(StudioError);

    const normalized = normalizeCardStudioConfig({
      enabled: true,
      token,
      provider: "openai",
      dataDir: ".card-studio",
      jobTimeoutMs: 120_000,
      maxImageBytes: 25_165_824,
      openai: {
        apiKey: "never-return-this-key",
        model: "gpt-image-2",
      },
    });
    const info = providerInfo(normalized);
    expect(info).toMatchObject({
      provider: "openai",
      model: "gpt-image-2",
      real_generation: true,
      size: "1024x1536",
    });
    expect(JSON.stringify(info)).not.toContain("never-return-this-key");
  });
});

describe("Card Studio prompt policy", () => {
  it("automatically adds the provider-neutral humorous cartoon master", () => {
    const {prompt} = compileCardArtPrompt("Дворовый эвакуатор", brief);

    for (const required of [
      "hand-inked humorous fantasy cartoon",
      "expressive pose and facial expression",
      "one clear readable visual joke",
      "flat limited colors",
      "simple and uncluttered",
    ]) {
      expect(prompt).toContain(required);
    }

    const normalizedPrompt = prompt.toLowerCase();
    for (const forbidden of [
      "john kovalic",
      "munchkin",
      "openai",
      "imagegen",
      "gpt-image",
      "in the style of",
    ]) {
      expect(normalizedPrompt).not.toContain(forbidden);
    }
  });

  it("compiles only the original name and short art brief", () => {
    const result = compileCardArtPrompt("Дворовый эвакуатор", brief);
    expect(result.prompt).toContain("Дворовый эвакуатор");
    expect(result.prompt).toContain(brief.subject);
    expect(result.prompt).toContain("opaque 1024x1536 portrait");
    expect(result.prompt).toContain("crop-safe margins");
    expect(result.prompt).toContain("no text");
    expect(result.prompt).toContain("no words");
    expect(result.prompt).toContain("no logos");
    expect(result.prompt).toContain("watermarks");
    expect(result.prompt).toContain("no card border");
    expect(result.prompt).toContain("stat boxes");
    expect(result.prompt).toContain("UI");
    expect(result.prompt).toContain("finished-card layout");
    expect(result.prompt).not.toContain(
      "Если не сбежишь, потеряй 1 уровень.",
    );
    expect(result.prompt_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("fits a maximum valid brief into the compile result limit", () => {
    const maximumBrief = studioArtBriefSchema.parse({
      subject: "s".repeat(240),
      setting: "e".repeat(240),
      action: "a".repeat(240),
      composition: "c".repeat(240),
      palette: "p".repeat(240),
      mood: "m".repeat(240),
      exclusions: "x".repeat(400),
    });
    const result = compileCardArtPrompt("n".repeat(120), maximumBrief);

    expect(result.prompt.length).toBeLessThanOrEqual(4000);
    expect(() => studioCompileResultSchema.parse(result)).not.toThrow();
  });

  it("keeps the hash deterministic and varies it with the brief", () => {
    const first = compileCardArtPrompt("Дворовый эвакуатор", brief);
    const repeated = compileCardArtPrompt("Дворовый эвакуатор", brief);
    const varied = compileCardArtPrompt("Дворовый эвакуатор", {
      ...brief,
      action: "Разворачивает пустое парковочное место как ковёр",
    });

    expect(repeated).toEqual(first);
    expect(varied.prompt).not.toBe(first.prompt);
    expect(varied.prompt_hash).not.toBe(first.prompt_hash);
  });

  it("rejects artist/product mimicry in compiler policy", () => {
    for (const unsafe of [
      "in the style of a famous living artist",
      "в стиле известного художника",
      "скопировать чужую карточную рамку",
      "Munchkin trade dress",
      "как у художника из коммерческой игры",
    ]) {
      expectStudioCode(
        () => compileCardArtPrompt("Оригинальная карта", {
          ...brief,
          exclusions: unsafe,
        }),
        "INVALID_REQUEST",
      );
    }
  });

  it("rejects mimicry before a job or provider invocation", async () => {
    let providerInvocations = 0;
    const provider: CardArtProvider = {
      id: "fake",
      model: "fake-card-art-v1",
      async generate() {
        providerInvocations++;
        throw new Error("provider must not be invoked");
      },
    };
    const repositoryRoot = await testRepository();
    const service = await CardStudioService.create(config, {
      repositoryRoot,
      dataRoot: path.join(repositoryRoot, ".card-studio"),
      provider,
    });

    await expect(service.queueGeneration({
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
      card_id: "yard-evacuator",
      brief: {
        ...brief,
        exclusions: "in the style of a commercial tabletop product",
      },
      settings: {
        quality: "low",
        size: "1024x1536",
      },
    })).rejects.toMatchObject({code: "INVALID_REQUEST"});

    expect(providerInvocations).toBe(0);
    expect((await service.listJobs()).jobs).toEqual([]);
  });
});

function expectStudioCode(callback: () => unknown, code: string) {
  try {
    callback();
    throw new Error("expected StudioError");
  } catch (error) {
    expect(error).toBeInstanceOf(StudioError);
    expect((error as StudioError).code).toBe(code);
  }
}

async function testRepository() {
  const root = await mkdtemp(path.join(
    os.tmpdir(),
    "munchkin-prompt-policy-",
  ));
  temporaryRoots.push(root);
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

import {describe, expect, it} from "vitest";
import {
  studioAPIErrorSchema,
  studioApproveRequestSchema,
  studioCompileRequestSchema,
  studioGenerateRequestSchema,
  studioJobSchema,
} from "../src/index";

describe("Card Studio wire contracts", () => {
  it("keeps generation requests closed and path-free", () => {
    const request = {
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
      card_id: "yard-evacuator",
      brief: {
        subject: "Старый эвакуатор с характером дворового дракона",
        setting: "Тесный московский двор после дождя",
        action: "Поднимает пустое парковочное место как трофей",
        composition: "Низкая точка, один крупный силуэт, чистый верхний край",
        palette: "Графит, бумажный кремовый, сигнальный лайм",
        mood: "Городской абсурд и энергичное движение",
        exclusions: "Без текста, логотипов, водяных знаков и карточной рамки",
      },
      settings: {
        quality: "low",
        size: "1024x1536",
      },
    };
    expect(studioGenerateRequestSchema.parse(request).card_id)
      .toBe("yard-evacuator");
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      provider: "openai",
    })).toThrow();
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      model: "arbitrary-model",
    })).toThrow();
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      output_path: "../../outside.webp",
    })).toThrow();
    expect(() => studioGenerateRequestSchema.parse({
      ...request,
      api_key: "secret",
    })).toThrow();
    expect(() => studioCompileRequestSchema.parse({
      ...request,
      request_id: undefined,
      brief: {...request.brief, rules_text: "full hidden rules"},
    })).toThrow();
  });

  it("accepts only safe job and approval wire shapes", () => {
    const job = {
      id: "018f47a6-7884-7d15-a0cf-4ac22462f7d3",
      request_id: "018f47a6-7884-7d15-a0cf-4ac22462f7d2",
      card_id: "yard-evacuator",
      status: "succeeded",
      provider: "fake",
      model: "fake-card-art-v1",
      quality: "low",
      size: "1024x1536",
      prompt_hash: `sha256:${"a".repeat(64)}`,
      output_sha256: `sha256:${"b".repeat(64)}`,
      preview_url:
        "/api/studio/jobs/018f47a6-7884-7d15-a0cf-4ac22462f7d3/image",
      created_at: "2026-07-29T18:00:00.000Z",
      updated_at: "2026-07-29T18:00:01.000Z",
    };
    expect(studioJobSchema.parse(job).status).toBe("succeeded");
    expect(() => studioJobSchema.parse({...job, staging_path: "C:\\secret"}))
      .toThrow();
    expect(() => studioApproveRequestSchema.parse({
      alt_text: "Дворовый эвакуатор",
      asset_path: "../../outside.webp",
    })).toThrow();
  });

  it("does not permit secrets or provider payloads in errors", () => {
    const error = {
      error: true,
      code: "GENERATION_FAILED",
      message: "Генерация не завершена. Повторите явным действием.",
    };
    expect(studioAPIErrorSchema.parse(error).code)
      .toBe("GENERATION_FAILED");
    expect(() => studioAPIErrorSchema.parse({
      ...error,
      api_key: "secret",
    })).toThrow();
    expect(() => studioAPIErrorSchema.parse({
      ...error,
      provider_response: {body: "raw"},
    })).toThrow();
  });
});

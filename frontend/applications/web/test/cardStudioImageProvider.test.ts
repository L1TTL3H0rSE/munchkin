import {describe, expect, it, vi} from "vitest";
import sharp from "sharp";
import type {CardStudioConfig} from "../server/utils/cardStudio/config";
import {StudioError} from "../server/utils/cardStudio/errors";
import {
  decodeBase64Image,
  normalizeCandidateImage,
  sniffImageMime,
} from "../server/utils/cardStudio/image";
import {
  FakeCardArtProvider,
  OpenAICardArtProvider,
} from "../server/utils/cardStudio/provider";

const config: CardStudioConfig = {
  enabled: true,
  token: "studio-token-which-is-longer-than-32-bytes",
  provider: "openai",
  dataDir: ".card-studio",
  jobTimeoutMs: 120_000,
  maxImageBytes: 2_000_000,
  openai: {
    apiKey: "",
    model: "gpt-image-2",
  },
};

const request = {
  prompt: "Original geometric city fantasy illustration; no text.",
  quality: "low" as const,
  size: "1024x1536" as const,
};

describe("Card Studio image boundary", () => {
  it("normalizes a decoded image to bounded portrait WebP", async () => {
    const input = await sharp({
      create: {
        width: 320,
        height: 480,
        channels: 3,
        background: "#c8ef36",
      },
    }).png().toBuffer();
    const normalized = await normalizeCandidateImage({
      bytes: input,
      declaredMime: "image/png",
      providerRequestID: "req_fixture",
      model: "fixture",
    }, 2_000_000);
    expect(sniffImageMime(normalized.bytes)).toBe("image/webp");
    const metadata = await sharp(normalized.bytes).metadata();
    expect([metadata.width, metadata.height]).toEqual([1024, 1536]);
    expect(normalized.output_sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects MIME mismatch, invalid bytes and size overflow", async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 48,
        channels: 3,
        background: "#111111",
      },
    }).png().toBuffer();
    await expect(normalizeCandidateImage({
      bytes: png,
      declaredMime: "image/jpeg",
      providerRequestID: "req_fixture",
      model: "fixture",
    }, 2_000_000)).rejects.toMatchObject({code: "INVALID_IMAGE"});
    await expect(normalizeCandidateImage({
      bytes: Buffer.from("not-an-image"),
      declaredMime: "image/png",
      providerRequestID: "req_fixture",
      model: "fixture",
    }, 2_000_000)).rejects.toMatchObject({code: "INVALID_IMAGE"});
    await expect(normalizeCandidateImage({
      bytes: png,
      declaredMime: "image/png",
      providerRequestID: "req_fixture",
      model: "fixture",
    }, 4)).rejects.toMatchObject({code: "INVALID_IMAGE"});
  });

  it("rejects unsafe dimensions and malformed base64", async () => {
    const tooWide = await sharp({
      create: {
        width: 3904,
        height: 32,
        channels: 3,
        background: "#111111",
      },
    }).png().toBuffer();
    await expect(normalizeCandidateImage({
      bytes: tooWide,
      declaredMime: "image/png",
      providerRequestID: "req_fixture",
      model: "fixture",
    }, 2_000_000)).rejects.toMatchObject({code: "INVALID_IMAGE"});
    for (const value of ["", "****", "YWJjZA=", "A".repeat(500)]) {
      expect(() => decodeBase64Image(value, 64)).toThrowError(StudioError);
    }
  });
});

describe("Card Studio providers", () => {
  it("keeps fake output deterministic and fully offline", async () => {
    const provider = new FakeCardArtProvider();
    const first = await provider.generate(request);
    const second = await provider.generate(request);
    expect(first.providerRequestID).toBe(second.providerRequestID);
    expect(first.bytes.equals(second.bytes)).toBe(true);
    expect(sniffImageMime(first.bytes)).toBe("image/png");
  });

  it("maps only allowlisted fields into the OpenAI Image request", async () => {
    const png = await sharp({
      create: {
        width: 32,
        height: 48,
        channels: 3,
        background: "#f07136",
      },
    }).png().toBuffer();
    const generate = vi.fn(async () => ({
      data: [{b64_json: png.toString("base64")}],
      _request_id: "req_openai_fixture",
    }));
    const provider = new OpenAICardArtProvider(config, generate);
    const result = await provider.generate(request);
    expect(generate).toHaveBeenCalledWith({
      model: "gpt-image-2",
      prompt: request.prompt,
      n: 1,
      size: "1024x1536",
      quality: "low",
      background: "opaque",
      output_format: "png",
    });
    expect(result.providerRequestID).toBe("req_openai_fixture");
    expect(result.bytes.equals(png)).toBe(true);
    expect(JSON.stringify(generate.mock.calls)).not.toContain("apiKey");
  });

  it("redacts provider failures and requires a provider request ID", async () => {
    const rejects = new OpenAICardArtProvider(config, async () => {
      throw new Error("secret provider body and key");
    });
    await expect(rejects.generate(request)).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      message: expect.not.stringContaining("secret"),
    });

    const missingID = new OpenAICardArtProvider(config, async () => ({
      data: [{b64_json: Buffer.from("bytes").toString("base64")}],
    }));
    await expect(missingID.generate(request)).rejects.toMatchObject({
      code: "GENERATION_FAILED",
    });
  });
});

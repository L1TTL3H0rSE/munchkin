import {createHash} from "node:crypto";
import OpenAI from "openai";
import sharp from "sharp";
import type {CardStudioConfig} from "./config";
import {StudioError} from "./errors";
import {decodeBase64Image} from "./image";
import type {
  CardArtProvider,
  ProviderGenerationRequest,
} from "./types";

interface OpenAIImageResponse {
  data?: Array<{
    b64_json?: string | null;
  }>;
  _request_id?: string | null;
}

export type OpenAIImageGenerate = (
  request: {
    model: string;
    prompt: string;
    n: 1;
    size: "1024x1536";
    quality: "low" | "medium" | "high";
    background: "opaque";
    output_format: "png";
  },
) => Promise<OpenAIImageResponse>;

export class FakeCardArtProvider implements CardArtProvider {
  readonly id = "fake" as const;
  readonly model = "fake-card-art-v1";

  async generate(request: ProviderGenerationRequest) {
    const digest = createHash("sha256")
      .update(`${request.prompt}\n${request.quality}\n${request.size}`)
      .digest();
    const colors = [
      hex(digest.subarray(0, 3)),
      hex(digest.subarray(3, 6)),
      hex(digest.subarray(6, 9)),
    ];
    const svg = Buffer.from([
      "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"512\" height=\"768\" viewBox=\"0 0 512 768\">",
      `<rect width="512" height="768" fill="${colors[0]}"/>`,
      `<path d="M-80 610 180 90l158 172 254-94v600H-80Z" fill="${colors[1]}"/>`,
      `<path d="m-30 180 198 126 132-92 242 174" fill="none" stroke="${colors[2]}" stroke-width="22"/>`,
      `<circle cx="${96 + (digest.at(9) ?? 0)}" cy="${160 + (digest.at(10) ?? 0)}" r="74" fill="${colors[2]}"/>`,
      `<path d="M80 690 410 450M54 535l390 102" stroke="${colors[0]}" stroke-width="12"/>`,
      "</svg>",
    ].join(""), "utf8");
    const bytes = await sharp(svg).png().toBuffer();
    return {
      bytes,
      declaredMime: "image/png" as const,
      providerRequestID: `fake-${createHash("sha256")
        .update(bytes)
        .digest("hex")
        .slice(0, 24)}`,
      model: this.model,
    };
  }
}

export class OpenAICardArtProvider implements CardArtProvider {
  readonly id = "openai" as const;
  readonly model: string;
  private readonly generateImage: OpenAIImageGenerate;
  private readonly maximumBytes: number;

  constructor(
    config: CardStudioConfig,
    generateImage?: OpenAIImageGenerate,
  ) {
    if (!config.openai.apiKey && !generateImage) {
      throw new StudioError(
        "PROVIDER_UNAVAILABLE",
        "OpenAI Image provider не настроен.",
        503,
      );
    }
    this.model = config.openai.model;
    this.maximumBytes = config.maxImageBytes;
    if (generateImage) {
      this.generateImage = generateImage;
      return;
    }
    const client = new OpenAI({
      apiKey: config.openai.apiKey,
      maxRetries: 0,
      timeout: config.jobTimeoutMs,
    });
    this.generateImage = (request) => client.images.generate(request);
  }

  async generate(request: ProviderGenerationRequest) {
    let response: OpenAIImageResponse;
    try {
      response = await this.generateImage({
        model: this.model,
        prompt: request.prompt,
        n: 1,
        size: request.size,
        quality: request.quality,
        background: "opaque",
        output_format: "png",
      });
    } catch {
      throw generationFailed();
    }
    const encoded = response.data?.[0]?.b64_json;
    const providerRequestID = response._request_id?.trim();
    if (!encoded || !providerRequestID) {
      throw generationFailed();
    }
    return {
      bytes: decodeBase64Image(encoded, this.maximumBytes),
      declaredMime: "image/png" as const,
      providerRequestID,
      model: this.model,
    };
  }
}

export function createCardArtProvider(config: CardStudioConfig) {
  return config.provider === "fake"
    ? new FakeCardArtProvider()
    : new OpenAICardArtProvider(config);
}

function hex(bytes: Buffer) {
  return `#${bytes.toString("hex")}`;
}

function generationFailed() {
  return new StudioError(
    "GENERATION_FAILED",
    "Image provider не завершил генерацию. Повторите явным действием.",
    502,
  );
}

import sharp from "sharp";
import {StudioError} from "./errors";
import {sha256} from "./prompt";
import type {ProviderGenerationResult} from "./types";

const MAX_PIXELS = 8_294_400;
const NORMALIZED_WIDTH = 1024;
const NORMALIZED_HEIGHT = 1536;

export async function normalizeCandidateImage(
  candidate: ProviderGenerationResult,
  maximumBytes: number,
) {
  if (candidate.bytes.length === 0 || candidate.bytes.length > maximumBytes) {
    throw invalidImage();
  }
  const sniffedMime = sniffImageMime(candidate.bytes);
  if (sniffedMime !== candidate.declaredMime) {
    throw invalidImage();
  }
  try {
    const source = sharp(candidate.bytes, {
      failOn: "error",
      limitInputPixels: MAX_PIXELS,
    });
    const metadata = await source.metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      metadata.width > 3840 ||
      metadata.height > 3840 ||
      metadata.width * metadata.height > MAX_PIXELS ||
      (metadata.pages ?? 1) !== 1 ||
      formatMime(metadata.format) !== sniffedMime
    ) {
      throw invalidImage();
    }
    const normalized = await source
      .rotate()
      .resize(NORMALIZED_WIDTH, NORMALIZED_HEIGHT, {
        fit: "cover",
        position: "attention",
      })
      .webp({
        quality: 88,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();
    if (
      normalized.length === 0 ||
      normalized.length > maximumBytes ||
      sniffImageMime(normalized) !== "image/webp"
    ) {
      throw invalidImage();
    }
    return {
      bytes: normalized,
      output_sha256: sha256(normalized),
      width: NORMALIZED_WIDTH,
      height: NORMALIZED_HEIGHT,
    };
  } catch (error) {
    if (error instanceof StudioError) {
      throw error;
    }
    throw invalidImage();
  }
}

export function decodeBase64Image(encoded: string, maximumBytes: number) {
  const maximumEncodedLength = Math.ceil(maximumBytes / 3) * 4 + 4;
  if (
    encoded.length === 0 ||
    encoded.length > maximumEncodedLength ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    throw invalidImage();
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maximumBytes) {
    throw invalidImage();
  }
  return bytes;
}

export function sniffImageMime(
  bytes: Buffer,
): "image/png" | "image/jpeg" | "image/webp" | undefined {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function formatMime(format: string | undefined) {
  if (format === "png") {
    return "image/png";
  }
  if (format === "jpeg") {
    return "image/jpeg";
  }
  if (format === "webp") {
    return "image/webp";
  }
  return undefined;
}

function invalidImage() {
  return new StudioError(
    "INVALID_IMAGE",
    "Provider вернул неподдерживаемое или небезопасное изображение.",
    422,
  );
}

import type {
  StudioApproval,
  StudioArtBrief,
  StudioGenerateRequest,
  StudioJob,
  StudioProviderInfo as WireStudioProviderInfo,
} from "@munchkin/contracts";

export type StudioQuality = StudioGenerateRequest["settings"]["quality"];
export type StudioProviderInfo = WireStudioProviderInfo;

export interface ProviderGenerationRequest {
  prompt: string;
  quality: StudioQuality;
  size: "1024x1536";
}

export interface ProviderGenerationResult {
  bytes: Buffer;
  declaredMime: "image/png" | "image/jpeg" | "image/webp";
  providerRequestID: string;
  model: string;
}

export interface CardArtProvider {
  readonly id: "fake" | "openai";
  readonly model: string;
  generate(
    request: ProviderGenerationRequest,
  ): Promise<ProviderGenerationResult>;
}

export interface InternalStudioJob {
  id: string;
  request_id: string;
  request_fingerprint: string;
  card_id: string;
  status: StudioJob["status"];
  provider: StudioJob["provider"];
  model: string;
  quality: StudioQuality;
  size: "1024x1536";
  prompt: string;
  prompt_hash: string;
  brief: StudioArtBrief;
  created_at: string;
  updated_at: string;
  provider_request_id?: string;
  output_sha256?: string;
  error?: {
    code: string;
    message: string;
  };
  approval?: StudioApproval;
}

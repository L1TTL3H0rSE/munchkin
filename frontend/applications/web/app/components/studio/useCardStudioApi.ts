import {
  studioAPIErrorSchema,
  studioApprovalSchema,
  studioCardsResultSchema,
  studioCompileRequestSchema,
  studioCompileResultSchema,
  studioGenerateRequestSchema,
  studioJobSchema,
  studioJobsResultSchema,
  type StudioApproveRequest,
  type StudioCompileRequest,
  type StudioGenerateRequest,
} from "@munchkin/contracts";

export function createCardStudioAPI(getToken: () => string) {
  async function cards() {
    return request("/api/studio/cards", studioCardsResultSchema);
  }

  async function compile(input: StudioCompileRequest) {
    const body = studioCompileRequestSchema.parse(input);
    return request("/api/studio/compile", studioCompileResultSchema, {
      method: "POST",
      body,
    });
  }

  async function generate(input: StudioGenerateRequest) {
    const body = studioGenerateRequestSchema.parse(input);
    return request("/api/studio/jobs", studioJobSchema, {
      method: "POST",
      body,
    });
  }

  async function job(jobID: string) {
    return request(
      `/api/studio/jobs/${encodeURIComponent(jobID)}`,
      studioJobSchema,
    );
  }

  async function jobs(cardID?: string) {
    const query = cardID
      ? `?card_id=${encodeURIComponent(cardID)}`
      : "";
    return request(`/api/studio/jobs${query}`, studioJobsResultSchema);
  }

  async function approve(jobID: string, input: StudioApproveRequest) {
    return request(
      `/api/studio/jobs/${encodeURIComponent(jobID)}/approve`,
      studioApprovalSchema,
      {
        method: "POST",
        body: input,
      },
    );
  }

  async function candidateURL(jobID: string) {
    const response = await fetch(
      `/api/studio/jobs/${encodeURIComponent(jobID)}/image`,
      {
        headers: authorization(),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = undefined;
      }
      throw studioClientError(body);
    }
    const blob = await response.blob();
    if (blob.type !== "image/webp") {
      throw new Error("Studio preview имеет неожиданный media type.");
    }
    return URL.createObjectURL(blob);
  }

  return {cards, compile, generate, job, jobs, approve, candidateURL};

  async function request<T>(
    url: string,
    schema: {parse(value: unknown): T},
    options: {
      method?: "POST";
      body?: Record<string, unknown>;
    } = {},
  ) {
    try {
      const response = await $fetch(url, {
        ...options,
        headers: authorization(),
      });
      return schema.parse(response);
    } catch (error) {
      throw studioClientError(error);
    }
  }

  function authorization() {
    return {Authorization: `Bearer ${getToken().trim()}`};
  }
}

function studioClientError(error: unknown) {
  const candidates = [
    error,
    (error as {data?: unknown} | undefined)?.data,
    (error as {data?: {data?: unknown}} | undefined)?.data?.data,
  ];
  for (const candidate of candidates) {
    const parsed = studioAPIErrorSchema.safeParse(candidate);
    if (parsed.success) {
      return new Error(parsed.data.message);
    }
  }
  return error instanceof Error
    ? new Error("Card Studio request не завершён.")
    : new Error("Card Studio request не завершён.");
}

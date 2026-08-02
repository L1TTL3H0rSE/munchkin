const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "";

export default defineNuxtConfig({
  compatibilityDate: "2026-07-29",
  devtools: {enabled: true},
  modules: ["@pinia/nuxt", "@nuxt/eslint"],
  css: ["~/assets/scss/main.scss"],
  runtimeConfig: {
    cardStudio: {
      enabled: process.env.CARD_STUDIO_ENABLED === "true",
      token: process.env.CARD_STUDIO_TOKEN ?? "",
      provider: process.env.CARD_STUDIO_PROVIDER || "fake",
      dataDir: process.env.CARD_STUDIO_DATA_DIR || ".card-studio",
      jobTimeoutMs: Number(process.env.CARD_STUDIO_JOB_TIMEOUT_MS ?? 120_000),
      maxImageBytes: Number(
        process.env.CARD_STUDIO_MAX_IMAGE_BYTES ?? 25_165_824,
      ),
      openai: {
        apiKey: process.env.OPENAI_API_KEY ?? "",
        model: process.env.CARD_STUDIO_OPENAI_MODEL || "gpt-image-2",
      },
    },
    telemetry: {
      enabled: process.env.NUXT_OTEL_ENABLED !== "false" && otelEndpoint !== "",
      endpoint: otelEndpoint,
      serviceName: process.env.OTEL_SERVICE_NAME || "munchkin-web",
      version: process.env.SERVICE_VERSION || "unknown",
      revision: process.env.SERVICE_REVISION || "unknown",
      environment: process.env.DEPLOYMENT_ENVIRONMENT || "development",
    },
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "http://localhost:8080",
    },
  },
  app: {
    head: {
      title: "Munchkin-like online game",
      meta: [
        {
          name: "description",
          content: "Authoritative online card-game engine with original demo content.",
        },
      ],
    },
  },
  typescript: {
    strict: true,
  },
});

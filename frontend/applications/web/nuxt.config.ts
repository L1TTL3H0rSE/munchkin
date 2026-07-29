export default defineNuxtConfig({
  compatibilityDate: "2026-07-29",
  devtools: {enabled: true},
  modules: ["@pinia/nuxt", "@nuxt/eslint"],
  css: ["~/assets/main.css"],
  runtimeConfig: {
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

import {fileURLToPath} from "node:url";

import {defineConfig, devices} from "@playwright/test";

const webRoot = fileURLToPath(new URL("./applications/web/", import.meta.url));
const backendGameRoot = fileURLToPath(new URL("../backend/game/", import.meta.url));

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 18080);
const isRealE2E = process.env.MUNCHKIN_REAL_E2E === "1";
const baseURL = process.env.WEB_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./test/browser",
  outputDir: "./test/browser/artifacts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["dot"], ["html", {outputFolder: "test/browser/report", open: "never"}]]
    : "list",
  snapshotPathTemplate: "{testDir}/visual-baselines/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    baseURL,
    locale: "ru-RU",
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: {width: 1280, height: 720},
      },
    },
    {
      name: "chromium-tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: {width: 599, height: 720},
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: {width: 320, height: 720},
      },
    },
  ],
  webServer: isRealE2E
    ? [
      {
        command: "go run ./cmd/server",
        cwd: backendGameRoot,
        url: `http://127.0.0.1:${apiPort}/healthz`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          SERVER_ADDR: `127.0.0.1:${apiPort}`,
          GAME_CONTENT_PATH: "../../content/sets/demo/cards.json",
          AUTO_MIGRATE: "false",
          CORS_ALLOWED_ORIGINS: baseURL,
        },
      },
      {
        command: `node node_modules/nuxt/bin/nuxt.mjs dev --host 127.0.0.1 --port ${port}`,
        cwd: webRoot,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          NUXT_PUBLIC_API_BASE: `http://127.0.0.1:${apiPort}`,
        },
      },
  ]
    : {
      command: `node node_modules/nuxt/bin/nuxt.mjs dev --host 127.0.0.1 --port ${port}`,
      cwd: webRoot,
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NUXT_PUBLIC_API_BASE: baseURL,
      },
    },
});

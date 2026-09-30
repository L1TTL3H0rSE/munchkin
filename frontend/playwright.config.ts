import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

import {defineConfig, devices} from "@playwright/test";

const webRoot = fileURLToPath(new URL("./applications/web/", import.meta.url));
const backendGameRoot = fileURLToPath(new URL("../backend/game/", import.meta.url));
const frontendRoot = fileURLToPath(new URL("./", import.meta.url));

const unmanagedRunDirectory = path.join(
  os.tmpdir(),
  `munchkin-playwright-${process.pid}`,
);
const outputDir = process.env.MUNCHKIN_PLAYWRIGHT_OUTPUT_DIR
  ?? path.join(unmanagedRunDirectory, "artifacts");
const reportDir = process.env.MUNCHKIN_PLAYWRIGHT_REPORT_DIR
  ?? path.join(unmanagedRunDirectory, "report");
const nodeCommand = process.platform === "win32"
  ? `"${process.execPath}"`
  : process.execPath;

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const apiPort = Number(process.env.PLAYWRIGHT_API_PORT ?? 18080);
const managedByRunner = process.env.MUNCHKIN_PLAYWRIGHT_MANAGED_SERVERS === "1";
const baseURL = process.env.WEB_BASE_URL ?? `http://127.0.0.1:${port}`;
const gameContentPath = process.env.GAME_CONTENT_PATH ?? "../../content/sets/moscow/v5/cards.json";
const nuxtCommand = `${nodeCommand} node_modules/nuxt/bin/nuxt.mjs dev --host 127.0.0.1 --port ${port} --no-fork`;

export default defineConfig({
  testDir: path.join(frontendRoot, "test/browser"),
  outputDir,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: Number(process.env.MUNCHKIN_PLAYWRIGHT_WORKERS ?? 1),
  reporter: process.env.CI
    ? [["dot"], ["html", {outputFolder: reportDir, open: "never"}]]
    : "list",
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
  ],
  webServer: managedByRunner
    ? undefined
    : [
      {
        command: "go run -tags=munchkin_e2e ./cmd/server",
        cwd: backendGameRoot,
        url: `http://127.0.0.1:${apiPort}/healthz`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          SERVER_ADDR: `127.0.0.1:${apiPort}`,
          GAME_CONTENT_PATH: gameContentPath,
          MUNCHKIN_TEST_MODE: "1",
          MUNCHKIN_TEST_RANDOM_SEED: process.env.MUNCHKIN_TEST_RANDOM_SEED ?? "120",
          AUTO_MIGRATE: "false",
          CORS_ALLOWED_ORIGINS: baseURL,
        },
      },
      {
        command: nuxtCommand,
        cwd: webRoot,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          NUXT_PUBLIC_API_BASE: `http://127.0.0.1:${apiPort}`,
        },
      },
    ],
});

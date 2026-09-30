import {fileURLToPath} from "node:url";
import {playwright} from "@vitest/browser-playwright";
import {storybookTest} from "@storybook/addon-vitest/vitest-plugin";
import {defineConfig, mergeConfig} from "vitest/config";
import viteConfig from "./vite.config.ts";

type MediaPreferences = {reducedMotion?: "reduce" | "no-preference"; forcedColors?: "active" | "none"};

// Explicit ports below 49152: Windows reserves dynamic-range blocks (Hyper-V/WSL/Docker)
// and a collision there is EACCES, which Vite does not retry.
const chromium = (name: string, port: number) => ({
  enabled: true,
  headless: true,
  provider: playwright({contextOptions: {reducedMotion: "reduce", locale: "ru-RU", timezoneId: "UTC"}}),
  api: {port},
  screenshotFailures: false,
  instances: [{browser: "chromium" as const, name, viewport: {width: 1440, height: 900}}],
  commands: {
    parkPointer: async ({page}: {page: {mouse: {move: (x: number, y: number) => Promise<void>}}}) => {
      await page.mouse.move(-1, -1);
    },
    emulateMedia: async (
      {page}: {page: {emulateMedia: (options: MediaPreferences) => Promise<void>}},
      options: MediaPreferences,
    ) => {
      await page.emulateMedia(options);
    },
  },
  expect: {toMatchScreenshot: {timeout: 20_000}},
});

// Stories use template decorators, so browser projects need Vue's runtime compiler.
const runtimeCompiler = {resolve: {alias: {vue: "vue/dist/vue.esm-bundler.js"}}} as const;

export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {name: "unit", sequence: {groupOrder: 0}, include: ["test/**/*.test.ts"], exclude: ["test/browser/**"]},
      },
      {
        extends: true,
        plugins: [storybookTest({configDir: fileURLToPath(new URL(".storybook", import.meta.url))})],
        ...runtimeCompiler,
        test: {
          name: "storybook",
          sequence: {groupOrder: 1},
          maxWorkers: 1,
          browser: chromium("stories", Number(process.env.STORYBOOK_TEST_PORT ?? 6109)),
        },
      },
      {
        extends: true,
        ...runtimeCompiler,
        test: {
          name: "browser",
          sequence: {groupOrder: 2},
          include: ["test/browser/**/*.test.ts"],
          setupFiles: ["test/browser/setup.ts"],
          maxWorkers: 1,
          browser: chromium("screens", Number(process.env.BROWSER_TEST_PORT ?? 6110)),
        },
      },
    ],
  },
}));

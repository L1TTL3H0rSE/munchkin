import {fileURLToPath} from "node:url";
import {playwright} from "@vitest/browser-playwright";
import {storybookTest} from "@storybook/addon-vitest/vitest-plugin";
import {defineConfig, mergeConfig} from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(viteConfig, defineConfig({
  test: {
    projects: [
      {extends: true, test: {name: "unit", include: ["test/**/*.test.ts"]}},
      {
        extends: true,
        plugins: [storybookTest({configDir: fileURLToPath(new URL(".storybook", import.meta.url))})],
        resolve: {alias: {vue: "vue/dist/vue.esm-bundler.js"}},
        test: {
          name: "storybook",
          maxWorkers: 1,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({contextOptions: {reducedMotion: "reduce", locale: "ru-RU", timezoneId: "UTC"}}),
            api: {port: Number(process.env.STORYBOOK_TEST_PORT ?? 6109)},
            screenshotFailures: false,
            instances: [{
              browser: "chromium",
              viewport: {width: 1440, height: 900},
            }],
          },
        },
      },
    ],
  },
}));

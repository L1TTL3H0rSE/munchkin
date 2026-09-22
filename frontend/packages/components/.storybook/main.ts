import type {StorybookConfig} from "@storybook/vue3-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.ts"],
  addons: ["@storybook/addon-vitest"],
  framework: "@storybook/vue3-vite",
  staticDirs: ["../public"],
};
export default config;

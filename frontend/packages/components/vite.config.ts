import {isAbsolute, resolve} from "node:path";
import vue from "@vitejs/plugin-vue";
import type {UserConfig} from "vite";

export default {
  plugins: [vue()],
  build: {
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        "screens/index": resolve(import.meta.dirname, "src/screens/index.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: "style",
    },
    rolldownOptions: {
      external: (source) => !isAbsolute(source) && !source.startsWith(".") &&
        !source.startsWith("/") && !source.startsWith("\0") && !source.startsWith("virtual:"),
    },
  },
} satisfies UserConfig;

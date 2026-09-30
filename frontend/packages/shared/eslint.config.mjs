import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser,
      parserOptions: {projectService: true, tsconfigRootDir: import.meta.dirname},
    },
    plugins: {"@typescript-eslint": tsPlugin},
    rules: {
      "no-console": "error",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
];

import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import vue from "eslint-plugin-vue";

const typed = {projectService: true, tsconfigRootDir: import.meta.dirname, extraFileExtensions: [".vue"]};
const rules = {"no-console": "error", "@typescript-eslint/no-floating-promises": "error"};

export default [
  {ignores: ["dist/**", "storybook-static/**"]},
  ...vue.configs["flat/base"],
  {
    files: ["**/*.ts"],
    languageOptions: {parser, parserOptions: typed},
    plugins: {"@typescript-eslint": tsPlugin},
    rules,
  },
  {
    files: ["**/*.vue"],
    languageOptions: {parserOptions: {parser, ...typed}},
    plugins: {"@typescript-eslint": tsPlugin},
    rules,
  },
];

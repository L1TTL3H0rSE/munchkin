import parser from "@typescript-eslint/parser";
import vue from "eslint-plugin-vue";

export default [
  {ignores: ["dist/**", "storybook-static/**"]},
  ...vue.configs["flat/base"],
  {
    files: ["**/*.ts"],
    languageOptions: {parser},
    rules: {"no-console": "error"},
  },
  {
    files: ["**/*.vue"],
    languageOptions: {parserOptions: {parser}},
    rules: {"no-console": "error"},
  },
];

import parser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser,
    },
    rules: {
      "no-console": "error",
    },
  },
];

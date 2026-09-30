import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt({
  files: ["**/*.ts", "**/*.vue"],
  languageOptions: {
    parserOptions: {
      projectService: {
        // Nitro plugins and server-side tests are outside the generated Nuxt app project.
        allowDefaultProject: ["server/plugins/*.ts", "server/utils/telemetry/*.test.ts"],
        defaultProject: "test/tsconfig.json",
      },
      tsconfigRootDir: import.meta.dirname,
      extraFileExtensions: [".vue"],
    },
  },
  rules: {"@typescript-eslint/no-floating-promises": "error"},
});

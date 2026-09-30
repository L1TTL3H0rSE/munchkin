import {fileURLToPath} from "node:url";
import {compile, compileString} from "sass-embedded";
import {describe, expect, it} from "vitest";

const scss = fileURLToPath(new URL("../src/assets/scss", import.meta.url));

// Every SFC and page stylesheet `@use`s the API; any rule it emits is duplicated per consumer.
describe("SCSS API", () => {
  it("emits no CSS on its own", () => {
    expect(compile(`${scss}/api/_index.scss`).css).toBe("");
  });

  it("keeps mixins usable without global rules", () => {
    const {css} = compileString(
      '@use "api"; .x { @include api.focus-ring; @include api.at-most(tablet) { color: red; } }',
      {loadPaths: [scss]},
    );
    expect(css).toContain("outline: 3px solid var(--color-focus)");
    expect(css).toContain("@media (width <= 767px)");
    expect(css).not.toContain(":root");
  });

  it("defines the tokens once, in the global stylesheet", () => {
    const {css} = compile(`${scss}/main.scss`);
    expect(css.match(/:root\s*\{/g)).toHaveLength(1);
    expect(css).toContain("--color-canvas: #f6f3ec");
    expect(css).toContain("--breakpoint-mobile-max: 374px");
  });
});

import axe from "axe-core";
import {expect, it} from "vitest";
import {compact, renderFixture, wide} from "./screen";

async function seriousViolations(): Promise<string[]> {
  const {violations} = await axe.run(document.body);
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}

it.each([["full-roster-combat", wide], ["full-roster-combat", compact]] as const)(
  "axe serious and critical violations are absent: %s %o",
  async (fixtureID, viewport) => {
    await renderFixture(fixtureID, viewport);
    expect(await seriousViolations()).toEqual([]);
  },
);

import {AxeBuilder} from "@axe-core/playwright";
import {expect, test} from "@playwright/test";

import {fixtureIDs, openFixture} from "./fixtureSupport.ts";

for (const fixtureID of fixtureIDs()) {
  test(`axe serious and critical violations are absent: ${fixtureID}`, async ({page}) => {
    await openFixture(page, fixtureID);
    const results = await new AxeBuilder({page})
      .include("#main-content")
      .analyze();
    const seriousOrCritical = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(seriousOrCritical).toEqual([]);
  });
}

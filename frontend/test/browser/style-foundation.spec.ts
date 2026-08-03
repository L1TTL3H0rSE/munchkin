import {expect, test} from "@playwright/test";

import {openFixture} from "./fixtureSupport.ts";

test("paper token foundation keeps the shell keyboard-safe at 360x640", async ({page}) => {
  await page.setViewportSize({width: 360, height: 640});
  await page.goto("/");

  await expect(page.locator("#main-content")).toBeVisible();

  const foundation = await page.evaluate(() => {
    const root = document.documentElement;
    const styles = getComputedStyle(root);
    const body = getComputedStyle(document.body);
    return {
      colorScheme: styles.colorScheme,
      canvas: styles.getPropertyValue("--color-canvas").trim(),
      mobileBoundary: styles.getPropertyValue("--breakpoint-mobile-max").trim(),
      bodyMinHeight: Number.parseFloat(body.minHeight),
      rootFitsViewport: root.scrollWidth <= root.clientWidth,
    };
  });

  expect(foundation.colorScheme).toContain("light");
  expect(foundation.canvas).toBe("#f6f3ec");
  expect(foundation.mobileBoundary).toBe("374px");
  expect(foundation.bodyMinHeight).toBeGreaterThanOrEqual(640);
  expect(foundation.rootFitsViewport).toBe(true);

  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();

  await page.emulateMedia({reducedMotion: "reduce"});
  const reducedMotionMilliseconds = await page.locator(".skip-link").evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    const numeric = Number.parseFloat(value);
    return value.endsWith("s") && !value.endsWith("ms") ? numeric * 1000 : numeric;
  });
  expect(reducedMotionMilliseconds).toBeLessThanOrEqual(0.01);
});

test("Card Studio keeps its isolated compatibility surface", async ({page}) => {
  await page.goto("/studio/cards");

  await expect(page.locator(".studio")).toBeVisible();
  await expect(page.locator(".studio-auth")).toBeVisible();

  const studio = await page.locator(".studio").evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      colorScheme: styles.colorScheme,
      paper: styles.getPropertyValue("--paper").trim(),
      accent: styles.getPropertyValue("--acid").trim(),
    };
  });

  expect(studio.colorScheme).toContain("dark");
  expect(studio.paper).toBe("#11120f");
  expect(studio.accent).toBe("#c8ff3d");
});

test("game fixture inherits the paper foundation without document overflow", async ({page}) => {
  await page.setViewportSize({width: 360, height: 640});
  await openFixture(page, "single-combat");

  const gameFoundation = await page.locator(".game-table").evaluate((element) => {
    const root = getComputedStyle(document.documentElement);
    const table = getComputedStyle(element);
    return {
      colorScheme: root.colorScheme,
      canvas: root.getPropertyValue("--color-canvas").trim(),
      minWidth: table.minWidth,
      rootFitsViewport: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    };
  });

  expect(gameFoundation.colorScheme).toContain("light");
  expect(gameFoundation.canvas).toBe("#f6f3ec");
  expect(gameFoundation.minWidth).toBe("0px");
  expect(gameFoundation.rootFitsViewport).toBe(true);
});

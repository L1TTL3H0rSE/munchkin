import {expect, test} from "@playwright/test";

// App-level shell behaviour that lives in Nuxt (app.vue, dev-only Studio page), not in screen stories.

test("lobby shell keeps the skip link and honours reduced motion", async ({page}) => {
  await page.setViewportSize({width: 360, height: 640});
  await page.goto("/");
  await expect(page.locator(".lobby-page")).toHaveAttribute("data-interactive", "true", {timeout: 15_000});

  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.emulateMedia({reducedMotion: "reduce"});
  const transitionMilliseconds = await page.locator(".skip-link").evaluate((element) => {
    const value = getComputedStyle(element).transitionDuration;
    const numeric = Number.parseFloat(value);
    return value.endsWith("s") && !value.endsWith("ms") ? numeric * 1000 : numeric;
  });
  expect(transitionMilliseconds).toBeLessThanOrEqual(0.01);
});

test("Card Studio keeps its isolated dark surface in development", async ({page}) => {
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

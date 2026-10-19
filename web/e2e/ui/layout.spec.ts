/** Desktop and mobile layouts (runs in both the "desktop" and "mobile" projects). */
import { FILES, expect, fillAndAnalyze, results, setScenario, test } from "../fixtures";

const PAGES = ["/", "/history", "/plant-guide", "/disease-library", "/care-tips", "/about"];

const noHorizontalOverflow = (page: import("@playwright/test").Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("no page scrolls sideways", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    expect(await noHorizontalOverflow(page), path).toBe(true);
  }
});

test("navigation matches the screen size", async ({ page, isMobile }) => {
  await page.goto("/");
  const menuButton = page.getByRole("button", { name: "Open menu" });
  if (isMobile) {
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await drawer.getByRole("link", { name: "Plant Diseases" }).click();
    await expect(page).toHaveURL(/\/disease-library$/);
    await expect(drawer).toHaveCount(0);
  } else {
    await expect(menuButton).toBeHidden();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Check a Plant" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Care Tips" }).click();
    await expect(page).toHaveURL(/\/care-tips$/);
    await expect(nav.getByRole("link", { name: "Care Tips" })).toHaveAttribute("aria-current", "page");
  }
});

test("results dashboard fits the screen", async ({ page, request, isMobile }) => {
  await setScenario(request, {});
  await page.goto("/");
  await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
  await expect(results(page).getByRole("img", { name: /Highlight map/ })).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
  // Desktop: results and next steps side by side; mobile: stacked.
  const resultsBox = await page.getByRole("heading", { name: "Your Plant Check Results" }).boundingBox();
  const stepsBox = await page.getByRole("heading", { name: "Suggested Next Steps" }).boundingBox();
  if (isMobile) expect(stepsBox!.y).toBeGreaterThan(resultsBox!.y + 200);
  else expect(stepsBox!.x).toBeGreaterThan(resultsBox!.x + 500);   // next steps in the right-hand column
});

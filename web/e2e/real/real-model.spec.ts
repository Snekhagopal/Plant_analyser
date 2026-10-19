/**
 * Integration tests against the REAL API (real MobileNetV2, CLIP checks, Grad-CAM; temporary history).
 * They assert properties of real inference observed on these fixtures, not scripted results.
 */
import { FILES, assessment, expect, fillAndAnalyze, results, test } from "../fixtures";

test("real model: PlantVillage tomato early-blight sample is a likely match with Grad-CAM", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Tomato leaf labelled early blight/ }).click();
  await page.getByRole("button", { name: /Check My Plant/ }).click();
  const r = results(page);
  await expect(r.getByText("Likely match", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(r.getByText("Tomato early blight").first()).toBeVisible();
  await expect(r.getByRole("img", { name: /Highlight map/ })).toBeVisible();
  await expect(page.locator("details", { hasText: "Treatment options" })).toContainText("follow the product label");
});

test("real model: whitefly photo flags pests and does not claim a confident disease", async ({ page }) => {
  await page.goto("/");
  await fillAndAnalyze(page, { file: FILES.whitefly, plant: "Tomato" });
  const r = results(page);
  await expect(r.getByText("Possible insects or eggs were detected on your Tomato leaf.")).toBeVisible({ timeout: 60_000 });
  await expect(assessment(page, "Pests")).toContainText("Found");
  await expect(r.getByText("Likely match", { exact: true })).toHaveCount(0);
});

test("real model: hibiscus gets the general symptom check, no disease label, no Grad-CAM", async ({ page }) => {
  await page.goto("/");
  await fillAndAnalyze(page, { file: FILES.hibiscus, plant: "Hibiscus" });
  const r = results(page);
  await expect(r.getByText(/don.t have a disease check for this plant/)).toBeVisible({ timeout: 60_000 });
  await expect(r.getByText("No disease check for Hibiscus")).toBeVisible();
  await expect(r.getByRole("img", { name: /Highlight map/ })).toHaveCount(0);
  // The real symptom check sees spots and/or mottling on this leaf, never "no obvious symptoms".
  await expect(assessment(page, "Visible symptoms")).toContainText(/Leaf spots or blight|Mosaic, mottling or yellowing/);
});

test("real model: the same leaf as a whole-plant photo is capped at uncertain", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Tomato leaf labelled early blight/ }).click();
  await page.getByLabel("What does your photo show?").selectOption("whole_plant");
  await page.getByRole("button", { name: /Check My Plant/ }).click();
  const r = results(page);
  await expect(r.getByText("Whole-plant photo", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(r.getByText("Likely match", { exact: true })).toHaveCount(0);
  await expect(r.getByText(/The app isn.t sure enough to name one problem/)).toBeVisible();
});

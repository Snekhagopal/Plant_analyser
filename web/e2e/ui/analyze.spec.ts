/**
 * Analyze page against the scripted API: the real FastAPI pipeline with scripted classifier scores,
 * so every result type can be produced deterministically. These tests validate the UI and the
 * backend's decision rules, not real model inference (see e2e/real for that).
 */
import { DEAD_API, FILES, alertWith, assessment, choosePlant, expect, fillAndAnalyze, results, setScenario, test } from "../fixtures";

const SAP_SUCKERS = "small sap-sucking insects (e.g. whiteflies, aphids, mealybugs, scale)";
const gradcamImage = (page: import("@playwright/test").Page) => results(page).getByRole("img", { name: /Highlight map/ });

test.beforeEach(async ({ request }) => setScenario(request, {}));   // default: confident tomato early blight

test.describe("Analyze page", () => {
  test("hero banner renders with the healthy-plant photo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Healthy Plants\s*Happier Days/ })).toBeVisible();
    await expect(page.getByText("AI Plant Doctor")).toBeVisible();
    const hero = page.locator('section[aria-labelledby="hero-title"] img').first();
    await expect(hero).toHaveAttribute("src", /hero\.jpg/);
    await expect.poll(() => hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  });

  test("sample leaf fills the form without analysing", async ({ page }) => {
    let analyzeCalls = 0;
    page.on("request", (r) => { if (r.url().includes("/api/analyze")) analyzeCalls++; });
    await page.goto("/");
    await page.getByRole("button", { name: /Potato leaf labelled late blight/ }).click();
    await expect(page.getByText("Example photo: Potato · Late blight")).toBeVisible();
    await expect(page.getByRole("combobox", { name: /Plant name/ })).toHaveValue("Potato");
    await expect(page.getByText("Disease check", { exact: true }).first()).toBeVisible();
    expect(analyzeCalls).toBe(0);
  });

  test("confident disease prediction: loading, results, Grad-CAM, treatment with safety", async ({ page, request, apiTarget }) => {
    await setScenario(request, { weights: { "Tomato___Early_blight": 0.97 }, symptom: { key: "spots", p: 0.8 } });
    await page.goto("/");
    // Hold the response briefly so the loading state can be observed.
    await page.route(`${DEAD_API}/api/analyze`, async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue({ url: route.request().url().replace(DEAD_API, apiTarget) });
    });
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    await expect(page.getByRole("button", { name: /Checking your plant/ })).toBeVisible();
    await expect(results(page)).toBeVisible();

    const r = results(page);
    await expect(r.getByText("Likely match", { exact: true }).first()).toBeVisible();
    await expect(r.getByText("Tomato early blight").first()).toBeVisible();
    await expect(r.getByRole("img", { name: "Score 97%" })).toBeVisible();
    await expect(r.getByText(/not.*the\s+chance that the answer is correct/).first()).toBeVisible();
    await expect(gradcamImage(page)).toBeVisible();
    await expect(r.getByRole("img", { name: "Your uploaded photo" })).toBeVisible();

    const steps = page.getByRole("heading", { name: "Suggested Next Steps" });
    await expect(steps).toBeVisible();
    await expect(page.getByRole("heading", { name: "Care Guide for Tomato" })).toBeVisible();

    const treatment = page.locator("details", { hasText: "Treatment options" });
    await expect(treatment).toHaveAttribute("open", "");
    await expect(treatment).toContainText("A fungicide labelled for tomato early blight on tomato");
    await expect(treatment).toContainText("follow the product label and local regulations");
    await expect(page.getByText("What the leaf looks like (photo check)")).toBeVisible();   // kept separate from the disease

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save results" }).click();
    expect((await download).suggestedFilename()).toMatch(/^plantvision-check-\d+\.json$/);
  });

  test("uncertain prediction is not presented as reliable", async ({ page, request }) => {
    await setScenario(request, { weights: { "Tomato___Early_blight": 0.5 } });
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    const r = results(page);
    await expect(r.getByText(/The app isn.t sure enough to name one problem/)).toBeVisible();
    await expect(r.getByText(/Not certain enough to act on yet/)).toBeVisible();
    await expect(r.getByText("Likely match", { exact: true })).toHaveCount(0);
    await expect(page.locator("details", { hasText: "Treatment options - only after confirming the cause" })).toBeVisible();
    await expect(page.getByText(/Do not treat for Tomato early blight yet/).first()).toBeVisible();
  });

  test("pests in the photo: pest finding shown, disease suggestion marked unreliable", async ({ page, request }) => {
    await setScenario(request, { weights: { "Tomato___Late_blight": 0.95 }, pest_score: 0.95, pest_top: [[SAP_SUCKERS, 0.8]] });
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.whitefly, plant: "Tomato" });
    const r = results(page);
    await expect(r.getByText(/Possible insects or eggs were detected on your Tomato leaf/)).toBeVisible();
    const pests = assessment(page, "Pests");
    await expect(pests).toContainText("Found");
    await expect(pests).toContainText("Possible insects or eggs in the photo");
    await expect(r.getByText("Likely match", { exact: true })).toHaveCount(0);
    const treatment = page.locator("details", { hasText: "Treatment options" });
    await expect(treatment).toContainText("Identify the pest first");
    await expect(treatment).toContainText("insecticidal soap or horticultural oil");
  });

  test("plant without a disease model: symptom findings, no Grad-CAM", async ({ page, request }) => {
    await setScenario(request, { symptom: { key: "spots", p: 0.48, clear: false, second: "mottling", p2: 0.47 } });
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.hibiscus, plant: "Hibiscus" });
    const r = results(page);
    await expect(r.getByText(/don.t have a disease check for this plant/)).toBeVisible();
    await expect(r.getByText("Leaf spots or blight + Mosaic, mottling or yellowing").first()).toBeVisible();
    await expect(r.getByText("No disease check for Hibiscus")).toBeVisible();
    await expect(gradcamImage(page)).toHaveCount(0);
    await expect(r.getByText("Highlight maps are only available for the 14 crops with a disease check.")).toBeVisible();
    await expect(page.locator("details", { hasText: /^Treatment options/ })).toHaveCount(0);
  });

  test("Grad-CAM is hidden when the result is not eligible", async ({ page, request }) => {
    await setScenario(request, { weights: { "Apple___Apple_scab": 0.95 } });   // looks like apple, user says tomato
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    const r = results(page);
    await expect(r.getByText(/Plant doesn.t match/).first()).toBeVisible();
    await expect(gradcamImage(page)).toHaveCount(0);
    await expect(r.getByText(/Not shown, because the app couldn.t give a reliable result/)).toBeVisible();

    await setScenario(request, { weights: { "Tomato___Early_blight": 0.97 }, ood_score: 999 });   // unfamiliar photo
    await page.getByRole("button", { name: /Check My Plant/ }).click();
    await expect(r.getByText(/Couldn.t recognize this photo/).first()).toBeVisible();
    await expect(gradcamImage(page)).toHaveCount(0);
  });

  test("whole-plant photo never gets a confident disease result", async ({ page, request }) => {
    await setScenario(request, { weights: { "Tomato___Early_blight": 0.99 } });
    await page.goto("/");
    await page.getByLabel("What does your photo show?").selectOption("whole_plant");
    await expect(page.getByText(/any disease result is only a rough guess/)).toBeVisible();
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    const r = results(page);
    await expect(r.getByText(/The app isn.t sure enough to name one problem/)).toBeVisible();
    await expect(r.getByText("Whole-plant photo", { exact: true })).toBeVisible();
    await expect(r.getByText("Likely match", { exact: true })).toHaveCount(0);
    await expect(r.getByText(/upload a close-up of one affected leaf/i).first()).toBeVisible();
    await expect(page.locator("details", { hasText: /^Treatment options/ })).toHaveCount(0);
  });

  test("photo that may not show a plant", async ({ page, request }) => {
    await setScenario(request, {});
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.grayNoise, plant: "Tomato" });
    const r = results(page);
    await expect(r.getByText("May not be a plant", { exact: true }).first()).toBeVisible();
    await expect(assessment(page, "Disease")).toContainText("Not checked");
  });

  test("model unavailable and analysis failure are reported without internals", async ({ page, request }) => {
    await setScenario(request, { model: false });
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    await expect(results(page).getByText("Disease check unavailable").first()).toBeVisible();

    await setScenario(request, { raises: true });
    await page.getByRole("button", { name: /Check My Plant/ }).click();
    await expect(results(page).getByText("Something went wrong").first()).toBeVisible();
    await expect(page.getByText(/scripted inference failure|Traceback/)).toHaveCount(0);
  });
});

test("WebP photos are accepted", async ({ page, request }) => {
  await setScenario(request, { weights: { "Tomato___Early_blight": 0.97 } });
  await page.goto("/");
  await expect(page.getByText(/JPG, PNG or WebP/)).toBeVisible();
  await fillAndAnalyze(page, { file: FILES.tomatoWebp, plant: "Tomato" });
  // The file is accepted and analysed; the outcome itself is left to the backend's checks.
  await expect(page.getByRole("heading", { name: "Your Plant Check Results" })).toBeVisible();
  await expect(results(page).getByRole("img", { name: "Your uploaded photo" })).toBeVisible();
  await expect(results(page).getByText("Tomato early blight").first()).toBeVisible();
  await expect(alertWith(page, /can.t be used|could not be read/)).toHaveCount(0);
});

test.describe("Validation and errors", () => {
  test("missing photo and plant name", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Check My Plant/ }).click();
    await expect(alertWith(page, "Please add a photo of your plant or leaf.")).toBeVisible();
    await expect(alertWith(page, "Please choose or type your plant's name.")).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  test("unsupported file type and oversized file are rejected before upload", async ({ page }) => {
    await page.goto("/");
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: "leaf.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
    await expect(alertWith(page, "This type of file can't be used")).toBeVisible();
    await input.setInputFiles({ name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(11 * 1024 * 1024, 0xff) });
    await expect(alertWith(page, "too large (over 10 MB)")).toBeVisible();
  });

  test("corrupt image is rejected by the server and shown as a form error", async ({ page }) => {
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles({ name: "leaf.jpg", mimeType: "image/jpeg", buffer: Buffer.from("definitely not a jpeg".repeat(50)) });
    await choosePlant(page, "Tomato");
    await page.getByRole("button", { name: /Check My Plant/ }).click();
    await expect(alertWith(page, "could not be read as an image")).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  test("server error during analysis shows the API's message", async ({ page }) => {
    await page.goto("/");
    await page.route(`${DEAD_API}/api/analyze`, (route) => route.fulfill({
      status: 500, contentType: "application/json",
      body: JSON.stringify({ error: "internal_error", message: "Something went wrong on the server. Please try again." }),
    }));
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    await expect(alertWith(page, "Something went wrong on the server")).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  test("unreachable API: banner with retry, recovers when the API is back", async ({ page, apiTarget }) => {
    await page.route(`${DEAD_API}/api/meta`, (route) => route.abort("connectionrefused"));
    await page.goto("/");
    await expect(alertWith(page, "We can't connect to PlantVision AI")).toBeVisible();
    await page.unroute(`${DEAD_API}/api/meta`);
    await page.route(`${DEAD_API}/api/meta`, (route) => route.continue({ url: route.request().url().replace(DEAD_API, apiTarget) }));
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("combobox", { name: /Plant name/ })).toBeVisible();
    await expect(alertWith(page, /\S/)).toHaveCount(0);
  });
});

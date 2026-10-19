/** History, Plant Guide, Disease Library, Care Tips and About - each against the data the API serves. */
import { FILES, SCRIPTED_API, clearHistory, expect, fillAndAnalyze, results, setScenario, test } from "../fixtures";

test.describe("History", () => {
  test.beforeEach(async ({ request }) => { await clearHistory(request); await setScenario(request, {}); });

  test("empty state links back to Analyze", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByText("No plant checks yet")).toBeVisible();
    await page.getByRole("link", { name: /Check a plant/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("lists analyses, shows details, downloads, deletes one and then all", async ({ page, request }) => {
    await page.goto("/");
    await fillAndAnalyze(page, { file: FILES.tomatoEarlyBlight, plant: "Tomato" });
    await expect(results(page)).toBeVisible();
    await setScenario(request, { symptom: { key: "mildew", p: 0.9 } });
    await fillAndAnalyze(page, { file: FILES.hibiscus, plant: "Hibiscus" });
    await expect(results(page).getByText(/don.t have a disease check for this plant/)).toBeVisible();

    await page.getByRole("link", { name: "Past Checks" }).click();
    const list = page.getByRole("region", { name: "Saved checks" });
    const entries = list.getByRole("listitem");
    await expect(entries).toHaveCount(2);
    await expect(entries.first()).toContainText("Hibiscus");
    await expect(page.getByRole("heading", { name: "Hibiscus" })).toBeVisible();            // newest selected
    await expect(page.getByText(/Powdery mildew-like coating/).first()).toBeVisible();

    await list.getByRole("button", { name: /Tomato/ }).click();
    await expect(page.getByRole("heading", { name: "Tomato" })).toBeVisible();
    await expect(page.getByText(/most likely match for your Tomato is/)).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Save as file" }).click();
    expect((await download).suggestedFilename()).toMatch(/^plantvision-past-check-\d+\.json$/);

    await page.getByRole("button", { name: "Delete this check" }).click();
    await page.getByRole("button", { name: "Confirm delete" }).click();
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText("Hibiscus");
    expect((await (await request.get(`${SCRIPTED_API}/api/history`)).json()).length).toBe(1);

    await page.getByRole("button", { name: "Delete all past checks…" }).click();
    const deleteAll = page.getByRole("button", { name: "Delete all", exact: true });
    await expect(deleteAll).toBeDisabled();
    await page.getByLabel(/permanently deletes all 1 saved checks/).check();
    await deleteAll.click();
    await expect(page.getByText("No plant checks yet")).toBeVisible();
  });
});

test.describe("Plant Guide", () => {
  test("search, select and read a care guide", async ({ page }) => {
    await page.goto("/plant-guide");
    await page.getByPlaceholder("Search plants…").fill("hibis");
    await page.getByRole("button", { name: "Hibiscus" }).click();
    await expect(page.getByRole("heading", { name: "Hibiscus" })).toBeVisible();
    await expect(page.getByText("General check & care guide")).toBeVisible();
    await expect(page.getByText("Watering", { exact: true })).toBeVisible();
    await expect(page.getByText(/don.t have a disease check for Hibiscus/)).toBeVisible();
    await expect(page).toHaveURL(/\?name=Hibiscus/);
  });

  test("deep link to a supported crop lists its conditions and links to the library", async ({ page }) => {
    await page.goto("/plant-guide?name=Tomato");
    await expect(page.getByRole("heading", { name: "Tomato", level: 2 })).toBeVisible();
    await expect(page.getByText("Problems we can check for on Tomato")).toBeVisible();
    await expect(page.locator('a[href^="/disease-library#Tomato___"]')).toHaveCount(10);
    await page.getByRole("link", { name: /Septoria leaf spot/ }).click();
    await expect(page).toHaveURL(/\/disease-library#Tomato___Septoria_leaf_spot/);
    await expect(page.locator('article[id="Tomato___Septoria_leaf_spot"]')).toBeInViewport();
  });

  test("filter to plants with a disease check", async ({ page }) => {
    await page.goto("/plant-guide");
    await page.getByLabel("Only plants with a disease check").check();
    await expect(page.locator('section[aria-label="Plants"] li button')).toHaveCount(14);
  });
});

test.describe("Disease Library", () => {
  test("shows the model's classes with filters", async ({ page, request }) => {
    const all = await (await request.get(`${SCRIPTED_API}/api/conditions`)).json();
    const diseases = all.filter((c: { category: string }) => c.category !== "Healthy");
    await page.goto("/disease-library");
    await expect(page.getByText(`Showing ${diseases.length} of ${all.length} entries`)).toBeVisible();
    await expect(page.locator("article")).toHaveCount(diseases.length);

    await page.getByLabel("Show healthy-leaf entries").check();
    await expect(page.locator("article")).toHaveCount(all.length);

    await page.getByLabel("Crop").selectOption("Apple");
    await expect(page.locator("article")).toHaveCount(4);
    await page.getByPlaceholder("Search conditions…").fill("rust");
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.locator("article")).toContainText("Cedar apple rust");
    await expect(page.locator("article")).toContainText("When to get help");
  });
});

test.describe("Care Tips", () => {
  test("care groups with plants, searchable, linking to the plant guide", async ({ page, request }) => {
    const groups = await (await request.get(`${SCRIPTED_API}/api/care-groups`)).json();
    await page.goto("/care-tips");
    await expect(page.locator("article")).toHaveCount(groups.length);
    await page.getByPlaceholder("Find a plant or plant type…").fill("basil");
    await expect(page.locator("article").first()).toContainText("Basil");
    await page.locator("article").getByRole("link", { name: "Basil", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Basil" })).toBeVisible();
  });
});

test.describe("About", () => {
  test("measured metrics come from the API and service status is shown", async ({ page, request }) => {
    const about = await (await request.get(`${SCRIPTED_API}/api/about`)).json();
    const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "How PlantVision AI works" })).toBeVisible();
    const card = (name: string) => page.getByRole("region", { name });
    await expect(card("Disease check").getByText(pct(about.disease_test.accuracy, 1), { exact: true })).toBeVisible();
    await expect(card("Insect check").getByText(pct(about.pest_screen.ip102_hit_rate), { exact: true })).toBeVisible();
    await expect(card("Leaf check").getByText(pct(about.symptom_check.accuracy_when_clear), { exact: true })).toBeVisible();
    const status = page.locator('section[aria-labelledby="status"]');
    await expect(status.getByText("Disease check")).toBeVisible();
    await expect(status.getByText("Working").first()).toBeVisible();
    await expect(page.getByText("This is not a diagnosis.")).toBeVisible();
  });
});

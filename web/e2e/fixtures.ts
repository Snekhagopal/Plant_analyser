import path from "node:path";
import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

/** The e2e build's API base: a dead address, so an unrouted call fails instead of reaching a real server. */
export const DEAD_API = "http://127.0.0.1:65530";
export const SCRIPTED_API = "http://127.0.0.1:8101";
export const REAL_API = "http://127.0.0.1:8102";

const ROOT = path.resolve(__dirname, "../..");
export const FILES = {
  hibiscus: path.join(ROOT, "tests/fixtures/hibiscus_leaf_spots.jpg"),
  whitefly: path.join(ROOT, "tests/fixtures/whitefly_tomato_leaf.jpg"),
  tomatoEarlyBlight: path.join(ROOT, "web/public/samples/tomato-early-blight.jpg"),
  potatoLateBlight: path.join(ROOT, "web/public/samples/potato-late-blight.jpg"),
  grayNoise: path.join(ROOT, "web/e2e/fixtures/gray-noise.jpg"),
  tomatoWebp: path.join(ROOT, "web/e2e/fixtures/tomato-leaf.webp"),
};

/** Scripted classifier output (see e2e/servers/scripted_api.py). */
export type Scenario = {
  weights?: Record<string, number>;
  ood_score?: number;
  pest_score?: number;
  pest_top?: [string, number][];
  symptom?: { key: string; p: number; clear?: boolean; second?: string; p2?: number } | null;
  raises?: boolean;
  model?: boolean;
};

export async function setScenario(request: APIRequestContext, scenario: Scenario) {
  const res = await request.post(`${SCRIPTED_API}/__test__/scenario`, { data: scenario });
  expect(res.ok()).toBeTruthy();
}

export async function clearHistory(request: APIRequestContext, api = SCRIPTED_API) {
  expect((await request.delete(`${api}/api/history`)).ok()).toBeTruthy();
}

/** Upload a photo, choose the plant (and photo type) and submit, like a user would. */
export async function fillAndAnalyze(page: Page, opts: { file?: string; plant?: string; photoType?: "leaf" | "whole_plant" }) {
  if (opts.file) {
    const remove = page.getByRole("button", { name: "Remove" });   // a previous photo is still selected
    if (await remove.isVisible()) await remove.click();
    await page.locator('input[type="file"]').setInputFiles(opts.file);
  }
  if (opts.plant) await choosePlant(page, opts.plant);
  if (opts.photoType) await page.getByLabel("What does your photo show?").selectOption(opts.photoType);
  await page.getByRole("button", { name: /Check My Plant/ }).click();
}

export async function choosePlant(page: Page, plant: string) {
  const box = page.getByRole("combobox", { name: /Plant name/ });
  await box.fill(plant);
  await page.getByRole("option", { name: new RegExp(`^${plant.replace(/[()]/g, "\\$&")}`) }).first().click();
  await expect(box).toHaveValue(plant);
}

export const results = (page: Page) => page.locator("#results");

/** One of the four health-summary tiles (Overall health, Visible symptoms, Pests, Disease). */
export const assessment = (page: Page, title: string) =>
  results(page).getByRole("list", { name: "Health summary" }).getByRole("listitem")
    .filter({ has: page.getByText(title, { exact: true }) });

/** App alerts only (Next.js also renders an empty route announcer with role="alert"). */
export const alertWith = (page: Page, text: string | RegExp) => page.getByRole("alert").filter({ hasText: text });

// Playwright's fixture callback is named `provide` (not `use`) so the React hooks lint rule ignores it.
export const test = base.extend<{ apiTarget: string; routeApi: void }>({
  apiTarget: async ({}, provide, testInfo) => {
    await provide(testInfo.project.name === "real-model" ? REAL_API : SCRIPTED_API);
  },
  // Every browser call to the (dead) API base is sent to the test API for this project.
  routeApi: [async ({ page, apiTarget }, provide) => {
    await page.route(`${DEAD_API}/**`, (route) => route.continue({ url: route.request().url().replace(DEAD_API, apiTarget) }));
    await provide();
  }, { auto: true }],
});

export { expect };

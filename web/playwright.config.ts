import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for PlantVision AI.
 *
 * Servers (started automatically, all with temporary history databases):
 * - 3100: a separate production build of this app (.next-e2e) whose API base is a dead address
 *         (127.0.0.1:65530); every API call is rerouted by the test fixture, so a test can never
 *         reach the real API on :8000 or add entries to data/history.db.
 * - 8101: scripted API - real FastAPI pipeline, scripted classifier scores (deterministic UI states).
 * - 8102: real API - real MobileNetV2 + CLIP (integration tests in e2e/real). Skip with E2E_REAL=0.
 *
 * Python: set PYTHON to the project environment, e.g. PYTHON=~/plant-health-env/bin/python.
 * Browser: the installed Google Chrome (channel "chrome"); set PW_CHANNEL="" to use Playwright's Chromium.
 */
const PYTHON = process.env.PYTHON || "python3";
const REAL = process.env.E2E_REAL !== "0";
const channel = process.env.PW_CHANNEL ?? "chrome";
const cors = { PLANT_API_CORS_ORIGINS: "http://localhost:3100" };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // the scripted API holds one scenario at a time
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    channel: channel || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", testDir: "./e2e/ui", use: { ...devices["Desktop Chrome"], viewport: { width: 1536, height: 1024 } } },
    { name: "mobile", testDir: "./e2e/ui", testMatch: /layout\.spec\.ts/, use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    ...(REAL ? [{ name: "real-model", testDir: "./e2e/real", timeout: 120_000, use: { viewport: { width: 1536, height: 1024 } } }] : []),
  ],
  webServer: [
    { command: `${PYTHON} e2e/servers/scripted_api.py`, url: "http://127.0.0.1:8101/api/health", env: cors, timeout: 120_000, reuseExistingServer: !process.env.CI },
    ...(REAL ? [{ command: `${PYTHON} e2e/servers/real_api.py`, url: "http://127.0.0.1:8102/api/health", env: cors, timeout: 180_000, reuseExistingServer: !process.env.CI }] : []),
    {
      command: "next build && next start -p 3100",
      url: "http://localhost:3100",
      env: { NEXT_DIST_DIR: ".next-e2e", NEXT_PUBLIC_API_BASE: "http://127.0.0.1:65530" },
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

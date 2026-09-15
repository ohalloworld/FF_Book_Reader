import { defineConfig, devices } from "@playwright/test";

// Runs against a dedicated port so it never collides with a dev server
// you might already have running locally. Every test that would touch a
// billed Claude endpoint (/api/parse-rules, /api/library/*/transcribe-page)
// mocks it via page.route — this suite never spends real API credits.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5180",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev -- --port 5180 --strictPort",
    url: "http://localhost:5180",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // This environment ships one pre-installed Chromium build (not the
        // separate "headless shell" Playwright's default config expects) —
        // point at it directly rather than trying to download another.
        launchOptions: { executablePath: "/opt/pw-browsers/chromium" },
      },
    },
  ],
});

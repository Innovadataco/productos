import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // workers ausente en local (undefined explícito ≡ default de Playwright)
    ...(process.env.CI ? { workers: 1 } : {}),
    reporter: "html",
    use: {
        baseURL: "http://localhost:5005",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
    webServer: {
        command: "npm run dev",
        url: "http://localhost:5005",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
            NODE_ENV: "test",
            DATABASE_URL: process.env.DATABASE_URL || "",
            DISABLE_RATE_LIMIT: "true",
            NEXT_PUBLIC_DISABLE_ONBOARDING: "true",
        },
    },
});

// SPEC-817 · resuelve DATABASE_URL (respeta el del entorno / deriva por worktree) ANTES de que el bloque
// `webServer.env` de abajo lea `process.env.DATABASE_URL`. En CI el valor ya viene del entorno → se respeta y
// la derivación no se dispara; en local se deriva la base del worktree.
import "./src/lib/test-db-url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    // SPEC-770: guardia estructural — corre antes de TODOS los specs y aborta la
    // corrida si la base conectada no es de pruebas (afirma contra
    // current_database(), no contra DATABASE_URL). Ningún spec puede sembrar
    // sobre prod, sin que nadie tenga que recordar importar nada.
    globalSetup: "./tests/e2e/guardia.global-setup.ts",
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

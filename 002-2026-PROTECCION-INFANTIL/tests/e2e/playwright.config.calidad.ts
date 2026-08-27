/**
 * Config de Playwright para las campañas de Calidad (Bloque D, sesión 4).
 *
 * - Corre contra `E2E_BASE_URL` (típicamente producción).
 * - Carga credenciales desde `~/.config/pi-e2e/.env.e2e` (permisos 600).
 *   Ninguna parte de este archivo imprime los valores.
 * - No arranca `webServer`: apunta al ambiente real.
 * - Sólo empareja specs cuyo nombre empiece por `calidad-` o `callejon-`.
 */
import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const envPath = join(homedir(), ".config", "pi-e2e", ".env.e2e");
if (!existsSync(envPath)) {
    throw new Error(
        `[Calidad] Falta el archivo de credenciales en ${envPath}. ` +
            `Debe existir con permisos 600 (ver 05-ENTREGABLES/PROMPT-REAPERTURA-ROLES.md · Bloque D §3).`,
    );
}
for (const linea of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const s = linea.trim();
    if (!s || s.startsWith("#")) continue;
    const idx = s.indexOf("=");
    if (idx < 1) continue;
    const key = s.slice(0, idx).trim();
    const val = s.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
}

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
    throw new Error(`[Calidad] E2E_BASE_URL ausente en ${envPath}.`);
}

export default defineConfig({
    testDir: __dirname,
    testMatch: /(calidad|callejon)-.*\.spec\.ts/,
    fullyParallel: false,
    retries: 0,
    workers: 1,
    // Reporte dentro de `playwright-report/` — ya ignorado por el .gitignore del subproyecto,
    // así respetamos el candado del Bloque D §4 (Calidad solo escribe en tests/e2e/**).
    reporter: [["list"], ["html", { outputFolder: "../../playwright-report/calidad", open: "never" }]],
    use: {
        baseURL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        ignoreHTTPSErrors: false,
    },
    projects: [
        // Setup: hace login una vez y guarda storageState (evita rate-limit).
        { name: "setup", testMatch: /calidad-auth\.setup\.ts$/ },
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"], storageState: "test-results/.auth/admin.json" },
            dependencies: ["setup"],
        },
    ],
});

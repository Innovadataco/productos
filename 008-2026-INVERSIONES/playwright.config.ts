/**
 * E2E de la pantalla (INV-SPEC-15), solo en local por ahora: `npm run test:e2e`.
 * El webServer siembra la base e2e (tests/e2e/sembrar.ts) y después levanta `next dev` en
 * 127.0.0.1:5008 contra esa base. Nunca reutiliza un servidor ya levantado: podría estar
 * conectado a la base real.
 */
import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
import { APP, URL_E2E_POR_DEFECTO, baseDePruebas } from "./tests/e2e/base";

const base = baseDePruebas(process.env.DATABASE_URL_E2E ?? URL_E2E_POR_DEFECTO);
// El secreto de la sesión se sortea UNA vez por corrida y viaja por el entorno: los procesos de las pruebas
// (que vuelven a leer este archivo) heredan el mismo y pueden firmar una pre-sesión vencida (totp.spec.ts).
const SECRETO_SESION = (process.env.E2E_AUTH_SECRET ??= randomBytes(32).toString("base64url"));
const origen = `http://${APP.host}:${APP.puerto}`;
const SALIDA = "node_modules/.cache/playwright";
const LIMPIAR_CACHE_DEV = `node -e "require('node:fs').rmSync('.next/dev', { recursive: true, force: true })"`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  outputDir: `${SALIDA}/resultados`,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: origen,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // El caché local trae Chromium completo; el headless-shell no está instalado.
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: {
    // Antes de `next dev` se borra su caché (.next/dev): una caché escrita con otro grafo de módulos deja
    // a Turbopack en un bucle de recargas («HMR hash mismatch») y la página nunca hidrata.
    command: `${LIMPIAR_CACHE_DEV} && node_modules/.bin/tsx tests/e2e/sembrar.ts && node_modules/.bin/next dev -H ${APP.host} -p ${APP.puerto}`,
    url: `${origen}/api/salud`,
    reuseExistingServer: false,
    timeout: 120_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
    stdout: "ignore",
    stderr: "pipe",
    // Secretos aleatorios por corrida (nunca reales): la sesión (D-014) y el cifrado (frente «cifrado»).
    env: {
      DATABASE_URL: base.url,
      NEXT_TELEMETRY_DISABLED: "1",
      AUTH_SECRET: SECRETO_SESION,
      CIFRADO_CLAVE_ACTIVA: "v1",
      CIFRADO_CLAVE_V1: randomBytes(32).toString("base64"),
    },
  },
});

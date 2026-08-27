/**
 * Setup project de Calidad · hace login como ADMIN una sola vez y guarda el
 * storageState para todos los recorridos de la campaña. Evita rate-limit al
 * pedir login por cada test.
 */
import { test as setup, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const STORAGE_DIR = "test-results/.auth";
export const ADMIN_STORAGE = join(STORAGE_DIR, "admin.json");

setup("login como admin (una vez, guarda storageState)", async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error("[Calidad] Falta E2E_ADMIN_EMAIL o E2E_ADMIN_PASSWORD en ~/.config/pi-e2e/.env.e2e.");
    }
    mkdirSync(STORAGE_DIR, { recursive: true });
    const resp = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(resp.ok(), `login admin API status=${resp.status()}`).toBeTruthy();
    await page.context().storageState({ path: ADMIN_STORAGE });
});

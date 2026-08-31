/**
 * A-62 §3.1 (SPEC-326 Fase A) + SPEC-330 · la pantalla de notificaciones del padre
 * funciona y muestra sus preferencias (R2-P22 parte 🧪: "funciona / no placeholder").
 * La calidad del lenguaje (👤) la cierra Jelkin. Aquí sólo: la página carga con la
 * sesión del padre (freemium ACTIVA) y no es un placeholder "próximamente".
 */
import { test, expect } from "@playwright/test";

test("A-62 · /dashboard/padre/notificaciones funciona y muestra preferencias (no placeholder)", async ({ browser }) => {
    const email = process.env.E2E_PADRE_EMAIL, password = process.env.E2E_PADRE_PASSWORD;
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const login = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(login.ok(), "padre debe loguear").toBeTruthy();

    const resp = await page.request.get("/dashboard/padre/notificaciones", { maxRedirects: 0 });
    console.log(`\n[A62] GET /dashboard/padre/notificaciones → ${resp.status()} · loc=${resp.headers()["location"] ?? "-"}`);
    expect(resp.status(), "la página no debe estar gateada").toBeLessThan(300);

    await page.goto("/dashboard/padre/notificaciones", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    const url = page.url().replace("https://pi.innovadataco.com", "");
    const txt = (await page.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ");
    const toggles = await page.locator("button[role='switch'], input[type='checkbox'], [role='switch']").count().catch(() => 0);
    const placeholder = /próximamente|proximamente|en construcción|no disponible/i.test(txt);
    console.log(`[A62] url=${url} · toggles=${toggles} · placeholder=${placeholder}`);
    console.log(`[A62] texto[0..220]=${txt.slice(0, 220)}`);
    await page.screenshot({ path: "test-results/a62-notificaciones-padre.png", fullPage: true }).catch(() => {});
    await ctx.close();

    console.log(`[A62] VEREDICTO 🧪 → funciona/no-placeholder=${!placeholder && toggles > 0} (lenguaje = 👤 Jelkin)`);
    expect(placeholder, "no debe ser placeholder 'próximamente'").toBeFalsy();
    expect(toggles, "debe mostrar al menos un control de preferencia").toBeGreaterThan(0);
});

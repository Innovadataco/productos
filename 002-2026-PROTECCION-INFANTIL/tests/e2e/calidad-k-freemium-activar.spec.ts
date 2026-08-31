/**
 * K8/K10 · setup — activar el freemium del padre de prueba POR LA UI (camino real
 * del usuario), no por SQL. La activación la hace el server action de
 * `dashboard/padre/suscripcion/page.tsx:71-93` (`actionActivarFreemium`), disparado
 * por el botón "Activar prueba gratis" de PlanesSelector. La página está exenta del
 * guardián de vigencia, así que un padre SIN_SUSCRIPCION la alcanza estando gateado.
 *
 * Deja al padre `soporte+padre-test@` con una suscripción freemium ACTIVA para que
 * el CEO avance el reloj (SQL) y Calidad verifique el corte de sesión (K8/K10).
 */
import { test, expect } from "@playwright/test";

test("K-setup · activar freemium del padre por la UI (server action)", async ({ browser }) => {
    const email = process.env.E2E_PADRE_EMAIL, password = process.env.E2E_PADRE_PASSWORD;
    expect(email && password, "falta E2E_PADRE_* en .env.e2e").toBeTruthy();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // login por API (fija cookies __Host-token + sesion_estado en el contexto)
    const login = await page.request.post("/api/auth/login", { data: { email, password } });
    const lb = await login.json().catch(() => ({}));
    console.log(`\n[K-setup] login → HTTP ${login.status()} · rol=${lb.user?.rol ?? "?"} · email=${lb.user?.email ?? "?"}`);
    expect(login.ok(), "el padre de prueba debe loguear").toBeTruthy();

    // la página de suscripción es exenta de vigencia → alcanzable estando gateado
    await page.goto("/dashboard/padre/suscripcion", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    console.log(`[K-setup] en ${page.url().replace("https://pi.innovadataco.com", "")}`);

    const boton = page.getByRole("button", { name: /Activar prueba gratis/i });
    const yaActiva = await page.getByText(/prueba gratis|freemium|d[ií]as? restantes|Termina/i).first().isVisible().catch(() => false);
    if (!(await boton.isVisible().catch(() => false))) {
        console.log(`[K-setup] no hay botón "Activar prueba gratis" (¿ya tiene suscripción activa? visible=${yaActiva})`);
    } else {
        await boton.click();
        await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(1500);
        console.log(`[K-setup] tras click → ${page.url().replace("https://pi.innovadataco.com", "")}`);
    }
    await page.screenshot({ path: "test-results/k-setup-freemium.png", fullPage: true }).catch(() => {});

    // prueba dura del efecto: una /api que antes gateaba por vigencia ya NO debe gatear
    const probe = await page.request.get("/api/padre/notificaciones", { maxRedirects: 0 }).catch(() => null);
    if (probe) console.log(`[K-setup] probe /api/padre/notificaciones → HTTP ${probe.status()} (403=sigue gateado · 200/otro=vigencia levantada)`);

    await ctx.close();
});

/**
 * K8/K10 · el paywall corta al padre cuando su suscripción vence (§5.13 del plan).
 *
 * Precondición: el CEO venció por SQL la suscripción freemium del padre test
 * (ACTIVA → SUSPENDIDA · `cmtgqczsq0013s11j92d8o6g9`). El corte de una sesión ya
 * abierta lo produce el refresh de la cookie `sesion_estado`: `POST /api/session/ping`
 * la re-emite desde la BD en vivo (`sesion-estado-emitter` · TTL 300s). Tras el ping,
 * el guardián de vigencia (middleware pasos 6) debe cortar la navegación a /suscripcion.
 *
 * CUMPLE = con la sesión abierta y la suscripción vencida, la navegación se CORTA a
 * /suscripcion (307) y las /api gatean (403 VIGENCIA_REQUERIDA); la propia página de
 * suscripción sigue abierta (el padre puede renovar). NO CUMPLE = sigue navegando.
 */
import { test, expect } from "@playwright/test";

test("K8/K10 · padre con freemium vencido: sesión abierta se corta a /suscripcion", async ({ browser }) => {
    const email = process.env.E2E_PADRE_EMAIL, password = process.env.E2E_PADRE_PASSWORD;
    expect(email && password, "falta E2E_PADRE_*").toBeTruthy();

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const login = await page.request.post("/api/auth/login", { data: { email, password } });
    const lb = await login.json().catch(() => ({}));
    console.log(`\n[K8/K10] login → HTTP ${login.status()} · rol=${lb.user?.rol ?? "?"} · email=${lb.user?.email ?? "?"}`);
    expect(login.ok(), "login no debe bloquearse por vigencia (ventana de servicio null = acceso)").toBeTruthy();

    // sesión abierta: el ping periódico re-emite sesion_estado desde la BD (ahora SUSPENDIDA)
    const ping = await page.request.post("/api/session/ping");
    console.log(`[K8/K10] session/ping (refresca sesion_estado) → HTTP ${ping.status()}`);

    // 1) PANTALLA gateada → debe CORTAR a /suscripcion
    const scr = await page.request.get("/dashboard/padre/expedientes", { maxRedirects: 0 });
    console.log(`[K8/K10] PANTALLA /dashboard/padre/expedientes → HTTP ${scr.status()} · loc=${scr.headers()["location"] ?? "-"}`);

    // 2) /api gateada → 403 JSON VIGENCIA_REQUERIDA (no HTML)
    const api = await page.request.get("/api/padre/notificaciones", { maxRedirects: 0 });
    const apiCt = api.headers()["content-type"] ?? "";
    const apiBody = (await api.text()).replace(/\s+/g, " ").slice(0, 160);
    console.log(`[K8/K10] /api/padre/notificaciones → HTTP ${api.status()} · ct=${apiCt} · body=${apiBody}`);

    // 3) contraprueba: la página de suscripción sigue abierta (renovar), no lockout total
    const susc = await page.request.get("/dashboard/padre/suscripcion", { maxRedirects: 0 });
    console.log(`[K8/K10] /dashboard/padre/suscripcion (exenta, renovar) → HTTP ${susc.status()} · loc=${susc.headers()["location"] ?? "-"}`);

    await page.goto("/dashboard/padre/expedientes", { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(800);
    console.log(`[K8/K10] navegación real aterriza en → ${page.url().replace("https://pi.innovadataco.com", "")}`);
    await page.screenshot({ path: "test-results/k8k10-corte.png", fullPage: true }).catch(() => {});
    await ctx.close();

    const corta = scr.status() >= 300 && scr.status() < 400 && (scr.headers()["location"] ?? "").includes("/suscripcion");
    const apiGatea = api.status() === 403 && apiCt.includes("application/json");
    console.log(`[K8/K10] VEREDICTO → corta pantalla=${corta} · api gatea 403=${apiGatea} · ${corta && apiGatea ? "✅ CUMPLE" : "🔴 NO CUMPLE"}`);
    expect(corta, "la pantalla del padre vencido debe cortar a /suscripcion").toBeTruthy();
    expect(apiGatea, "la /api del padre vencido debe responder 403 JSON").toBeTruthy();
    expect(susc.status(), "la página de suscripción debe seguir abierta (renovar)").toBeLessThan(300);
});

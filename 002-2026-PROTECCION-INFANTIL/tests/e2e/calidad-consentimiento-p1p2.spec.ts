/**
 * P1 + P2 del Recorrido #1 de Jelkin (consentimiento) · revisión D-021.
 *
 * P1: ¿el consentimiento bloquea la navegación, o se puede navegar sin aceptar?
 * P2 (pregunta abierta de Jelkin): ¿qué pasa si cierra la ventana en consentimiento?
 *     ¿se re-registra / pide otra contraseña, o el usuario ya está creado?
 *
 * Método: creo un colegio por panel admin (SCHOOL_ADMIN con passwordTemporal),
 * lo hago pasar por cambiar-password, y observo el comportamiento del guard de
 * consentimiento EN VIVO. SSH read-only para audit_consentimientos.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const GEO = { paisId: "cms2srl49003pr1n43qonerf0", ciudadId: "cms2srl7l007hr1n4g6nmf3su", departamentoId: "cms2srl52004jr1n4dsifj4ic" };
const SUF = String(Date.now()).slice(-6);
const EMAIL = `soporte+e2e-consent-${SUF}@innovadataco.com`;

test("P1/P2 · guard de consentimiento y persistencia del usuario", async ({ request, browser, playwright }) => {
    // 1) Sembrar colegio por panel admin → temp password (request = admin storageState)
    const iso = new Date().toISOString();
    const fin = new Date(Date.now() + 365 * 864e5).toISOString();
    const seed = await request.post("/api/admin/colegios", {
        data: {
            nombre: `Colegio Consent DIOS ${SUF}`, paisId: GEO.paisId, departamentoId: GEO.departamentoId, ciudadId: GEO.ciudadId,
            representanteLegalNombre: "Rep Consent", representanteLegalIdentificacion: `901${SUF}`, representanteLegalEmail: EMAIL,
            inicioServicio: iso, finServicio: fin, tipoPeriodo: "ANUAL", adminEmail: EMAIL, adminNombre: "Rector Consent DIOS",
        },
    });
    expect(seed.status(), `seed status=${seed.status()} ${await seed.text()}`).toBe(201);
    const tempPw = (await seed.json()).passwordTemporal as string;

    // 2) login como el colegio (contexto UI limpio) → observar a dónde lo manda
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    // login por API para fijar cookie, luego navegar
    const login = await page.request.post("/api/auth/login", { data: { email: EMAIL, password: tempPw } });
    expect(login.ok(), `login status=${login.status()}`).toBeTruthy();

    // 3) el usuario tiene debeCambiarPassword (temp) → cambiarlo por el flujo real
    const nuevaPw = `${tempPw}Z9!`;
    const cambio = await page.request.post("/api/auth/cambiar-password", {
        data: { passwordActual: tempPw, passwordNueva: nuevaPw, passwordNuevaConfirmacion: nuevaPw },
    }).catch(() => null);
    console.log(`\n[P1P2] cambiar-password status=${cambio?.status() ?? "n/a"}`);

    // 4) SIN aceptar consentimiento, intentar entrar al panel del colegio
    await page.goto("/dashboard/colegio", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2_500);
    const url1 = page.url().replace("https://pi.innovadataco.com", "");
    const texto1 = await page.locator("main, body").first().innerText().catch(() => "");
    const enConsentimiento = url1.includes("/consentimiento") || /consentimiento|firmo y acepto/i.test(texto1);
    const entroAlPanel = url1.startsWith("/dashboard/colegio");
    console.log(`[P1] sin aceptar consentimiento, /dashboard/colegio → url=${url1}`);
    console.log(`[P1] ¿lo forzó a consentimiento?=${enConsentimiento} · ¿lo dejó entrar al panel?=${entroAlPanel}`);
    await page.screenshot({ path: `test-results/p1-sin-consentir.png`, fullPage: true }).catch(() => {});

    // 5) P2: "cerrar la ventana" → nuevo contexto (cookies perdidas), re-login con MISMA clave
    await ctx.close();
    const ctx2: APIRequestContext = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const relogin = await ctx2.post("/api/auth/login", { data: { email: EMAIL, password: nuevaPw } });
    console.log(`[P2] tras "cerrar ventana", re-login con la MISMA clave → status=${relogin.status()} (ok=${relogin.ok()})`);
    console.log(`[P2] → el usuario NO se re-registra ni necesita clave nueva: ${relogin.ok()}`);
    await ctx2.dispose();

    // No hay assert duro sobre P1 (es diagnóstico del comportamiento); P2 sí: re-login funciona.
    expect(relogin.ok(), "P2: el usuario ya existe; re-login con la misma clave debe funcionar").toBeTruthy();
    console.log(`[INFO] email sembrado para verificar audit_consentimientos por SSH: ${EMAIL}`);
});

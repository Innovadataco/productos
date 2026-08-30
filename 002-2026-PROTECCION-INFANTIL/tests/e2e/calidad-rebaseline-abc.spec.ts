/**
 * Re-baseline de Calidad · Recorridos A/B/C contra prod (D-021).
 *
 * Contexto: el rescate de pagos (A-22 · SPEC-254..260) y el ciclo operador-spam
 * (A-21 · SPEC-261..264) están confirmados en prod (commit ce03c2bd, verificado
 * por el CEO con git merge-base). Este spec RE-VERIFICA los pasos que el
 * PLAN-PRUEBAS-INTEGRAL marcaba ❌/🚫 al corte 27-ago, para separar
 * "destrabado por deploy" de "roto de verdad".
 *
 * Regla de Calidad respetada: NO se ejecuta ninguna escritura en prod. Las
 * pantallas de crear/editar plan (B1/B2) se verifican solo a nivel de RENDER del
 * formulario — el submit real es criterio (e) de Jelkin. Todo lo demás es lectura.
 *
 * Estrategia (igual que recorrido-g): domcontentloaded + espera corta, sin
 * networkidle (la app tiene long-polling). Cada paso captura evidencia y detecta
 * el patrón de error documentado en su incidencia.
 */
import { test, expect, type Page } from "@playwright/test";

// Patrones que delatan una pantalla ROTA (error boundary / 500 / overlay Next).
const PATRONES_ROTO = [
    "Application error",
    "Something went wrong",
    "Se produjo un error",
    "Ha ocurrido un error",
    "Internal Server Error",
    "client-side exception",
    "Unhandled Runtime Error",
];

async function diagnosticar(page: Page, id: string, ruta: string, opts?: { esperaMs?: number }) {
    const resp = await page.goto(ruta, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(opts?.esperaMs ?? 2_500);
    const status = resp?.status() ?? 0;

    const texto = await page.locator("main, body").first().innerText().catch(() => "");
    const roto = PATRONES_ROTO.find((p) => texto.includes(p));
    const enLogin = page.url().includes("/login");
    const tieneMain = (await page.locator("main").count()) > 0;
    const primeras = texto.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 10).join(" · ");

    await page.screenshot({ path: `test-results/rebaseline-${id}.png`, fullPage: true }).catch(() => {});

    console.log(`\n[${id}] ${ruta} → ${page.url()}`);
    console.log(`        HTTP ${status} · main=${tieneMain} · login=${enLogin} · roto=${roto ?? "no"}`);
    console.log(`        visible: ${primeras.slice(0, 420)}`);

    return { status, roto, enLogin, tieneMain, texto };
}

// ───────────────────────────────────────────────────────────────────────────
// RECORRIDO B · El CEO administra los cobros (admin storageState del setup)
// ───────────────────────────────────────────────────────────────────────────
test.describe("Re-baseline B · Cobros (admin)", () => {
    test("B3 · ver quién NO tiene suscripción (I-127)", async ({ page }) => {
        const r = await diagnosticar(page, "B3", "/dashboard/admin/pagos/sin-suscripcion");
        expect(r.enLogin, "B3 no debe rebotar a /login").toBeFalsy();
        expect(r.roto, `B3 pantalla rota: ${r.roto}`).toBeUndefined();
        expect(r.status, "B3 debe responder <400").toBeLessThan(400);
    });

    test("B4 · pagos pendientes de autorizar (I-127)", async ({ page }) => {
        const r = await diagnosticar(page, "B4", "/dashboard/admin/pagos/pendientes");
        expect(r.enLogin).toBeFalsy();
        expect(r.roto, `B4 pantalla rota: ${r.roto}`).toBeUndefined();
        expect(r.status).toBeLessThan(400);
    });

    test("B5 · administrar bonos (I-125 · la página se caía)", async ({ page }) => {
        const r = await diagnosticar(page, "B5", "/dashboard/admin/pagos/bonos");
        expect(r.enLogin).toBeFalsy();
        expect(r.roto, `B5 pantalla rota: ${r.roto}`).toBeUndefined();
        expect(r.status).toBeLessThan(400);
    });

    test("B1/B2 · planes: la pantalla carga y ofrece crear/editar (I-126) [solo render, sin submit]", async ({ page }) => {
        const r = await diagnosticar(page, "B1B2", "/dashboard/admin/pagos/planes");
        expect(r.enLogin).toBeFalsy();
        expect(r.roto, `B1/B2 pantalla rota: ${r.roto}`).toBeUndefined();
        expect(r.status).toBeLessThan(400);
        // Render del control de creación/edición (no lo activamos — write = Jelkin).
        const control = page.getByRole("button", { name: /crear|nuevo|agregar|editar/i });
        const hayControl = (await control.count()) > 0;
        console.log(`        [B1B2] control crear/editar presente: ${hayControl}`);
    });

    test("B6 · mora y vencimientos (⏳ nunca probado)", async ({ page }) => {
        const mora = await diagnosticar(page, "B6-mora", "/dashboard/admin/pagos/mora");
        const venc = await diagnosticar(page, "B6-venc", "/dashboard/admin/pagos/vencimientos");
        expect(mora.roto, `B6 mora rota: ${mora.roto}`).toBeUndefined();
        expect(venc.roto, `B6 vencimientos rota: ${venc.roto}`).toBeUndefined();
    });
});

// ───────────────────────────────────────────────────────────────────────────
// RECORRIDO C · Un reporte recorre el ciclo (operador · login inline)
// ───────────────────────────────────────────────────────────────────────────
test.describe("Re-baseline C · Ciclo del reporte (operador)", () => {
    test("C7/C8/C9/C11 · bandeja del operador y detalle de caso", async ({ browser }) => {
        const email = process.env.E2E_OPERADOR_EMAIL;
        const password = process.env.E2E_OPERADOR_PASSWORD;
        expect(email && password, "Falta E2E_OPERADOR_* en .env.e2e").toBeTruthy();

        // Contexto limpio + login como operador (no reusa el storageState admin).
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const login = await page.request.post("/api/auth/login", { data: { email, password } });
        expect(login.ok(), `login operador status=${login.status()}`).toBeTruthy();

        // C7 · bandeja del operador carga (la "Bandeja de reportes" vive en /dashboard/admin, nav-items.ts:15)
        const bandeja = await diagnosticar(page, "C7-bandeja", "/dashboard/admin");
        expect(bandeja.enLogin, "C7 operador no debe quedar en /login").toBeFalsy();
        expect(bandeja.roto, `C7 bandeja rota: ${bandeja.roto}`).toBeUndefined();

        // Intentar abrir un caso desde la bandeja (si hay alguno).
        const enlaceCaso = page.getByRole("link", { name: /RPT-|caso|reporte/i }).first();
        const hayCaso = (await enlaceCaso.count()) > 0;
        console.log(`        [C] ¿hay al menos un caso en la bandeja del operador?: ${hayCaso}`);

        if (hayCaso) {
            await enlaceCaso.click().catch(() => {});
            await page.waitForTimeout(2_500);
            const texto = await page.locator("main, body").first().innerText().catch(() => "");
            // C8 · confianza no es 0.0% (I-113 / SPEC-301 NaN%)
            const confianzaCero = /0[.,]0\s*%/.test(texto) || /NaN/.test(texto);
            // C9 · se ve el texto original del reporte
            const veTextoOriginal = /texto|mensaje|contenido|descripci/i.test(texto);
            // C11 · botón escalar al comité presente
            const botonEscalar = (await page.getByRole("button", { name: /escalar|comit/i }).count()) > 0;
            await page.screenshot({ path: "test-results/rebaseline-C-detalle.png", fullPage: true }).catch(() => {});
            console.log(`        [C8] confianza 0.0%/NaN presente (defecto): ${confianzaCero}`);
            console.log(`        [C9] muestra texto/contenido del reporte: ${veTextoOriginal}`);
            console.log(`        [C11] botón escalar al comité presente: ${botonEscalar}`);
        } else {
            console.log("        [C] bandeja vacía → C8/C9/C11 NO verificables sin un caso sembrado (Jelkin/data).");
        }

        await ctx.close();
    });
});

/**
 * I-222 · REGRESIÓN de A-56 — verificación EN VIVO del fix SPEC-329 (002-PI-229).
 *
 * Defecto: los guardianes 4/5/6 del middleware (consentimiento, debeCambiarPassword,
 * vigencia) hacían `redirect()` 302 SIN distinguir rutas `/api`, igual que hacen
 * bien las pantallas. Un `fetch` a una API gateada seguía el 302 y recibía 200+HTML
 * → el cliente no distinguía éxito de bloqueo. Prod `b654f683` lo tenía vivo.
 *
 * Fix esperado (prod `ac61ecd2`): para `/api/**` los tres guardianes responden
 * **JSON con status 4xx** (403 con code+redirectTo · 401 el de sesión); para las
 * PANTALLAS el `redirect()` 302 se mantiene intacto. La contraprueba de que las
 * pantallas siguen redirigiendo es tan importante como el 403 de la API: si un
 * guardián dejara de redirigir una pantalla, es PEOR que el defecto original.
 *
 * LIMB A · el caso exacto del CEO: padre gateado → activar-freemium debe ser JSON.
 * LIMB B · colegio recién sembrado (gate de consentimiento/password) → prueba el
 *          MISMO código del middleware sin depender del roster E2E del padre:
 *          /api → JSON 4xx · pantalla → 302.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL;
const GEO = { paisId: "cms2srl49003pr1n43qonerf0", ciudadId: "cms2srl7l007hr1n4g6nmf3su", departamentoId: "cms2srl52004jr1n4dsifj4ic" };
const SUF = String(Date.now()).slice(-6);

const isHtml = (ct?: string | null) => (ct ?? "").includes("text/html");
const is3xx = (s: number) => s >= 300 && s < 400;

test.describe.serial("I-222 · guardianes /api = JSON, pantallas = 302 (SPEC-329)", () => {

    test("A · padre E2E: /api/padre/suscripcion/activar-freemium NO redirige a HTML", async ({ playwright }) => {
        const email = process.env.E2E_PADRE_EMAIL, password = process.env.E2E_PADRE_PASSWORD;
        const ctx: APIRequestContext = await playwright.request.newContext({ baseURL: BASE });
        const login = await ctx.post("/api/auth/login", { data: { email, password } });
        const lb = await login.json().catch(() => ({}));
        console.log(`\n[I222-A] login E2E_PADRE → HTTP ${login.status()} · rol=${lb.user?.rol ?? "?"} · email=${lb.user?.email ?? "?"}`);
        test.skip(!login.ok(), "E2E_PADRE no loguea (roster driftó) — el fix se prueba igual en LIMB B con colegio sembrado");

        const post = await ctx.post("/api/padre/suscripcion/activar-freemium", { data: { aceptaTerminos: true }, maxRedirects: 0 });
        const ct = post.headers()["content-type"] ?? null;
        const body = (await post.text()).replace(/\s+/g, " ").slice(0, 200);
        console.log(`[I222-A] activar-freemium → HTTP ${post.status()} · ct=${ct} · loc=${post.headers()["location"] ?? "-"}`);
        console.log(`[I222-A] body[0..200]=${body}`);

        // Contraprueba: la MISMA sesión contra una PANTALLA gateada debe seguir redirigiendo (302).
        const scr = await ctx.get("/dashboard/padre/expedientes", { maxRedirects: 0 });
        console.log(`[I222-A] PANTALLA /dashboard/padre/expedientes → HTTP ${scr.status()} · loc=${scr.headers()["location"] ?? "-"}`);
        await ctx.dispose();

        // I-222 vivo = la /api devuelve 302/HTML. Fix = NO 3xx y NO HTML (403 gateado, o 201 si no hay gate).
        expect(is3xx(post.status()), "una /api NO debe redirigir (302)").toBeFalsy();
        expect(isHtml(ct), "una /api NO debe devolver HTML").toBeFalsy();
    });

    test("B · colegio sembrado (gate) → /api = JSON 4xx · pantalla = 302", async ({ playwright }) => {
        // 1) admin siembra un colegio nuevo (temp password + consentimiento pendiente → gateado)
        const rc: APIRequestContext = await playwright.request.newContext({ baseURL: BASE });
        const al = await rc.post("/api/auth/login", { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
        expect(al.ok(), `admin login ${al.status()}`).toBeTruthy();
        const iso = new Date().toISOString(), fin = new Date(Date.now() + 365 * 864e5).toISOString();
        const email = `soporte+e2e-i222-${SUF}@innovadataco.com`;
        const seed = await rc.post("/api/admin/colegios", {
            data: {
                nombre: `Colegio I222 ${SUF}`, paisId: GEO.paisId, departamentoId: GEO.departamentoId, ciudadId: GEO.ciudadId,
                representanteLegalNombre: "Rep I222", representanteLegalIdentificacion: `93${SUF}`, representanteLegalEmail: email,
                inicioServicio: iso, finServicio: fin, tipoPeriodo: "ANUAL", adminEmail: email, adminNombre: "Rector I222",
            },
        });
        expect(seed.status(), await seed.text()).toBe(201);
        const tempPw = (await seed.json()).passwordTemporal;
        console.log(`\n[I222-B] colegio sembrado ${email} · temp pw len ${tempPw.length}`);
        await rc.dispose();

        // 2) login como el colegio → queda gateado (consentimiento/password) por el middleware
        const cc: APIRequestContext = await playwright.request.newContext({ baseURL: BASE });
        const cl = await cc.post("/api/auth/login", { data: { email, password: tempPw } });
        expect(cl.ok(), `colegio login ${cl.status()}`).toBeTruthy();

        // 3) una /api NO exenta con la sesión gateada → debe ser JSON 4xx, jamás 302+HTML
        const api = await cc.post("/api/colegio/profesores", { data: {}, maxRedirects: 0 });
        const apiCt = api.headers()["content-type"] ?? null;
        const apiBody = (await api.text()).replace(/\s+/g, " ").slice(0, 200);
        console.log(`[I222-B] /api/colegio/profesores (gateada) → HTTP ${api.status()} · ct=${apiCt} · loc=${api.headers()["location"] ?? "-"}`);
        console.log(`[I222-B] api body[0..200]=${apiBody}`);

        // 4) contraprueba: la PANTALLA equivalente con la misma sesión → 302 (redirect intacto)
        const scr = await cc.get("/dashboard/colegio/profesores", { maxRedirects: 0 });
        console.log(`[I222-B] PANTALLA /dashboard/colegio/profesores → HTTP ${scr.status()} · loc=${scr.headers()["location"] ?? "-"}`);
        await cc.dispose();

        const apiOk = !is3xx(api.status()) && !isHtml(apiCt) && api.status() >= 400 && api.status() < 500;
        const scrOk = is3xx(scr.status());
        console.log(`[I222-B] VEREDICTO → /api JSON 4xx=${apiOk} · pantalla 302=${scrOk} · ${apiOk && scrOk ? "✅ I-222 CERRADA" : "🔴 REVISAR"}`);
        expect(is3xx(api.status()), "la /api gateada NO debe redirigir (302)").toBeFalsy();
        expect(isHtml(apiCt), "la /api gateada NO debe devolver HTML").toBeFalsy();
        expect(scrOk, "la PANTALLA gateada SÍ debe redirigir (302)").toBeTruthy();
    });
});

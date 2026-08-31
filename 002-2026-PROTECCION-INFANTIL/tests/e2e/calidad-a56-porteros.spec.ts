/**
 * A-56 · verificación EN VIVO de los tres porteros (SPEC-318, PR #180).
 *
 * Prueba el MIDDLEWARE directamente: API-login (fija cookies __Host-token +
 * sesion_estado en el contexto) y luego navega con `page.goto`, observando los
 * redirects del middleware. Esto esquiva el form de login y prueba justo lo que
 * A-56 cambia (la emisión de la cookie de estado).
 *
 * Antes de A-56 (prod 1af45a26): la cookie sesion_estado NO se emite → gates
 * muertos → todo "NO CUMPLE" (esperado). Después de A-56: gates vivos → CUMPLE.
 *
 * Prioridad del CEO: (1) el BUCLE tras firmar · (2) el rebote sin firmar ·
 * (3) fila en audit_consentimientos · (4) extra debeCambiarPassword esquivable.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const GEO = { paisId: "cms2srl49003pr1n43qonerf0", ciudadId: "cms2srl7l007hr1n4g6nmf3su", departamentoId: "cms2srl52004jr1n4dsifj4ic" };
const SUF = String(Date.now()).slice(-6);
const EMAIL = `soporte+e2e-a56-${SUF}@innovadataco.com`;
let tempPw = "";

function u(page: { url(): string }) { return page.url().replace("https://pi.innovadataco.com", ""); }

test.describe.serial("A-56 · tres porteros (SPEC-318)", () => {
    test("seed · colegio nuevo (debeCambiarPassword + requiereConsentimiento)", async ({ request }) => {
        const iso = new Date().toISOString(), fin = new Date(Date.now() + 365 * 864e5).toISOString();
        const r = await request.post("/api/admin/colegios", {
            data: { nombre: `Colegio A56 DIOS ${SUF}`, paisId: GEO.paisId, departamentoId: GEO.departamentoId, ciudadId: GEO.ciudadId,
                representanteLegalNombre: "Rep A56", representanteLegalIdentificacion: `95${SUF}`, representanteLegalEmail: EMAIL,
                inicioServicio: iso, finServicio: fin, tipoPeriodo: "ANUAL", adminEmail: EMAIL, adminNombre: "Rector A56" },
        });
        expect(r.status(), await r.text()).toBe(201);
        tempPw = (await r.json()).passwordTemporal;
        console.log(`\n[A56-seed] colegio ${EMAIL} · temp pw len ${tempPw.length}`);
    });

    test("PORTERO 4 (extra) · debeCambiarPassword NO esquivable por URL", async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        const login = await page.request.post("/api/auth/login", { data: { email: EMAIL, password: tempPw } });
        expect(login.ok(), `login ${login.status()}`).toBeTruthy();
        await page.goto("/dashboard/colegio", { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(1500);
        const dest = u(page);
        const cumple = dest.includes("/cambiar-password");
        console.log(`[PORTERO-4] con clave temporal, URL directa a /dashboard/colegio → ${dest} · ${cumple ? "CUMPLE (rebota a cambiar-password)" : "NO CUMPLE (entró/esquivó)"}`);
        await ctx.close();
    });

    test("PORTERO 2 · rebote a consentimiento sin firmar", async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.request.post("/api/auth/login", { data: { email: EMAIL, password: tempPw } });
        // pasar el portero de password (cambiarla) para aislar el de consentimiento
        const pw2 = `${tempPw}Z9!`;
        await page.request.post("/api/auth/cambiar-password", { data: { passwordActual: tempPw, passwordNueva: pw2, passwordNuevaConfirmacion: pw2 } }).catch(() => {});
        tempPw = pw2;
        await page.goto("/dashboard/colegio/profesores", { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(1500);
        const dest = u(page);
        const cumple = dest.includes("/consentimiento");
        console.log(`[PORTERO-2] sin firmar, URL directa a /profesores → ${dest} · ${cumple ? "CUMPLE (rebota a consentimiento)" : "NO CUMPLE (entró sin firmar)"}`);
        await ctx.close();
    });

    test("PORTERO 1 · tras firmar NO hay bucle (recarga ×3 + navegar)", async ({ browser }) => {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.request.post("/api/auth/login", { data: { email: EMAIL, password: tempPw } });
        // firmar consentimiento (colegio = CONVENIO_INSTITUCIONAL)
        const aceptar = await page.request.post("/api/consentimiento/aceptar", { data: { documentoTipo: "CONVENIO_INSTITUCIONAL", esRepresentanteLegal: true } });
        console.log(`[PORTERO-1] aceptar consentimiento → ${aceptar.status()}`);

        let loop = false, destinos: string[] = [];
        for (let i = 0; i < 3; i++) {
            const resp = await page.goto("/dashboard/colegio", { waitUntil: "domcontentloaded" }).catch((e: Error) => {
                if (/ERR_TOO_MANY_REDIRECTS|redirect/i.test(e.message)) loop = true;
                return null;
            });
            await page.waitForTimeout(800);
            destinos.push(u(page));
            void resp;
            await page.goto("/dashboard/colegio/profesores", { waitUntil: "domcontentloaded" }).catch((e: Error) => {
                if (/ERR_TOO_MANY_REDIRECTS|redirect/i.test(e.message)) loop = true;
            });
            await page.waitForTimeout(500);
            destinos.push(u(page));
        }
        const volvioAConsent = destinos.some((d) => d.includes("/consentimiento"));
        const cumple = !loop && !volvioAConsent;
        console.log(`[PORTERO-1] destinos tras firmar+recargar: ${destinos.join(" → ")}`);
        console.log(`[PORTERO-1] bucle=${loop} · volvió a consentimiento=${volvioAConsent} · ${cumple ? "CUMPLE (sin bucle)" : "🔴 NO CUMPLE — AVISAR AL CEO YA"}`);
        await page.screenshot({ path: "test-results/a56-portero1-loop.png", fullPage: true }).catch(() => {});
        await ctx.close();
    });
});

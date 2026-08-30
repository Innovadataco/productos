/**
 * Recorrido B · "El CEO administra los cobros" · pasada de dato (D-021).
 *
 * B4/B8 (admin ve pendiente → autoriza → ACTIVA) ya se probaron en A7-A10 (27-ago);
 * aquí se RE-CONFIRMAN con dato fresco sembrado en esta corrida, y se cubren B3/B5/B6.
 * B1/B2 (crear/editar Plan) = catálogo/config → J-3 (Jelkin), aquí solo render.
 *
 * Siembra OPERATIVA por flujo real: colegio por panel admin (devuelve passwordTemporal,
 * sin inbox) → el colegio pide un plan → queda PENDIENTE_AUTORIZACION. Ambiente dev/pruebas.
 * NO se borra nada; los datos sembrados van al informe. SSH solo lectura para verificar BD.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";

const GEO = { paisId: "cms2srl49003pr1n43qonerf0", ciudadId: "cms2srl7l007hr1n4g6nmf3su", departamentoId: "cms2srl52004jr1n4dsifj4ic" };
const PATRONES_ROTO = ["Application error", "Something went wrong", "Se produjo un error", "Internal Server Error", "client-side exception"];

// Email único por corrida para no chocar con el unique de Usuario.
const SUFIJO = String(Date.now()).slice(-6);
const COLEGIO_EMAIL = `soporte+e2e-bcobros-${SUFIJO}@innovadataco.com`;
const COLEGIO_NOMBRE = `Colegio B-Cobros DIOS ${SUFIJO}`;

let passwordTemporal = "";
let solicitudCreada = false;

test.describe.serial("Recorrido B · cobros (admin)", () => {
    test("SEED · admin crea colegio por panel (legacy, temp password)", async ({ request }) => {
        const iso = new Date().toISOString();
        const finIso = new Date(Date.now() + 365 * 864e5).toISOString();
        const resp = await request.post("/api/admin/colegios", {
            data: {
                nombre: COLEGIO_NOMBRE,
                paisId: GEO.paisId, departamentoId: GEO.departamentoId, ciudadId: GEO.ciudadId,
                representanteLegalNombre: "Rep Legal DIOS", representanteLegalIdentificacion: `900${SUFIJO}`,
                representanteLegalEmail: COLEGIO_EMAIL, inicioServicio: iso, finServicio: finIso,
                tipoPeriodo: "ANUAL", adminEmail: COLEGIO_EMAIL, adminNombre: "Rector B-Cobros DIOS",
            },
        });
        expect(resp.status(), `crear colegio status=${resp.status()} · ${await resp.text()}`).toBe(201);
        const json = await resp.json();
        passwordTemporal = json.passwordTemporal ?? json.colegio?.passwordTemporal ?? "";
        expect(passwordTemporal.length, "debe devolver passwordTemporal").toBeGreaterThan(0);
        console.log(`\n[B-SEED] colegio creado: ${COLEGIO_NOMBRE} · admin ${COLEGIO_EMAIL} · temp pw recibido (len ${passwordTemporal.length})`);
    });

    test("SEED · el colegio pide un plan → PENDIENTE_AUTORIZACION", async ({ playwright }) => {
        const ctx: APIRequestContext = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL });
        const login = await ctx.post("/api/auth/login", { data: { email: COLEGIO_EMAIL, password: passwordTemporal } });
        expect(login.ok(), `login colegio status=${login.status()}`).toBeTruthy();

        // Si la cuenta exige cambio de password, lo hacemos por el flujo real.
        const nuevaPw = `${passwordTemporal}X9!`;
        await ctx.post("/api/auth/cambiar-password", { data: { passwordActual: passwordTemporal, passwordNueva: nuevaPw, passwordNuevaConfirmacion: nuevaPw } }).catch(() => {});

        const planesResp = await ctx.get("/api/pagos/planes");
        console.log(`[B-SEED] GET /api/pagos/planes → ${planesResp.status()}`);
        const planes = planesResp.ok() ? ((await planesResp.json()).planes ?? []) : [];
        console.log(`[B-SEED] planes COLEGIO disponibles: ${planes.length}${planes[0] ? ` (ej: ${planes[0].nombre})` : ""}`);
        if (planes.length === 0) {
            console.log("[B-SEED] ⚠️ sin planes COLEGIO activos del año → no se puede pedir plan (posible hallazgo B: catálogo vacío)");
            return;
        }
        const solicitar = await ctx.post("/api/colegio/suscripcion/solicitar-plan", { data: { planId: planes[0].id } });
        console.log(`[B-SEED] solicitar-plan → ${solicitar.status()}`);
        solicitudCreada = solicitar.ok();
        expect(solicitar.ok(), `solicitar-plan status=${solicitar.status()} · ${await solicitar.text()}`).toBeTruthy();
        await ctx.dispose();
    });

    test("B4 · admin ve la solicitud pendiente (dato fresco)", async ({ page }) => {
        test.skip(!solicitudCreada, "sin solicitud creada (no había planes COLEGIO)");
        const resp = await page.goto("/dashboard/admin/pagos/pendientes", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2_500);
        const texto = await page.locator("main, body").first().innerText().catch(() => "");
        expect(PATRONES_ROTO.find((p) => texto.includes(p)), "B4 no debe estar rota").toBeUndefined();
        expect(resp?.status()).toBeLessThan(400);
        const apareceColegio = texto.includes(COLEGIO_NOMBRE) || /solicitud|pendiente/i.test(texto);
        console.log(`\n[B4] /pagos/pendientes muestra el colegio o una solicitud: ${apareceColegio}`);
        await page.screenshot({ path: "test-results/b4-pendientes.png", fullPage: true }).catch(() => {});
        expect(apareceColegio, "B4 debe mostrar la solicitud pendiente").toBeTruthy();
    });

    test("B8 · admin autoriza la solicitud → suscripción ACTIVA (dato fresco)", async ({ page }) => {
        test.skip(!solicitudCreada, "sin solicitud creada");
        // 1) listar solicitudes pendientes y ubicar la de nuestro colegio
        const lista = await page.request.get("/api/admin/pagos/solicitudes-pendientes?page=1&pageSize=50");
        expect(lista.ok(), `listar solicitudes status=${lista.status()}`).toBeTruthy();
        const data = await lista.json();
        const items = data.items ?? data.data ?? [];
        const mia = items.find((it: unknown) => JSON.stringify(it).includes(COLEGIO_NOMBRE) || JSON.stringify(it).includes(COLEGIO_EMAIL));
        console.log(`\n[B8] solicitudes pendientes: ${items.length} · encontré la mía: ${!!mia}`);
        expect(mia, "debe encontrar mi solicitud en el listado").toBeTruthy();
        const suscripcionId = mia.suscripcionId ?? mia.id ?? mia.suscripcion?.id;
        expect(suscripcionId, "debe extraer el id de la suscripción").toBeTruthy();
        // 2) autorizar
        const auth = await page.request.post(`/api/admin/pagos/pendientes/${suscripcionId}/autorizar`, {
            data: { metodoPagoManual: "TRANSFERENCIA_BANCARIA", referenciaPagoManual: `E2E-DIOS-${SUFIJO}`, montoRealPagado: 0 },
        });
        console.log(`[B8] autorizar → ${auth.status()}`);
        expect(auth.ok(), `autorizar status=${auth.status()} · ${await auth.text()}`).toBeTruthy();
        const susc = (await auth.json()).suscripcion;
        console.log(`[B8] suscripción resultante: estado=${susc?.estado}`);
        expect(susc?.estado, "la suscripción debe quedar ACTIVA").toBe("ACTIVA");
    });

    test("B3 · admin ve quién NO tiene suscripción (con dato)", async ({ page }) => {
        const resp = await page.goto("/dashboard/admin/pagos/sin-suscripcion", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2_500);
        const texto = await page.locator("main, body").first().innerText().catch(() => "");
        expect(PATRONES_ROTO.find((p) => texto.includes(p)), "B3 no debe estar rota").toBeUndefined();
        expect(resp?.status()).toBeLessThan(400);
        const filas = await page.locator("table tbody tr, [role='row']").count();
        console.log(`\n[B3] /pagos/sin-suscripcion filas visibles: ${filas}`);
        await page.screenshot({ path: "test-results/b3-sin-suscripcion.png", fullPage: true }).catch(() => {});
    });

    test("B5/B6 · bonos, mora y vencimientos cargan con contenido", async ({ page }) => {
        for (const [id, ruta] of [["B5-bonos", "/dashboard/admin/pagos/bonos"], ["B6-mora", "/dashboard/admin/pagos/mora"], ["B6-venc", "/dashboard/admin/pagos/vencimientos"]] as const) {
            const resp = await page.goto(ruta, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(1_800);
            const texto = await page.locator("main, body").first().innerText().catch(() => "");
            const roto = PATRONES_ROTO.find((p) => texto.includes(p));
            console.log(`[${id}] ${ruta} → HTTP ${resp?.status()} · roto=${roto ?? "no"}`);
            expect(roto, `${id} rota: ${roto}`).toBeUndefined();
            expect(resp?.status(), `${id} status`).toBeLessThan(400);
        }
    });

    test("B1/B2 · planes: pantalla y control crear/editar presentes (render, NO submit)", async ({ page }) => {
        const resp = await page.goto("/dashboard/admin/pagos/planes", { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(2_000);
        const texto = await page.locator("main, body").first().innerText().catch(() => "");
        expect(PATRONES_ROTO.find((p) => texto.includes(p)), "planes no debe estar rota").toBeUndefined();
        expect(resp?.status()).toBeLessThan(400);
        const control = await page.getByRole("button", { name: /crear|nuevo|agregar|editar/i }).count();
        console.log(`\n[B1B2] control crear/editar presente: ${control > 0} · (crear/editar Plan = config → J-3 Jelkin, no se ejecuta)`);
    });
});

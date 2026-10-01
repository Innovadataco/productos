/**
 * SPEC-785 (recorrido de cobertura, Calidad) · El titular VE quién leyó su expediente.
 *
 * EL HUECO #4 de la auditoría. `GET /api/padre/expedientes/[id]/accesos` (SPEC-610/I-372/D-129) le muestra
 * al padre «quién ha leído este expediente»: los pases que un profesional CANJEÓ para abrirlo — quién,
 * cuándo, rol y CUÁNTOS eventos leyó. SOLO metadatos: esta vía NUNCA descifra ni devuelve contenido. El
 * endpoint existe y ningún e2e lo caminaba. Es superficie del padre, adyacente a habeas-data: el titular
 * tiene derecho a ver quién accedió a sus datos.
 *
 * QUÉ AFIRMA (camino REAL — A solicita el pase, el profesional lo canjea y lee; nada sembrado a mano):
 *   (1) El titular VE la fila: quién (el nombre del profesional que canjeó), rol, y el CONTEO EXACTO de
 *       eventos leídos (no ≥1: un off-by-one le miente al titular sobre cuánto vieron de lo suyo).
 *   (2) 🔒 AISLAMIENTO: otro padre pide `…/expedientes/<id-de-A>/accesos` → 404 (no 403, que confirmaría
 *       existencia). `obtenerExpedientePorId` scopa por titular y devuelve null si no es suyo.
 *   (3) NO-FUGA de CONTENIDO: la respuesta trae SOLO los campos de metadato — ningún texto del expediente,
 *       con el relato REAL plantado detrás y verificado ausente.
 *
 * Se LEE, no se toca, el repositorio de pases ni el de expedientes. El canje del pase ya se ejerce por su
 * camino real; acá importa la vista de accesos y su aislamiento por titular.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-785-`. Limpieza best-effort en afterAll.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext, type APIResponse } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";

const CORRIDA = `e2e-785-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Accesos785!Secure";
const PADRE_A_EMAIL = `${CORRIDA}-padreA@proteccion.local`;
const PADRE_B_EMAIL = `${CORRIDA}-padreB@proteccion.local`;
const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const TEXTO_SECRETO = `CONTENIDO SECRETO del relato 785 (${CORRIDA}) — jamás debe salir en la vista de accesos.`;

let padreA: PadreOnboarded | undefined;
let padreB: PadreOnboarded | undefined;
let profesional: ProfesionalVisible | undefined;
let expedienteId = "";
let reporteId = "";
let profesionalNombre = "";

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function accesosDe(request: APIRequestContext): Promise<APIResponse> {
    return request.get(`/api/padre/expedientes/${expedienteId}/accesos`);
}

test.describe.serial("SPEC-785 · el titular ve quién leyó su expediente (aislamiento por titular + conteo exacto)", () => {
    test.beforeAll(async () => {
        const reqA = await ctx();
        try { padreA = await crearPadreOnboarded({ request: reqA, email: PADRE_A_EMAIL, password: PASSWORD }); } finally { await reqA.dispose(); }
        const reqB = await ctx();
        try { padreB = await crearPadreOnboarded({ request: reqB, email: PADRE_B_EMAIL, password: PASSWORD }); } finally { await reqB.dispose(); }
        // El profesional debe estar HABILITADO para canjar (SPEC-690 · exigirProfesionalHabilitadoApi).
        const reqP = await ctx();
        try { profesional = await crearProfesionalVisible({ request: reqP, email: PROFESIONAL_EMAIL, password: PASSWORD, corrida: CORRIDA }); } finally { await reqP.dispose(); }
        const prof = await prisma.usuario.findUnique({ where: { id: profesional.usuarioId }, select: { nombre: true } });
        profesionalNombre = prof?.nombre ?? "";
        expect(profesionalNombre, "el profesional tiene nombre (el que verá el titular)").toBeTruthy();

        const hijo = await prisma.hijo.findFirst({ where: { usuarioId: padreA!.usuarioId }, select: { id: true } });
        expect(hijo, "el onboarding de A dejó una ficha de menor").not.toBeNull();

        // Padre A reporta (nace el expediente, SPEC-604) + un 2º evento → DOS eventos. Contenido REAL plantado.
        const reqRep = await ctx();
        try {
            await login(reqRep, PADRE_A_EMAIL);
            const ciudad = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá" }, select: { id: true, nombre: true, paisId: true } });
            const pais = await prisma.pais.findUnique({ where: { id: ciudad!.paisId }, select: { nombre: true } });
            const identificador = `+57300ACC${Date.now() % 1000000}`;
            const rep = await reqRep.post("/api/reportes", {
                data: {
                    identificador, plataforma: "whatsapp", texto: TEXTO_SECRETO, fechaIncidente: "2026-08-25T21:30:00.000Z",
                    ciudad: ciudad!.nombre, pais: pais?.nombre ?? "Colombia", ciudadId: ciudad!.id, paisId: ciudad!.paisId, hijoId: hijo!.id,
                },
            });
            expect(rep.status(), `reportar body=${(await rep.text().catch(() => "")).slice(0, 200)}`).toBe(201);
            reporteId = (await rep.json())?.reporte?.id ?? "";
            expect(reporteId, "el reporte dejó id").toBeTruthy();
            const ev = await reqRep.post(`/api/reportes/${reporteId}/evento`, { data: { texto: `Segundo evento del hilo 785 (${CORRIDA}), con suficiente texto.`, fechaIncidente: "2026-08-27T22:15:00.000Z" } });
            expect(ev.status(), `evento body=${(await ev.text().catch(() => "")).slice(0, 200)}`).toBe(201);
            const exp = await reqRep.post("/api/padre/expedientes", { data: { reportePrincipalId: reporteId } });
            expect([200, 201].includes(exp.status()), `expediente body=${(await exp.text().catch(() => "")).slice(0, 200)}`).toBe(true);
            expedienteId = (await exp.json())?.expedienteId ?? "";
            expect(expedienteId, "el expediente de A existe").toBeTruthy();
        } finally {
            await reqRep.dispose();
        }

        // Camino REAL del pase: A solicita (el código plano vuelve una vez) → el profesional canjea → LEE el
        // expediente completo (una lectura por evento → 2).
        let codigo = "";
        const reqSol = await ctx();
        try {
            await login(reqSol, PADRE_A_EMAIL);
            const sol = await reqSol.post(`/api/padre/expedientes/${expedienteId}/solicitar-acceso`, { data: {} });
            expect(sol.status(), `solicitar-acceso body=${(await sol.text().catch(() => "")).slice(0, 200)}`).toBe(201);
            codigo = (await sol.json())?.codigo ?? "";
            expect(codigo, "el pase trae el código plano (se muestra una vez)").toBeTruthy();
        } finally {
            await reqSol.dispose();
        }

        const reqProf = await ctx();
        try {
            await login(reqProf, PROFESIONAL_EMAIL);
            const canje = await reqProf.post("/api/reportes/acceso/canjar", { data: { codigo } });
            expect(canje.status(), `canjar body=${(await canje.text().catch(() => "")).slice(0, 200)}`).toBe(200);
            const tokenSesion = (await canje.json())?.tokenSesion ?? "";
            expect(tokenSesion, "el canje abre sesión de visualización").toBeTruthy();
            const ver = await reqProf.get(`/api/reportes/acceso/ver?token=${encodeURIComponent(tokenSesion)}`);
            expect(ver.status(), `ver body=${(await ver.text().catch(() => "")).slice(0, 200)}`).toBe(200);
        } finally {
            await reqProf.dispose();
        }
    });

    test.afterAll(async () => {
        // best-effort FK-safe: el rastro del expediente antes del padre.
        await prisma.lecturaReporte.deleteMany({ where: { reporteId } }).catch(() => undefined);
        await prisma.codigoAccesoContenido.deleteMany({ where: { expedienteId } }).catch(() => undefined);
        if (padreA) await prisma.reporte.deleteMany({ where: { usuarioId: padreA.usuarioId } }).catch(() => undefined);
        if (profesional) await limpiarProfesionalVisible(profesional).catch(() => undefined);
        if (padreA) await limpiarPadreOnboarded(padreA).catch(() => undefined);
        if (padreB) await limpiarPadreOnboarded(padreB).catch(() => undefined);
    });

    test("(1) el titular VE quién leyó su expediente, con el conteo EXACTO de eventos", async () => {
        const req = await ctx();
        try {
            await login(req, PADRE_A_EMAIL);
            const res = await accesosDe(req);
            expect(res.status(), "el titular lee los accesos de SU expediente").toBe(200);
            const items: Array<{ quien: string | null; rol: string | null; eventosLeidos: number }> = (await res.json())?.items ?? [];
            const acceso = items.find((a) => a.rol === "PROFESIONAL");
            expect(acceso, "el acceso del profesional que canjeó aparece").toBeTruthy();
            expect(acceso!.quien, "quién: el nombre del profesional que canjeó").toBe(profesionalNombre);
            expect(acceso!.eventosLeidos, "conteo EXACTO: leyó los 2 eventos del expediente (no ≥1)").toBe(2);
        } finally {
            await req.dispose();
        }
    });

    test("(2) 🔒 aislamiento · otro padre pide los accesos del expediente ajeno → 404 (no 403)", async () => {
        const req = await ctx();
        try {
            await login(req, PADRE_B_EMAIL);
            const res = await accesosDe(req);
            expect(res.status(), "para B el expediente de A no existe → 404, sin revelar nada").toBe(404);
        } finally {
            await req.dispose();
        }
    });

    test("(3) no-fuga de CONTENIDO · la vista de accesos trae SOLO metadatos, ningún texto del expediente", async () => {
        const req = await ctx();
        try {
            await login(req, PADRE_A_EMAIL);
            const res = await accesosDe(req);
            expect(res.status()).toBe(200);
            const crudo = await res.text();
            expect(crudo.includes(TEXTO_SECRETO), "el texto del relato NO aparece en la vista de accesos").toBe(false);
            const items: Array<Record<string, unknown>> = JSON.parse(crudo)?.items ?? [];
            expect(items.length, "hay al menos el acceso del profesional").toBeGreaterThan(0);
            for (const it of items) {
                expect(Object.keys(it).sort(), "cada acceso trae SOLO los campos de metadato").toEqual(["cuando", "eventosLeidos", "id", "quien", "rol"]);
            }
        } finally {
            await req.dispose();
        }
    });
});

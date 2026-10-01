/**
 * SPEC-780 (recorrido de Calidad) · Rectificación del relato de la cita (habeas data, Ley 1581).
 *
 * QUÉ CAMINA. El camino SANCIONADO que #780 construyó: un OPERADOR corrige el relato
 * (`SolicitudCita.presentacion`) de la cita VIVA por `PATCH /api/operador/citas/[id]/relato`
 * (NO autoservicio del padre, NUNCA a mano en la base). Sobre una cadena de reprogramación REAL
 * —reservar → pagar → reprogramar, que COPIA el relato verbatim a una fila nueva— se afirma lo que
 * el radicado exige:
 *   (a) MUTACIÓN: la corrección llega a la fila viva (su `presentacion` cambia).
 *   (b) HISTORIAL CONSERVADO, con CONTEO explícito: la fila anterior de la cadena (la reprogramada)
 *       NO cambia —es el registro de lo que se pidió entonces—, y el servidor RECHAZA corregirla
 *       (400): «ya fue reprogramada … corrige la cita vigente». Una fila corregida, una conservada.
 *   (c) SIN FUGA DE TEXTO: el rastro del hecho queda en `AuditLog`
 *       (`CITA_PROFESIONAL_RELATO_CORREGIDO`) SIN volcar el relato —ni el anterior ni el nuevo— a los
 *       metadatos (lección `ceo-cifrar-el-campo-no-cifra-sus-derivados`).
 *
 * El copy del límite (lo que la acción NO hace) lo certifica Diseño y lo fija el candado de unidad
 * `copy-correccion-relato.candado.test`; este recorrido NO lo reimplementa — camina la CONDUCTA.
 *
 * NIVEL. Recorrido end-to-end por endpoints reales con roles titulares: el padre reserva/reprograma
 * como padre; el admin activa el pago como admin; el operador corrige como operador. La cita se
 * levanta por el flujo real (profesional VISIBLE + franja + reserva), sin sembrar `SolicitudCita` a mano.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-780-`. Limpieza FK-safe en afterAll.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import type { RolUsuario } from "@prisma/client";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

const CORRIDA = `e2e-780-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Relato780!Secure";
const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;
const ADMIN_EMAIL = `${CORRIDA}-admin@proteccion.local`;
const OPERADOR_EMAIL = `${CORRIDA}-operador@proteccion.local`;

const RELATO_ORIGINAL = `Relato ORIGINAL del padre para la cita (SPEC-780, corrida ${CORRIDA}), con largo suficiente.`;
const RELATO_CORREGIDO = `Relato CORREGIDO por el operador (SPEC-780, corrida ${CORRIDA}): se arregla un error factual.`;

let profesional: ProfesionalVisible | undefined;
let padre: PadreOnboarded | undefined;
let perfilProfesionalId = "";
let franjaReservaId = "";
let franjaReprogramadaId = "";
let solicitudHistoricaId = ""; // la reprogramada (con sucesor) → historial
let solicitudVivaId = ""; // la nueva (sin sucesor) → viva, la que SÍ se corrige

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

async function aceptarConsentimiento(request: APIRequestContext) {
    await request.post("/api/consentimiento/aceptar", { data: { documentoTipo: "POLITICA_DATOS", esRepresentanteLegal: false } });
}

/** ADMIN y OPERADOR efímeros por Prisma (patrón operadores: clave LOCAL de la corrida, se borran en afterAll). */
async function asegurarUsuario(email: string, rol: RolUsuario, nombre: string) {
    await prisma.usuario.upsert({
        where: { email },
        update: { rol, estado: "activo" },
        create: { email, nombre, passwordHash: await hashPassword(PASSWORD), rol, estado: "activo" },
    });
}

async function relatoDe(id: string): Promise<string | null> {
    const s = await prisma.solicitudCita.findUnique({ where: { id }, select: { presentacion: true } });
    return s?.presentacion ?? null;
}

test.describe.serial("SPEC-780 · el operador rectifica el relato de la cita VIVA; el historial se conserva", () => {
    test.beforeAll(async () => {
        await asegurarUsuario(ADMIN_EMAIL, "ADMIN" as RolUsuario, `Admin E2E ${CORRIDA}`);
        await asegurarUsuario(OPERADOR_EMAIL, "OPERADOR" as RolUsuario, `Operador E2E ${CORRIDA}`);

        // Profesional VISIBLE por su flujo real (ACTIVO, atiendeVirtual, una franja VIRTUAL +7d).
        const reqProf = await ctx();
        try {
            profesional = await crearProfesionalVisible({ request: reqProf, email: PROFESIONAL_EMAIL, password: PASSWORD, corrida: CORRIDA });
        } finally {
            await reqProf.dispose();
        }
        perfilProfesionalId = profesional.perfilId;
        franjaReservaId = profesional.franjaId ?? "";
        expect(franjaReservaId, "la franja de reserva (+7d) existe").toBeTruthy();

        // Segunda franja (+9d) para la reprogramación — publicada por el propio profesional (endpoint real).
        const reqProf2 = await ctx();
        try {
            await login(reqProf2, PROFESIONAL_EMAIL);
            const inicio = new Date(Date.now() + 9 * 24 * 3600 * 1000).toISOString();
            const fin = new Date(Date.now() + 9 * 24 * 3600 * 1000 + 60 * 60 * 1000).toISOString();
            const r = await reqProf2.post("/api/profesional/franjas", { data: { inicio, fin, modalidad: "VIRTUAL" } });
            expect(r.status(), `crear 2ª franja body=${(await r.text().catch(() => "")).slice(0, 200)}`).toBeLessThan(300);
            franjaReprogramadaId = (await r.json())?.data?.id ?? "";
            expect(franjaReprogramadaId, "la 2ª franja (+9d) existe").toBeTruthy();
        } finally {
            await reqProf2.dispose();
        }

        // Padre onboardeado por el camino real.
        const reqPadre = await ctx();
        try {
            padre = await crearPadreOnboarded({ request: reqPadre, email: PADRE_EMAIL, password: PASSWORD });
        } finally {
            await reqPadre.dispose();
        }

        // (1) el padre reserva con el RELATO ORIGINAL.
        const reqReserva = await ctx();
        try {
            await login(reqReserva, PADRE_EMAIL);
            const reservar = await reqReserva.post("/api/padre/citas", {
                data: { profesionalId: perfilProfesionalId, franjaId: franjaReservaId, presentacion: RELATO_ORIGINAL, urgencia: "ESTA_SEMANA" },
            });
            const body = await reservar.json().catch(() => ({}));
            expect(reservar.status(), `reservar body=${JSON.stringify(body).slice(0, 220)}`).toBe(200);
            solicitudHistoricaId = body?.data?.id ?? "";
            expect(solicitudHistoricaId, "la reserva devuelve el id de la solicitud").toBeTruthy();
        } finally {
            await reqReserva.dispose();
        }

        // (2) el admin activa el pago → PAGADA_PENDIENTE (reprogramar exige cita activa).
        const reqAdmin = await ctx();
        try {
            await login(reqAdmin, ADMIN_EMAIL);
            await aceptarConsentimiento(reqAdmin);
            await login(reqAdmin, ADMIN_EMAIL);
            const activar = await reqAdmin.post(`/api/admin/pagos/cita/${solicitudHistoricaId}/activar`);
            expect(activar.status(), `activar pago body=${(await activar.text().catch(() => "")).slice(0, 220)}`).toBe(200);
        } finally {
            await reqAdmin.dispose();
        }

        // (3) el padre REPROGRAMA a la 2ª franja → crea la fila VIVA (copia el relato verbatim);
        //     la original queda como HISTORIAL (con sucesor).
        const reqReprog = await ctx();
        try {
            await login(reqReprog, PADRE_EMAIL);
            const reprog = await reqReprog.post(`/api/padre/citas/${solicitudHistoricaId}/reprogramar`, {
                data: { nuevaFranjaId: franjaReprogramadaId },
            });
            expect(reprog.status(), `reprogramar body=${(await reprog.text().catch(() => "")).slice(0, 220)}`).toBe(200);
        } finally {
            await reqReprog.dispose();
        }

        // La VIVA es la fila que heredó el pago de la histórica (sin sucesor).
        const viva = await prisma.solicitudCita.findFirst({
            where: { pagoHeredadoDeId: solicitudHistoricaId },
            select: { id: true, presentacion: true },
        });
        expect(viva, "la reprogramación creó la fila viva (pagoHeredadoDe = histórica)").not.toBeNull();
        solicitudVivaId = viva!.id;
        // Precondición de (b): la reprogramación COPIÓ el relato verbatim a la fila viva.
        expect(viva!.presentacion, "la reprogramación copia el relato verbatim a la fila nueva").toBe(RELATO_ORIGINAL);
    });

    test.afterAll(async () => {
        // FK-safe: la fila VIVA referencia a la HISTÓRICA (`pagoHeredadoDeId`, auto-FK) → se borra la viva
        // ANTES que la histórica; luego cualquier remanente, el rastro, y el perfil/padre por sus fixtures.
        if (solicitudVivaId) await prisma.solicitudCita.deleteMany({ where: { id: solicitudVivaId } }).catch(() => undefined);
        if (solicitudHistoricaId) await prisma.solicitudCita.deleteMany({ where: { id: solicitudHistoricaId } }).catch(() => undefined);
        await prisma.solicitudCita
            .deleteMany({ where: { profesionalId: perfilProfesionalId } })
            .catch((e) => console.warn("[SPEC-780] limpieza de solicitudes falló:", e));
        await prisma.auditLog
            .deleteMany({ where: { recursoId: { in: [solicitudVivaId, solicitudHistoricaId].filter(Boolean) } } })
            .catch(() => undefined);
        if (profesional) await limpiarProfesionalVisible(profesional);
        if (padre) await limpiarPadreOnboarded(padre);
        await prisma.usuario.deleteMany({ where: { email: { in: [ADMIN_EMAIL, OPERADOR_EMAIL] } } }).catch(() => undefined);
    });

    test("(a) el operador corrige el relato de la cita VIVA → cambia, y el rastro NO filtra el texto", async () => {
        const auditAntes = await prisma.auditLog.count({
            where: { accion: "CITA_PROFESIONAL_RELATO_CORREGIDO", recursoId: solicitudVivaId },
        });

        const req = await ctx();
        try {
            await login(req, OPERADOR_EMAIL);
            const res = await req.patch(`/api/operador/citas/${solicitudVivaId}/relato`, { data: { presentacion: RELATO_CORREGIDO } });
            expect(res.status(), `corregir relato body=${(await res.text().catch(() => "")).slice(0, 220)}`).toBe(200);
        } finally {
            await req.dispose();
        }

        expect(await relatoDe(solicitudVivaId), "(a) la fila VIVA quedó con el relato corregido").toBe(RELATO_CORREGIDO);

        // (c) el rastro del HECHO quedó, SIN el texto del relato (ni el anterior ni el nuevo).
        const audits = await prisma.auditLog.findMany({
            where: { accion: "CITA_PROFESIONAL_RELATO_CORREGIDO", recursoId: solicitudVivaId },
            select: { metadatos: true },
        });
        expect(audits.length, "(c) la corrección deja al menos un rastro del hecho").toBeGreaterThan(auditAntes);
        const crudo = JSON.stringify(audits);
        expect(crudo.includes(RELATO_CORREGIDO), "(c) el AuditLog NO vuelca el relato NUEVO").toBe(false);
        expect(crudo.includes(RELATO_ORIGINAL), "(c) el AuditLog NO vuelca el relato ANTERIOR").toBe(false);
    });

    test("(b) el historial se CONSERVA: la fila reprogramada no cambia y el servidor RECHAZA corregirla", async () => {
        // Conteo explícito del radicado: UNA corregida (la viva, test a), UNA conservada (la histórica).
        expect(await relatoDe(solicitudHistoricaId), "(b) la fila HISTÓRICA conserva el relato original").toBe(RELATO_ORIGINAL);

        const req = await ctx();
        try {
            await login(req, OPERADOR_EMAIL);
            const res = await req.patch(`/api/operador/citas/${solicitudHistoricaId}/relato`, { data: { presentacion: "intento de reescribir el historial (SPEC-780)" } });
            expect(res.status(), "(b) corregir una fila YA REPROGRAMADA debe RECHAZARSE (400)").toBe(400);
            const msg = (await res.json().catch(() => ({})))?.error?.message ?? "";
            expect(msg, `(b) el 400 dice que esa versión es historial. msg="${msg}"`).toMatch(/reprogramad|cita vigente/i);
        } finally {
            await req.dispose();
        }

        // Y el rechazo NO la tocó: sigue conservando el original.
        expect(await relatoDe(solicitudHistoricaId), "(b) tras el 400, la fila histórica sigue intacta").toBe(RELATO_ORIGINAL);
    });
});

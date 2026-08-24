/**
 * SPEC-238 (002-PI-mega-cola): tests de integración de
 * POST /api/admin/comite/aclaracion/[id]/responder (T014):
 * guardas de rol, 409 re-respuesta, 404 fuera de ámbito y transición atómica.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            (name === "token" || name === "__Host-token") && mockToken
                ? { name, value: mockToken }
                : undefined,
    }),
}));

// Motor Notif no debe frenar la transición: se simula la API estricta.
vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

function crearRequest(body: unknown, aclaracionId: string): Request {
    return new Request(`http://localhost:5005/api/admin/comite/aclaracion/${aclaracionId}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function seedAclaracionPendiente(padreId: string) {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Math.random() * 10000000)}`,
            fechaApertura: new Date(),
            estado: EstadoExpediente.EN_ACLARACION,
            numEventos: 3,
        },
    });
    const informe = await prisma.informeConsolidado.create({
        data: {
            expedienteId: expediente.id,
            versionSecuencial: 1,
            scoreValor: 10,
            scoreGravedad: "VERDE",
            categoriasDetectadasJson: { CONTACTO_INSISTENTE: 3 },
            resumenTextoGenerado: "Resumen consolidado de prueba",
            estadoAprobacion: "APROBADO",
        },
    });
    const aclaracion = await prisma.aclaracionExpediente.create({
        data: {
            expedienteId: expediente.id,
            informeConsolidadoId: informe.id,
            solicitudTexto: "Duda del padre",
            estado: "PENDIENTE",
        },
    });
    return { expediente, aclaracion };
}

describe("POST /api/admin/comite/aclaracion/[id]/responder (SPEC-238)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("responde la aclaración y devuelve el expediente a EN_APROBACION_PADRE (200)", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const { expediente, aclaracion } = await seedAclaracionPendiente(padre.id);

        const res = await POST(
            crearRequest({ respuestaTexto: "Los reportes provienen de dos fuentes independientes." }, aclaracion.id),
            { params: Promise.resolve({ id: aclaracion.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.aclaracion.estado).toBe("RESPONDIDA");
        expect(json.aclaracion.respondidaPor).toBe(comite.id);
        expect(json.aclaracion.respuestaTexto).toBeUndefined();

        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.EN_APROBACION_PADRE);
    });

    it("devuelve 409 al responder una aclaración ya respondida", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const { aclaracion } = await seedAclaracionPendiente(padre.id);

        const primera = await POST(crearRequest({ respuestaTexto: "Respuesta" }, aclaracion.id), {
            params: Promise.resolve({ id: aclaracion.id }),
        });
        expect(primera.status).toBe(200);

        const segunda = await POST(crearRequest({ respuestaTexto: "Otra respuesta" }, aclaracion.id), {
            params: Promise.resolve({ id: aclaracion.id }),
        });
        expect(segunda.status).toBe(409);
    });

    it("devuelve 403 para roles que no son COMITE_VALIDACION", async () => {
        const padre = await crearUsuario("PARENT");
        const { aclaracion } = await seedAclaracionPendiente(padre.id);

        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await POST(crearRequest({ respuestaTexto: "No autorizado" }, aclaracion.id), {
            params: Promise.resolve({ id: aclaracion.id }),
        });
        expect(res.status).toBe(403);
    });

    it("devuelve 404 para un comité con cuenta de colegio (fuera de ámbito)", async () => {
        const padre = await crearUsuario("PARENT");
        const comiteColegio = await crearUsuario("COMITE_VALIDACION");
        // Cuenta con ámbito de colegio (SPEC-168): no ve aclaraciones de padre.
        const { colegio } = await crearColegioConAdmin();
        await prisma.usuario.update({
            where: { id: comiteColegio.id },
            data: { comiteColegioId: colegio.id },
        });
        mockToken = await crearTokenUsuario(comiteColegio.id, "COMITE_VALIDACION");
        const { aclaracion } = await seedAclaracionPendiente(padre.id);

        const res = await POST(crearRequest({ respuestaTexto: "Fuera de ámbito" }, aclaracion.id), {
            params: Promise.resolve({ id: aclaracion.id }),
        });
        expect(res.status).toBe(404);
    });

    it("devuelve 400 con respuesta vacía o mayor a 2000 caracteres", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const { aclaracion } = await seedAclaracionPendiente(padre.id);

        const vacia = await POST(crearRequest({ respuestaTexto: "" }, aclaracion.id), {
            params: Promise.resolve({ id: aclaracion.id }),
        });
        expect(vacia.status).toBe(400);

        const larga = await POST(crearRequest({ respuestaTexto: "x".repeat(2001) }, aclaracion.id), {
            params: Promise.resolve({ id: aclaracion.id }),
        });
        expect(larga.status).toBe(400);
    });
});

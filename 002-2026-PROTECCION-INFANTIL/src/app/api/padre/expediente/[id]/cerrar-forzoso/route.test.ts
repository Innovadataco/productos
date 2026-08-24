/**
 * SPEC-238 (002-PI-mega-cola): tests de integración de
 * POST /api/padre/expediente/[id]/cerrar-forzoso (T016):
 * cierre por el padre, cierre por worker secret, idempotencia y guardas.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

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

function crearRequest(expedienteId: string, workerSecret?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (workerSecret) headers["x-worker-secret"] = workerSecret;
    return new Request(`http://localhost:5005/api/padre/expediente/${expedienteId}/cerrar-forzoso`, {
        method: "POST",
        headers,
        body: "{}",
    });
}

async function seedExpedienteConAclaracion(
    padreId: string,
    estadoAclaracion: "PENDIENTE" | "RESPONDIDA" | "CERRADA_FORZOSAMENTE",
    estadoExpediente: EstadoExpediente = EstadoExpediente.EN_APROBACION_PADRE
) {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Math.random() * 10000000)}`,
            fechaApertura: new Date(),
            estado: estadoExpediente,
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
            estado: estadoAclaracion,
            ...(estadoAclaracion !== "PENDIENTE"
                ? { respondidaEn: new Date(), respondidaPor: padreId, respuestaTexto: "Respuesta" }
                : {}),
        },
    });
    return { expediente, aclaracion };
}

describe("POST /api/padre/expediente/[id]/cerrar-forzoso (SPEC-238)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("el padre titular cierra: expediente CERRADO y aclaración CERRADA_FORZOSAMENTE (200)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const { expediente, aclaracion } = await seedExpedienteConAclaracion(padre.id, "RESPONDIDA");

        const res = await POST(crearRequest(expediente.id), { params: Promise.resolve({ id: expediente.id }) });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.estadoExpediente).toBe("CERRADO");
        expect(json.aclaracionEstado).toBe("CERRADA_FORZOSAMENTE");
        expect(json.yaCerrado).toBe(false);

        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.CERRADO);
        const aclaracionActual = await prisma.aclaracionExpediente.findUnique({ where: { id: aclaracion.id } });
        expect(aclaracionActual?.estado).toBe("CERRADA_FORZOSAMENTE");
    });

    it("es idempotente: la segunda llamada devuelve 200 sin cambios", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const { expediente } = await seedExpedienteConAclaracion(padre.id, "RESPONDIDA");

        const primera = await POST(crearRequest(expediente.id), { params: Promise.resolve({ id: expediente.id }) });
        expect(primera.status).toBe(200);

        const segunda = await POST(crearRequest(expediente.id), { params: Promise.resolve({ id: expediente.id }) });
        expect(segunda.status).toBe(200);
        const json = await segunda.json();
        expect(json.yaCerrado).toBe(true);
    });

    it("el worker post-SLA puede cerrar con X-Worker-Secret", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await seedExpedienteConAclaracion(padre.id, "RESPONDIDA");

        const res = await POST(crearRequest(expediente.id, process.env.WORKER_SECRET), {
            params: Promise.resolve({ id: expediente.id }),
        });

        expect(res.status).toBe(200);
        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.CERRADO);
    });

    it("devuelve 409 sin aclaración o con aclaración PENDIENTE", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const sin = await prisma.expediente.create({
            data: {
                padreUsuarioId: padre.id,
                identificadorReportado: `+57300${Math.floor(Math.random() * 10000000)}`,
                fechaApertura: new Date(),
                estado: EstadoExpediente.EN_APROBACION_PADRE,
                numEventos: 3,
            },
        });
        const resSin = await POST(crearRequest(sin.id), { params: Promise.resolve({ id: sin.id }) });
        expect(resSin.status).toBe(409);

        const { expediente } = await seedExpedienteConAclaracion(padre.id, "PENDIENTE");
        const resPendiente = await POST(crearRequest(expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(resPendiente.status).toBe(409);
    });

    it("devuelve 403 para un padre no titular", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        const { expediente } = await seedExpedienteConAclaracion(padre.id, "RESPONDIDA");

        const res = await POST(crearRequest(expediente.id), { params: Promise.resolve({ id: expediente.id }) });
        expect(res.status).toBe(403);
    });
});

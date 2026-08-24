/**
 * SPEC-238 (002-PI-mega-cola): tests de integración de
 * POST /api/padre/expediente/[id]/pedir-aclaracion (T012, T023):
 * guardas de rol, 409 duplicado, validación Zod y concurrencia.
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

function crearRequest(body: unknown, expedienteId: string): Request {
    return new Request(`http://localhost:5005/api/padre/expediente/${expedienteId}/pedir-aclaracion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function seedExpedienteConInforme(padreId: string, estado: EstadoExpediente = EstadoExpediente.EN_APROBACION_PADRE) {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Math.random() * 10000000)}`,
            fechaApertura: new Date(),
            estado,
            numEventos: 3,
        },
    });
    await prisma.informeConsolidado.create({
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
    return expediente;
}

describe("POST /api/padre/expediente/[id]/pedir-aclaracion (SPEC-238)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("crea la aclaración PENDIENTE y transita el expediente (201)", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const expediente = await seedExpedienteConInforme(padre.id);

        const res = await POST(crearRequest({ solicitudTexto: "No entiendo dos ciudades distintas." }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.aclaracion.estado).toBe("PENDIENTE");
        expect(json.aclaracion.expedienteId).toBe(expediente.id);
        // El payload no expone el texto sensible (D-7).
        expect(json.aclaracion.solicitudTexto).toBeUndefined();

        const expedienteActual = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(expedienteActual?.estado).toBe(EstadoExpediente.EN_ACLARACION);
    });

    it("devuelve 409 al pedir una segunda aclaración", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const expediente = await seedExpedienteConInforme(padre.id);

        const primera = await POST(crearRequest({ solicitudTexto: "Primera" }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(primera.status).toBe(201);

        // El expediente quedó EN_ACLARACION: la segunda petición recibe 409.
        const segunda = await POST(crearRequest({ solicitudTexto: "Segunda" }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(segunda.status).toBe(409);
        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } })).toBe(1);
    });

    it("concurrencia: dos POST simultáneos → uno 201 y otro 409", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const expediente = await seedExpedienteConInforme(padre.id);

        const [resA, resB] = await Promise.all([
            POST(crearRequest({ solicitudTexto: "Duda A" }, expediente.id), {
                params: Promise.resolve({ id: expediente.id }),
            }),
            POST(crearRequest({ solicitudTexto: "Duda B" }, expediente.id), {
                params: Promise.resolve({ id: expediente.id }),
            }),
        ]);

        const estados = [resA.status, resB.status].sort();
        expect(estados).toEqual([201, 409]);
        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } })).toBe(1);
    });

    it("devuelve 403 para un padre no titular y para otro rol", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        const expediente = await seedExpedienteConInforme(padre.id);

        mockToken = await crearTokenUsuario(otro.id, "PARENT");
        const resOtro = await POST(crearRequest({ solicitudTexto: "Intrusión" }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(resOtro.status).toBe(403);

        const comite = await crearUsuario("COMITE_VALIDACION");
        mockToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");
        const resComite = await POST(crearRequest({ solicitudTexto: "Rol inválido" }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(resComite.status).toBe(403);
    });

    it("devuelve 400 con texto vacío o mayor a 2000 caracteres", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const expediente = await seedExpedienteConInforme(padre.id);

        const vacio = await POST(crearRequest({ solicitudTexto: "  " }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(vacio.status).toBe(400);

        const largo = await POST(crearRequest({ solicitudTexto: "x".repeat(2001) }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(largo.status).toBe(400);
        expect(await prisma.aclaracionExpediente.count({ where: { expedienteId: expediente.id } })).toBe(0);
    });

    it("devuelve 401 sin sesión", async () => {
        const padre = await crearUsuario("PARENT");
        const expediente = await seedExpedienteConInforme(padre.id);

        const res = await POST(crearRequest({ solicitudTexto: "Sin auth" }, expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(res.status).toBe(401);
    });
});

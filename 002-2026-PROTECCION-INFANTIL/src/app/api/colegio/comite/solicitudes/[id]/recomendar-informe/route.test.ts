/**
 * SPEC-380 (PR A · C4) — "el comité recomienda al rector emitir el informe".
 * Afirma:
 *   · sin análisis previo → 400 (no se recomienda a ciegas);
 *   · con análisis → 200, marca fecha y quién, audit deja rastro;
 *   · caso resuelto → 409;
 *   · fallo del motor de notificaciones NO rompe la recomendación
 *     (regla dura del CEO: aviso ≠ acción de negocio).
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";

const mockProgramar = vi.hoisted(() => vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })));

// Interceptamos el motor de notificaciones para no tocarlo — este test es
// del endpoint, no del motor. Un caller separado (o el propio SPEC-201) prueba
// las reglas + preferencias + quiet hours.
vi.mock("@/lib/notificaciones/motor", () => ({ programar: mockProgramar }));
vi.mock("@/lib/notificaciones/motor.ts", () => ({ programar: mockProgramar }));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearColegioConAdmin, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function seedCasoConAnalisis(analisis: string | null = "Análisis del comité.") {
    const { admin, colegio } = await crearColegioConAdmin();
    const comite = await prisma.usuario.create({
        data: {
            email: `comite-${Date.now()}${Math.floor(Math.random() * 1000)}@test.local`,
            passwordHash: "x",
            rol: "COMITE_CONVIVENCIA",
            estado: "activo",
            comiteColegioId: colegio.id,
        },
    });
    const plataforma = await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    const reporte = await prisma.reporte.create({
        data: {
            identificador: `+57300${Date.now()}${Math.floor(Math.random() * 1000)}`,
            plataformaId: plataforma.id,
            texto: "Texto anonimizado",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
        },
    });
    const solicitud = await prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero: `SOL-${Date.now()}${Math.floor(Math.random() * 1000)}`,
            estado: "PENDIENTE",
            colegioId: colegio.id,
            motivo: "Escalamiento por gravedad",
            analisis,
            analisisActualizadoEn: analisis ? new Date() : null,
            analisisPorId: analisis ? comite.id : null,
        },
    });
    return { admin, colegio, comite, solicitud };
}

function req(solicitudId: string): Request {
    return new Request(`http://localhost:5005/api/colegio/comite/solicitudes/${solicitudId}/recomendar-informe`, {
        method: "POST",
        headers: { cookie: `token=${mockToken}` },
    });
}

describe("POST /api/colegio/comite/solicitudes/[id]/recomendar-informe (SPEC-380)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
        mockProgramar.mockClear();
        mockProgramar.mockImplementation(async () => ({ programadas: 1, canceladasPorReemplazo: 0 }));
    });

    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());

    it("con análisis previo: marca la recomendación, audita y llama al motor", async () => {
        const { comite, solicitud } = await seedCasoConAnalisis();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");

        const res = await POST(req(solicitud.id), { params: Promise.resolve({ id: solicitud.id }) });
        expect(res.status).toBe(200);

        const enBd = await prisma.solicitudComite.findUnique({ where: { id: solicitud.id } });
        expect(enBd?.recomendacionInformeEn, "queda marcada la recomendación").not.toBeNull();
        expect(enBd?.recomendacionPorId).toBe(comite.id);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COMITE_RECOMENDACION_INFORME", recursoId: solicitud.id },
        });
        expect(audit).not.toBeNull();

        expect(mockProgramar).toHaveBeenCalledTimes(1);
        const primeraLlamada = mockProgramar.mock.calls[0] as unknown as unknown[];
        const arg = primeraLlamada[0] as { evento: string; destinatarios: unknown[] };
        expect(arg.evento).toBe("colegio.comite.recomendacion_informe");
        expect(arg.destinatarios.length).toBeGreaterThan(0);
    });

    it("sin análisis previo → 400 (no se recomienda a ciegas)", async () => {
        const { comite, solicitud } = await seedCasoConAnalisis(null);
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        const res = await POST(req(solicitud.id), { params: Promise.resolve({ id: solicitud.id }) });
        expect(res.status).toBe(400);
    });

    it("caso RESUELTO → 409 (ya no hace falta recomendar)", async () => {
        const { comite, solicitud } = await seedCasoConAnalisis();
        await prisma.solicitudComite.update({
            where: { id: solicitud.id },
            data: { estado: "RESUELTO", resolucion: "cerrado" },
        });
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");
        const res = await POST(req(solicitud.id), { params: Promise.resolve({ id: solicitud.id }) });
        expect(res.status).toBe(409);
    });

    it("fallo del motor de notificaciones NO rompe la recomendación (queda en BD + audit)", async () => {
        mockProgramar.mockImplementation(async () => {
            throw new Error("Provider quota exceeded");
        });
        const { comite, solicitud } = await seedCasoConAnalisis();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");

        const res = await POST(req(solicitud.id), { params: Promise.resolve({ id: solicitud.id }) });
        expect(res.status, "el fallo del correo no debe reventar la acción").toBe(200);
        const enBd = await prisma.solicitudComite.findUnique({ where: { id: solicitud.id } });
        expect(enBd?.recomendacionInformeEn).not.toBeNull();
    });
});

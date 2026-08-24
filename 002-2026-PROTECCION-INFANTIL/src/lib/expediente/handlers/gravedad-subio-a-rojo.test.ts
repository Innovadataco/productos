/**
 * SPEC-239 (002-PI-mega-cola): tests de integración del handler
 * `manejarSubidaARojo` (T009, US2): SLA efectivo 12h, fechaEscaladoRojoEn,
 * notificación urgente programada y AuditLog EXPEDIENTE_ESCALADO_A_ROJO con
 * nivel CRITICAL en metadatos.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { manejarSubidaARojo, PARAM_SLA_HORAS_ROJO } from "./gravedad-subio-a-rojo";
import { programar } from "@/lib/notificaciones";

vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 2, canceladasPorReemplazo: 0 })),
}));

async function seedParametroSla(valor = "12") {
    await prisma.parametroSistema.upsert({
        where: { clave: PARAM_SLA_HORAS_ROJO },
        update: { valor },
        create: {
            clave: PARAM_SLA_HORAS_ROJO,
            valor,
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
}

async function crearExpediente(padreId: string, score: "VERDE" | "AMARILLO" = "AMARILLO") {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57302${Math.floor(Math.random() * 1000000)}`,
            fechaApertura: new Date(),
            estado: "ACTIVO",
            numEventos: 3,
            scoreGravedadActual: score,
        },
    });
}

describe("manejarSubidaARojo (SPEC-239, FR-004)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametroSla();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("fija slaEfectivoHoras=12 y fechaEscaladoRojoEn al subir a ROJO (US2.1)", async () => {
        const padre = await crearUsuario("PARENT");
        const comite = await crearUsuario("COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);
        const ahora = new Date("2026-08-24T15:00:00.000Z");

        const actualizado = await manejarSubidaARojo({
            expediente: exp,
            gravedadAnterior: "AMARILLO",
            actor: "worker-expediente-motor",
            ahora,
        });

        expect(actualizado.scoreGravedadActual).toBe("ROJO");
        expect(actualizado.slaEfectivoHoras).toBe(12);
        expect(actualizado.fechaEscaladoRojoEn?.toISOString()).toBe(ahora.toISOString());
        expect(comite).toBeTruthy();
    });

    it("programa notificación urgente con la plantilla existente expediente.gravedad.subio_a_rojo (US2.2)", async () => {
        const padre = await crearUsuario("PARENT");
        await crearUsuario("COMITE_VALIDACION");
        const exp = await crearExpediente(padre.id);

        await manejarSubidaARojo({ expediente: exp, gravedadAnterior: "AMARILLO", actor: "worker-expediente-motor" });

        expect(programar).toHaveBeenCalledTimes(1);
        const input = vi.mocked(programar).mock.calls[0]![0];
        expect(input.evento).toBe("expediente.gravedad.subio_a_rojo");
        expect(input.sujetoTipo).toBe("Expediente");
        expect(input.sujetoId).toBe(exp.id);
        const destinatarioIds = input.destinatarios.map((d) => d.usuarioId);
        expect(destinatarioIds).toContain(padre.id);
    });

    it("registra AuditLog EXPEDIENTE_ESCALADO_A_ROJO con nivel CRITICAL y sin texto de reporte (US2.3)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);

        await manejarSubidaARojo({ expediente: exp, gravedadAnterior: "AMARILLO", actor: "worker-expediente-motor" });

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_ESCALADO_A_ROJO", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();
        const metadatos = audit?.metadatos as Record<string, unknown>;
        expect(metadatos.nivel).toBe("CRITICAL");
        expect(metadatos.slaEfectivoHoras).toBe(12);
        expect(JSON.stringify(metadatos)).not.toContain("texto");
    });

    it("respeta un SLA distinto configurado por parámetro", async () => {
        await seedParametroSla("8");
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);

        const actualizado = await manejarSubidaARojo({
            expediente: exp,
            gravedadAnterior: "VERDE",
            actor: "worker-expediente-motor",
        });
        expect(actualizado.slaEfectivoHoras).toBe(8);
    });
});

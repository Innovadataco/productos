/**
 * SPEC-239 (002-PI-mega-cola): tests de integración de la tarea del worker
 * `vigilarSlaRojo` (T019, US4): publica expediente.comite.sla_vencido solo
 * para expedientes ROJO en PENDIENTE_COMITE/EN_APROBACION_PADRE con más de
 * 12h desde fechaEscaladoRojoEn; idempotente y fail-open por registro.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { vigilarSlaRojo } from "./tareas-motor";
import { programar } from "@/lib/notificaciones";

vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

async function seedParametroSla(valor = "12") {
    await prisma.parametroSistema.upsert({
        where: { clave: "padre.comite.sla_horas_gravedad_roja" },
        update: { valor },
        create: {
            clave: "padre.comite.sla_horas_gravedad_roja",
            valor,
            tipo: "INTEGER",
            categoria: "SYSTEM",
            esPublico: false,
            descripcion: "test",
        },
    });
}

async function crearExpediente(padreId: string, overrides: Record<string, unknown> = {}) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57302${Math.floor(Math.random() * 1000000)}`,
            fechaApertura: new Date(),
            estado: "PENDIENTE_COMITE",
            numEventos: 3,
            scoreGravedadActual: "ROJO",
            ...overrides,
        } as never,
    });
}

describe("vigilarSlaRojo (SPEC-239, FR-008)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParametroSla();
        vi.clearAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("publica expediente.comite.sla_vencido para ROJO PENDIENTE_COMITE con >12h (US4.1/SC-005)", async () => {
        const padre = await crearUsuario("PARENT");
        await crearUsuario("COMITE_VALIDACION");
        const hace13h = new Date(Date.now() - 13 * 60 * 60 * 1000);
        const exp = await crearExpediente(padre.id, { fechaEscaladoRojoEn: hace13h });

        const alertados = await vigilarSlaRojo(new Date());
        expect(alertados).toBe(1);

        expect(programar).toHaveBeenCalledTimes(1);
        expect(vi.mocked(programar).mock.calls[0]![0].evento).toBe("expediente.comite.sla_vencido");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "EXPEDIENTE_COMITE_SLA_VENCIDO", recursoId: exp.id },
        });
        expect(audit).not.toBeNull();
        const metadatos = audit?.metadatos as Record<string, unknown>;
        expect(metadatos.nivel).toBe("CRITICAL");
        expect(metadatos.slaHoras).toBe(12);
    });

    it("también vigila ROJO en EN_APROBACION_PADRE (US4.1)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace13h = new Date(Date.now() - 13 * 60 * 60 * 1000);
        await crearExpediente(padre.id, { estado: "EN_APROBACION_PADRE", fechaEscaladoRojoEn: hace13h });

        const alertados = await vigilarSlaRojo(new Date());
        expect(alertados).toBe(1);
    });

    it("ignora expedientes fuera de estados vigilados o no ROJO (US4.2)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace13h = new Date(Date.now() - 13 * 60 * 60 * 1000);
        await crearExpediente(padre.id, { estado: "ACTIVO", fechaEscaladoRojoEn: hace13h });
        await crearExpediente(padre.id, { estado: "CERRADO", fechaEscaladoRojoEn: hace13h });
        await crearExpediente(padre.id, { scoreGravedadActual: "AMARILLO", fechaEscaladoRojoEn: hace13h });
        await crearExpediente(padre.id, { estado: "PENDIENTE_COMITE", scoreGravedadActual: "ROJO" });

        const alertados = await vigilarSlaRojo(new Date());
        expect(alertados).toBe(0);
        expect(programar).not.toHaveBeenCalled();
    });

    it("no publica vencimiento con menos de 12h desde el escalamiento (US4.3)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace5h = new Date(Date.now() - 5 * 60 * 60 * 1000);
        await crearExpediente(padre.id, { fechaEscaladoRojoEn: hace5h });

        const alertados = await vigilarSlaRojo(new Date());
        expect(alertados).toBe(0);
    });

    it("idempotente: segunda pasada sin nuevo escalamiento no republica (SC-005)", async () => {
        const padre = await crearUsuario("PARENT");
        const hace13h = new Date(Date.now() - 13 * 60 * 60 * 1000);
        const exp = await crearExpediente(padre.id, { fechaEscaladoRojoEn: hace13h });

        expect(await vigilarSlaRojo(new Date())).toBe(1);
        expect(await vigilarSlaRojo(new Date())).toBe(0);

        const avisos = await prisma.auditLog.count({
            where: { accion: "EXPEDIENTE_COMITE_SLA_VENCIDO", recursoId: exp.id },
        });
        expect(avisos).toBe(1);
    });
});

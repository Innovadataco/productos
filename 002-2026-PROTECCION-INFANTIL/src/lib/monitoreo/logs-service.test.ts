import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { listarLogs, contarLogsParaPurgar, purgarLogs } from "./logs-service";
import { AppError, ERROR_CODES } from "@/lib/errors";

/**
 * Tests de integración del servicio de logs (SPEC-193 Fase 5).
 * Usan la base de datos de integración y validan paginación, filtros,
 * conteo para purga, purga propiamente dicha y generación de AuditLog.
 */

async function crearLogsDePrueba() {
    const base = new Date("2026-08-15T12:00:00Z");
    await prisma.workerLog.createMany({
        data: [
            { servicio: "pi-app", nivel: "INFO", mensaje: "inicio saludable", creadoEn: new Date(base.getTime() - 86_400_000 * 4) },
            { servicio: "pi-app", nivel: "WARN", mensaje: "latencia alta en endpoint", creadoEn: new Date(base.getTime() - 86_400_000 * 3) },
            { servicio: "pi-worker", nivel: "ERROR", mensaje: "fallo al procesar reporte", creadoEn: new Date(base.getTime() - 86_400_000 * 2) },
            { servicio: "pi-worker", nivel: "INFO", mensaje: "procesamiento completado", creadoEn: new Date(base.getTime() - 86_400_000 * 1) },
            { servicio: "pi-monitor", nivel: "DEBUG", mensaje: "heartbeat recibido", creadoEn: base },
        ],
    });
}

function fecha(diasOffset: number, hora = 0, minuto = 0): Date {
    const d = new Date("2026-08-15T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + diasOffset);
    d.setUTCHours(hora, minuto, 0, 0);
    return d;
}

describe("logs-service (SPEC-193 Fase 5)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.workerLog.deleteMany();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    describe("listarLogs", () => {
        it("devuelve logs paginados", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({ limit: 2, offset: 0 });

            expect(total).toBe(5);
            expect(items).toHaveLength(2);
        });

        it("aplica offset correctamente", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({ limit: 2, offset: 2 });

            expect(total).toBe(5);
            expect(items).toHaveLength(2);
        });

        it("ordena por creadoEn descendente", async () => {
            await crearLogsDePrueba();

            const { items } = await listarLogs({ limit: 5, offset: 0 });

            for (let i = 0; i < items.length - 1; i++) {
                expect(new Date(items[i].creadoEn).getTime()).toBeGreaterThanOrEqual(
                    new Date(items[i + 1].creadoEn).getTime()
                );
            }
        });

        it("filtra por servicio", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({ servicio: "pi-app" });

            expect(total).toBe(2);
            expect(items.every((item: { servicio: string }) => item.servicio === "pi-app")).toBe(true);
        });

        it("filtra por nivel (>= al indicado)", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({ nivel: "WARN" });

            expect(total).toBe(2);
            expect(items.every((item: { nivel: string }) => ["WARN", "ERROR"].includes(item.nivel))).toBe(true);
        });

        it("filtra por rango de fechas", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({
                desde: fecha(-3, 0, 1),
                hasta: fecha(0, 23, 59),
            });

            expect(total).toBe(4);
            expect(items.some((item: { mensaje: string }) => item.mensaje.includes("inicio saludable"))).toBe(false);
        });

        it("filtra por q en el mensaje", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({ q: "procesamiento" });

            expect(total).toBe(1);
            expect(items.every((item: { mensaje: string }) => item.mensaje.toLowerCase().includes("procesamiento"))).toBe(true);
        });

        it("combina filtros de servicio, nivel y q", async () => {
            await crearLogsDePrueba();

            const { items, total } = await listarLogs({
                servicio: "pi-worker",
                nivel: "INFO",
                q: "procesamiento",
            });

            expect(total).toBe(1);
            expect(items[0].mensaje).toBe("procesamiento completado");
        });

        it("rechaza paginación inválida", async () => {
            await expect(listarLogs({ limit: 0 })).rejects.toBeInstanceOf(AppError);
            await expect(listarLogs({ limit: 501 })).rejects.toBeInstanceOf(AppError);
            await expect(listarLogs({ offset: -1 })).rejects.toBeInstanceOf(AppError);
        });

        it("rechaza rango de fechas invertido", async () => {
            await expect(
                listarLogs({ desde: fecha(1), hasta: fecha(-2) })
            ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
        });
    });

    describe("contarLogsParaPurgar", () => {
        it("cuenta todos los logs anteriores a la fecha límite", async () => {
            await crearLogsDePrueba();

            const total = await contarLogsParaPurgar({ hasta: fecha(-1, 23, 59) });

            expect(total).toBe(4);
        });

        it("cuenta con filtro de servicio", async () => {
            await crearLogsDePrueba();

            const total = await contarLogsParaPurgar({ hasta: fecha(1), servicio: "pi-app" });

            expect(total).toBe(2);
        });

        it("cuenta con filtro de nivel", async () => {
            await crearLogsDePrueba();

            const total = await contarLogsParaPurgar({ hasta: fecha(1), nivel: "WARN" });

            expect(total).toBe(2);
        });

        it("cuenta con combinación de filtros", async () => {
            await crearLogsDePrueba();

            const total = await contarLogsParaPurgar({
                hasta: fecha(1),
                servicio: "pi-app",
                nivel: "WARN",
            });

            expect(total).toBe(1);
        });
    });

    describe("purgarLogs", () => {
        it("borra las filas seleccionadas y genera AuditLog", async () => {
            await crearLogsDePrueba();
            const admin = await crearUsuario("ADMIN");

            const resultado = await purgarLogs({
                hasta: fecha(-2, 23, 59),
                motivo: "Limpieza de logs antiguos por política de retención de 30 días",
                ejecutadoPorId: admin.id,
            });

            expect(resultado.filasBorradas).toBe(3);
            const restantes = await prisma.workerLog.count();
            expect(restantes).toBe(2);

            const audit = await prisma.auditLog.findFirst({
                where: { accion: "LOGS_MANTENIMIENTO_PURGA" },
            });
            expect(audit).not.toBeNull();
            expect(audit?.usuarioId).toBe(admin.id);
            expect(audit?.tipoRecurso).toBe("WorkerLog");
        });

        it("rechaza purgar con fecha igual o posterior a hoy", async () => {
            const admin = await crearUsuario("ADMIN");
            const hoy = new Date();
            hoy.setUTCHours(0, 0, 0, 0);

            await expect(
                purgarLogs({
                    hasta: hoy,
                    motivo: "Limpieza de logs antiguos por política de retención",
                    ejecutadoPorId: admin.id,
                })
            ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
        });

        it("rechaza motivo corto", async () => {
            const admin = await crearUsuario("ADMIN");

            await expect(
                purgarLogs({
                    hasta: fecha(-5),
                    motivo: "Corto",
                    ejecutadoPorId: admin.id,
                })
            ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });
        });

        it("es idempotente cuando no hay filas que borrar", async () => {
            await prisma.workerLog.deleteMany();
            const admin = await crearUsuario("ADMIN");

            const resultado = await purgarLogs({
                hasta: fecha(-1),
                motivo: "Limpieza programada sin registros que afectar",
                ejecutadoPorId: admin.id,
            });

            expect(resultado.filasBorradas).toBe(0);

            const audit = await prisma.auditLog.findFirst({
                where: { accion: "LOGS_MANTENIMIENTO_PURGA" },
            });
            expect(audit).not.toBeNull();
            expect(audit?.metadatos).toMatchObject({ filasBorradas: 0 });
        });

        it("respeta filtros de servicio y nivel al purgar", async () => {
            await crearLogsDePrueba();
            const admin = await crearUsuario("ADMIN");

            const resultado = await purgarLogs({
                hasta: fecha(1),
                servicio: "pi-app",
                nivel: "INFO",
                motivo: "Eliminación selectiva de logs informativos de la aplicación",
                ejecutadoPorId: admin.id,
            });

            expect(resultado.filasBorradas).toBe(2);
            const restantes = await prisma.workerLog.count();
            expect(restantes).toBe(3);
        });
    });
});

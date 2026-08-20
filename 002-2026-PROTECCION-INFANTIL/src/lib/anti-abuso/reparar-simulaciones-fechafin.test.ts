import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { repararSimulacionesFechaFin } from "../../../scripts/reparar-simulaciones-fechafin.mjs";

describe("repararSimulacionesFechaFin (I-64)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("marca COMPLETADA las FALLIDA con progreso=totalReportes", async () => {
        const admin = await crearUsuario("ADMIN");
        const run = await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 50,
                progreso: 50,
                creadoPorId: admin.id,
                estado: "FALLIDA",
                configJson: { n: 50, ipInyectada: "192.0.2.10", identificador: "3000000001", plataforma: "whatsapp" },
            },
        });

        const resultado = await repararSimulacionesFechaFin();
        expect(resultado.reparadas).toBe(1);

        const actualizado = await prisma.simulacionAbusoRun.findUnique({ where: { id: run.id } });
        expect(actualizado?.estado).toBe("COMPLETADA");
    });

    it("no toca FALLIDA con progreso incompleto", async () => {
        const admin = await crearUsuario("ADMIN");
        const run = await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 50,
                progreso: 20,
                creadoPorId: admin.id,
                estado: "FALLIDA",
                configJson: { n: 50, ipInyectada: "192.0.2.10", identificador: "3000000001", plataforma: "whatsapp" },
            },
        });

        const resultado = await repararSimulacionesFechaFin();
        expect(resultado.reparadas).toBe(0);

        const actualizado = await prisma.simulacionAbusoRun.findUnique({ where: { id: run.id } });
        expect(actualizado?.estado).toBe("FALLIDA");
    });

    it("es idempotente: correr dos veces no revierte", async () => {
        const admin = await crearUsuario("ADMIN");
        await prisma.simulacionAbusoRun.create({
            data: {
                escenario: "robot_inundando",
                totalReportes: 50,
                progreso: 50,
                creadoPorId: admin.id,
                estado: "FALLIDA",
                configJson: { n: 50, ipInyectada: "192.0.2.10", identificador: "3000000001", plataforma: "whatsapp" },
            },
        });

        const r1 = await repararSimulacionesFechaFin();
        const r2 = await repararSimulacionesFechaFin();
        expect(r1.reparadas).toBe(1);
        expect(r2.reparadas).toBe(0);
    });
});

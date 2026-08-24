/**
 * SPEC-220 (002-PI-121): tests de integración del AnalisisRepository
 * (lectura del score de valor para la ficha de cliente).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AnalisisRepository } from "./analisis-repository";
import { periodoActualBogota } from "@/lib/analisis/periodos";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearSuscripcionPadre() {
    const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
    const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
    const plan = await prisma.plan.create({
        data: {
            nombre: unico("Plan"),
            tipoTitular: "PADRE",
            duracion: "MES_1",
            anio: 2026,
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "PADRE",
            usuarioId: padre.id,
            estado: "ACTIVA",
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: unico("REF"),
        },
    });
}

async function crearSnapshot(suscripcionId: string, periodo: string, scoreTotal: number) {
    return prisma.scoreCliente.create({
        data: {
            suscripcionId,
            periodo,
            componenteReportes: 1,
            componenteCasos: 2,
            componenteAlertas: 3,
            componenteSesiones: 4,
            pesoReportes: 3,
            pesoCasos: 5,
            pesoAlertas: 2,
            pesoSesiones: 1,
            scoreTotal,
            percentilEnCohorte: 50,
        },
    });
}

describe("AnalisisRepository · obtenerScoreCliente", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve actual null e histórico vacío cuando no hay snapshots", async () => {
        const suscripcion = await crearSuscripcionPadre();
        const { actual, historico } = await new AnalisisRepository().obtenerScoreCliente(suscripcion.id);
        expect(actual).toBeNull();
        expect(historico).toHaveLength(0);
    });

    it("devuelve el snapshot del período actual como `actual` con componentes y pesos mapeados", async () => {
        const suscripcion = await crearSuscripcionPadre();
        await crearSnapshot(suscripcion.id, periodoActualBogota(), 16);

        const { actual, historico } = await new AnalisisRepository().obtenerScoreCliente(suscripcion.id);

        expect(actual).not.toBeNull();
        expect(actual!.scoreTotal).toBe(16);
        expect(actual!.componentes).toEqual({ reportes: 1, casos: 2, alertas: 3, sesiones: 4 });
        expect(actual!.pesos).toEqual({ reportes: 3, casos: 5, alertas: 2, sesiones: 1 });
        expect(actual!.percentilEnCohorte).toBe(50);
        expect(historico).toHaveLength(1);
    });

    it("limita el histórico a 12 períodos en orden descendente", async () => {
        const suscripcion = await crearSuscripcionPadre();
        // 14 períodos: 2025-01 .. 2026-02
        for (let i = 0; i < 14; i += 1) {
            const anio = 2025 + Math.floor(i / 12);
            const mes = (i % 12) + 1;
            await crearSnapshot(suscripcion.id, `${anio}-${String(mes).padStart(2, "0")}`, i);
        }

        const { historico } = await new AnalisisRepository().obtenerScoreCliente(suscripcion.id);

        expect(historico).toHaveLength(12);
        expect(historico[0]!.periodo).toBe("2026-02");
        expect(historico[11]!.periodo).toBe("2025-03");
        for (let i = 1; i < historico.length; i += 1) {
            expect(historico[i]!.periodo < historico[i - 1]!.periodo).toBe(true);
        }
    });
});

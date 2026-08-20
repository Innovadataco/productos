#!/usr/bin/env node
/**
 * SPEC-185 (I-64): reparación de corridas del simulador de abusos.
 *
 * El worker antiguo intentaba escribir `fechaFin` (columna inexistente) al
 * finalizar, lo que provocaba que corridas exitosas quedaran marcadas como
 * FALLIDA a pesar de tener progreso=totalReportes.
 *
 * Este script one-shot e idempotente marca como COMPLETADA las corridas que:
 * - Tienen estado FALLIDA
 * - Tienen progreso == totalReportes (todos los intentos ejecutados)
 * - Fueron creadas después del momento del bug (configurable, default 2026-08-20 15:00:00 UTC)
 */

import { prisma } from "../src/lib/prisma.ts";
import { logAudit } from "../src/lib/audit.ts";

const DATABASE_URL = process.env.DATABASE_URL;

const CORTE_DEFAULT = "2026-08-20T15:00:00.000Z";

function obtenerCorte() {
    const corteStr = process.env.REPARAR_SIM_CORTE ?? CORTE_DEFAULT;
    const corte = new Date(corteStr);
    if (Number.isNaN(corte.getTime())) {
        throw new Error(`REPARAR_SIM_CORTE no es una fecha válida: ${corteStr}`);
    }
    return corte;
}

export async function repararSimulacionesFechaFin() {
    const corte = obtenerCorte();
    const candidatas = await prisma.simulacionAbusoRun.findMany({
        where: {
            estado: "FALLIDA",
            creadoEn: { gt: corte },
        },
        select: { id: true, creadoPorId: true, escenario: true, progreso: true, totalReportes: true },
    });

    const aReparar = candidatas.filter((run) => run.progreso === run.totalReportes);

    for (const run of aReparar) {
        await prisma.simulacionAbusoRun.update({
            where: { id: run.id },
            data: { estado: "COMPLETADA" },
        });
        await logAudit({
            accion: "SIMULACION_ABUSO_COMPLETADA",
            tipoRecurso: "SimulacionAbusoRun",
            recursoId: run.id,
            usuarioId: run.creadoPorId,
            valorAnterior: "FALLIDA",
            valorNuevo: JSON.stringify({
                estado: "COMPLETADA",
                razon: "reparacion_I64_fechaFin_inexistente",
                progreso: run.progreso,
                totalReportes: run.totalReportes,
            }),
        });
    }

    return {
        reparadas: aReparar.length,
        detalles: aReparar.map((run) => ({ id: run.id, escenario: run.escenario })),
    };
}

async function main() {
    if (!DATABASE_URL) {
        console.error("[REPARAR-SIMULACIONES] ERROR: DATABASE_URL no configurada");
        process.exit(1);
    }

    const { reparadas, detalles } = await repararSimulacionesFechaFin();
    const corte = obtenerCorte();

    console.log(`[REPARAR-SIMULACIONES] ${reparadas} corrida(s) FALLIDA(s) con progreso completo reparada(s) desde ${corte.toISOString()}.`);
    for (const d of detalles) {
        console.log(`[REPARAR-SIMULACIONES] Run ${d.id} (${d.escenario}) reparada a COMPLETADA.`);
    }

    await prisma.$disconnect();
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((err) => {
        console.error("[REPARAR-SIMULACIONES] Fatal:", err.message);
        process.exit(1);
    });
}

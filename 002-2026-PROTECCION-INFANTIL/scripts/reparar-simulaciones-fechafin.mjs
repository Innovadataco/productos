#!/usr/bin/env node
/**
 * SPEC-185 (I-64): reparación de corridas del simulador de abusos.
 *
 * `SimulacionAbusoRun` no tiene columna `fechaFin`; el estado es la única
 * señal de terminación. Este script encuentra corridas que quedaron atascadas
 * en `EN_PROGRESO` (sin heartbeat) y las marca como `FALLIDA`, registrando la
 * acción en `AuditLog`.
 */

import { prisma } from "../src/lib/prisma.ts";
import { logAudit } from "../src/lib/audit.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("[REPARAR-SIMULACIONES] ERROR: DATABASE_URL no configurada");
    process.exit(1);
}

const UMBRAL_MINUTOS = Number(process.env.REPARAR_SIM_UMBRAL_MINUTOS ?? "60");

async function main() {
    const corte = new Date(Date.now() - UMBRAL_MINUTOS * 60 * 1000);
    const atascadas = await prisma.simulacionAbusoRun.findMany({
        where: {
            estado: "EN_PROGRESO",
            actualizadoEn: { lt: corte },
        },
        select: { id: true, creadoPorId: true, escenario: true },
    });

    console.log(`[REPARAR-SIMULACIONES] ${atascadas.length} corrida(s) atascadas encontradas (sin actualización en ${UMBRAL_MINUTOS} min).`);

    for (const run of atascadas) {
        await prisma.simulacionAbusoRun.update({
            where: { id: run.id },
            data: { estado: "FALLIDA" },
        });
        await logAudit({
            accion: "SIMULACION_ABUSO_COMPLETADA",
            tipoRecurso: "SimulacionAbusoRun",
            recursoId: run.id,
            usuarioId: run.creadoPorId,
            valorNuevo: JSON.stringify({ estado: "FALLIDA", razon: `reparacion_automatica_${UMBRAL_MINUTOS}min` }),
        });
        console.log(`[REPARAR-SIMULACIONES] Run ${run.id} (${run.escenario}) marcada como FALLIDA.`);
    }

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error("[REPARAR-SIMULACIONES] Fatal:", err.message);
    process.exit(1);
});

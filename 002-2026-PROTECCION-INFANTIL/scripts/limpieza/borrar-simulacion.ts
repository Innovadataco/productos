/**
 * SPEC-265 (002-PI-168) — borra UNA simulación y sus reportes derivados.
 *
 * Uso (dry-run):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-simulacion.ts \
 *     --id=<simulacionId> --motivo="limpieza tras experimento X"
 *
 * Uso (borrado real):
 *   node --env-file=.env --import tsx scripts/limpieza/borrar-simulacion.ts \
 *     --id=<simulacionId> --motivo="limpieza tras experimento X" --confirm
 *
 * Diferencia con scripts/simulacion/purgar-simulaciones.sql: aquel borra TODAS,
 * este permite borrar UNA por id.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { parseArgs, requerirMotivo, registrarAuditoria, log } from "./_common";

export interface ResultadoBorrarSimulacion {
    simulacionId: string;
    filasBorradas: number;
    detalle: { simulacionRun: number; simulacionReporte: number; reportesDerivados: number };
    dryRun: boolean;
}

export async function borrarSimulacion(
    simulacionId: string,
    motivo: string,
    opts: { confirm: boolean; client?: PrismaClient } = { confirm: false },
): Promise<ResultadoBorrarSimulacion> {
    const client = opts.client ?? prisma;

    const run = await client.simulacionRun.findUnique({
        where: { id: simulacionId },
        select: { id: true, modelo: true },
    });
    if (!run) throw new Error(`[borrar-simulacion] SimulacionRun no encontrada: ${simulacionId}`);

    const casos = await client.simulacionReporte.findMany({
        where: { simulacionRunId: simulacionId },
        select: { reporteId: true },
    });
    const reporteIds = casos.map((c) => c.reporteId);

    if (!opts.confirm) {
        log("borrar-simulacion", `DRY-RUN simulacion=${simulacionId} modelo=${run.modelo}`);
        log("borrar-simulacion", `  · SimulacionReporte: ${casos.length}`);
        log("borrar-simulacion", `  · Reportes derivados: ${reporteIds.length}`);
        log("borrar-simulacion", "  · SimulacionRun: 1 (cascade a SimulacionReporte)");
        return {
            simulacionId,
            filasBorradas: 0,
            detalle: { simulacionRun: 1, simulacionReporte: casos.length, reportesDerivados: reporteIds.length },
            dryRun: true,
        };
    }

    return client.$transaction(async (tx) => {
        const runDel = await tx.simulacionRun.delete({ where: { id: simulacionId } });
        const reps = await tx.reporte.deleteMany({ where: { id: { in: reporteIds } } });

        const detalle = {
            simulacionRun: runDel ? 1 : 0,
            simulacionReporte: casos.length,
            reportesDerivados: reps.count,
        };
        const total = Object.values(detalle).reduce((a, b) => a + b, 0);

        await registrarAuditoria(tx, "simulacion", motivo, total, [simulacionId]);
        log("borrar-simulacion", `REALIZADO simulacion=${simulacionId} filas=${total}`);
        return { simulacionId, filasBorradas: total, detalle, dryRun: false };
    });
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);
    const id = typeof args.id === "string" ? args.id : "";
    if (!id) throw new Error("[borrar-simulacion] Falta --id=<simulacionId>");
    const motivo = requerirMotivo(typeof args.motivo === "string" ? args.motivo : undefined);
    const confirm = args.confirm === true;
    await borrarSimulacion(id, motivo, { confirm });
}

if (process.argv[1]?.endsWith("borrar-simulacion.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[borrar-simulacion] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

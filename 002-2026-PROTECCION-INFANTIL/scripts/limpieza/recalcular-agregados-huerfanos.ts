/**
 * SPEC-870 (I-446) — RECALCULA el agregado público `IdentificadorReportado` desde sus reportes
 * VIVOS, para cada fila. Cierra el drift histórico: filas cuyos reportes se purgaron/dieron de baja
 * antes de que el recálculo estuviera cableado quedaron con `score`/`esVisiblePublicamente` colgados
 * (un identificador «de riesgo» en la consulta pública SIN un solo reporte detrás).
 *
 * MECANISMO — reúsa los escritores VIVOS (D-72, cero lógica nueva):
 *   `recalcularYGuardarScore` (computa sobre `whereReporteAprobado` = NO eliminados + aprobados, y
 *   excluye simulacro) + `actualizarVisibilidadPublica` (decide visibilidad sobre el agregado ya
 *   recalculado). Una fila huérfana → totales/score 0 y `esVisiblePublicamente=false` («zero+hide»).
 *
 * NUNCA BORRA la fila (decisión CEO SPEC-870): una fila report-less puede ser INTENCIONAL (p.ej.
 * PA-16, sembrada sin reporte propio). Zero+hide la vuelve inofensiva sin destruir el registro.
 *
 * IDEMPOTENTE: re-ejecutar no cambia una fila ya consistente. ATÓMICO POR FILA (no un `$transaction`
 * gigante): una fila que falle no envenena a las sanas; se atrapa, se reporta y el `exitCode` sale ≠0
 * si alguna falló (verificación por exit code, no por grep).
 *
 * Uso (dry-run, no escribe — solo cuenta cuántas cambiarían):
 *   node --env-file=.env --import tsx scripts/limpieza/recalcular-agregados-huerfanos.ts
 * Uso (aplica):
 *   node --env-file=.env --import tsx scripts/limpieza/recalcular-agregados-huerfanos.ts --confirm
 *
 * La CORRIDA real contra PROD la ejecuta el responsable (CEO/Jelkin) — este script es la herramienta,
 * no el acto. Solo-lectura en dry-run; la escritura exige `--confirm`.
 */
import { prisma } from "../../src/lib/prisma";
import { recalcularYGuardarScore } from "../../src/lib/scoring";
import { actualizarVisibilidadPublica } from "../../src/lib/visibility";
import { parseArgs, log } from "./_common";

export interface ResultadoRecalculo {
    total: number;
    cambiadas: number;
    huerfanasOcultadas: number;
    fallidas: Array<{ identificador: string; plataformaId: string; error: string }>;
    dryRun: boolean;
}

/** Recalcula TODAS las filas de `IdentificadorReportado` desde sus reportes vivos. */
export async function recalcularAgregadosHuerfanos(opts: { confirm: boolean } = { confirm: false }): Promise<ResultadoRecalculo> {
    const filas = await prisma.identificadorReportado.findMany({
        select: {
            identificador: true,
            plataformaId: true,
            score: true,
            reportesAprobados: true,
            esVisiblePublicamente: true,
        },
    });

    const fallidas: ResultadoRecalculo["fallidas"] = [];
    let cambiadas = 0;
    let huerfanasOcultadas = 0;

    for (const fila of filas) {
        // ¿cuántos reportes VIVOS (no eliminados) respaldan este agregado? Solo para el reporte/log;
        // el recálculo real lo hace `recalcularYGuardarScore` con su propio predicado de aprobados.
        const vivos = await prisma.reporte.count({
            where: { identificador: fila.identificador, plataformaId: fila.plataformaId, eliminado: false },
        });
        const eraVisible = fila.esVisiblePublicamente;

        if (!opts.confirm) {
            // DRY-RUN: predecir si cambiaría. Una fila con 0 vivos y (visible o score>0) es huérfana.
            if (vivos === 0 && (fila.esVisiblePublicamente || fila.score > 0)) {
                huerfanasOcultadas += 1;
                cambiadas += 1;
                log("recalcular-agregados", `DRY-RUN HUÉRFANA ${fila.identificador}@${fila.plataformaId}: vivos=0, score=${fila.score}, visible=${fila.esVisiblePublicamente} → iría a 0+oculto`);
            }
            continue;
        }

        try {
            // Reúso de los escritores vivos (atómico por fila). recalcular → agregado; visibilidad lee
            // el agregado recalculado. NO borramos la fila (PA-16).
            await recalcularYGuardarScore(fila.identificador, fila.plataformaId);
            await actualizarVisibilidadPublica(fila.identificador, fila.plataformaId);

            const despues = await prisma.identificadorReportado.findUnique({
                where: { identificador_plataformaId: { identificador: fila.identificador, plataformaId: fila.plataformaId } },
                select: { score: true, esVisiblePublicamente: true },
            });
            if (despues && (despues.score !== fila.score || despues.esVisiblePublicamente !== fila.esVisiblePublicamente)) {
                cambiadas += 1;
                if (eraVisible && !despues.esVisiblePublicamente) huerfanasOcultadas += 1;
                log("recalcular-agregados", `AJUSTADA ${fila.identificador}@${fila.plataformaId}: score ${fila.score}→${despues.score}, visible ${fila.esVisiblePublicamente}→${despues.esVisiblePublicamente} (vivos=${vivos})`);
            }
        } catch (err) {
            fallidas.push({ identificador: fila.identificador, plataformaId: fila.plataformaId, error: err instanceof Error ? err.message : String(err) });
            log("recalcular-agregados", `FALLÓ ${fila.identificador}@${fila.plataformaId}: ${err instanceof Error ? err.message : err}`);
        }
    }

    log("recalcular-agregados", `${opts.confirm ? "REALIZADO" : "DRY-RUN"}: total=${filas.length} cambiadas=${cambiadas} huérfanas-ocultadas=${huerfanasOcultadas} fallidas=${fallidas.length}`);
    return { total: filas.length, cambiadas, huerfanasOcultadas, fallidas, dryRun: !opts.confirm };
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv, ["confirm"]);
    const confirm = args.confirm === true;
    const resultado = await recalcularAgregadosHuerfanos({ confirm });
    if (resultado.fallidas.length > 0) {
        // Verificación por EXIT CODE, no por grep de la salida.
        process.exitCode = 1;
    }
}

if (process.argv[1]?.endsWith("recalcular-agregados-huerfanos.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[recalcular-agregados] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

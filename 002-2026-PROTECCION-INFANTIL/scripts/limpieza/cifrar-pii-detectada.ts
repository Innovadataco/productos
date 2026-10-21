/**
 * SPEC-904 (I-422 · Ley 1581) — corrector de migración: mueve la PII literal que quedó en la
 * columna plana `ClasificacionIA.piiDetectada` al campo CIFRADO `ContenidoReporte.piiDetectadaCifrado`
 * (bajo la DEK por denuncia), dejando la columna plana en `[]`. La corre el responsable contra prod
 * tras el deploy del schema (el escritor ya cifra desde este deploy; esto sanea las filas VIEJAS).
 *
 * CUENTA primero. Por cada fila con `piiDetectada` NO vacía:
 *   - reporte ACTIVO → CIFRA el literal (no se pierde PII legítimamente necesaria) + plana `[]`.
 *   - reporte ELIMINADO (baja) → LIMPIA (plana `[]` + cifrado `null`): no se re-introduce PII que la
 *     baja (SPEC-892) ya debía haber purgado.
 *
 * Idempotente (una 2ª corrida encuentra 0 filas no vacías), fila-POR-fila en su propia tx (una fila
 * que reviente NO aborta a las sanas; lección del corrector en lote), exit≠0 si alguna falla.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/limpieza/cifrar-pii-detectada.ts            # dry-run
 *   node --env-file=.env --import tsx scripts/limpieza/cifrar-pii-detectada.ts --confirm  # aplica
 */
import { prisma } from "../../src/lib/prisma";
import { sellarPiiDetectada, purgarPiiDetectada } from "../../src/lib/reporte-texto-contenido";

const APLICAR = process.argv.includes("--confirm");

async function main(): Promise<void> {
    const filas = await prisma.clasificacionIA.findMany({
        where: { piiDetectada: { isEmpty: false } },
        select: {
            id: true,
            reporteId: true,
            piiDetectada: true,
            reporte: { select: { contenidoId: true, eliminado: true } },
        },
    });

    const activas = filas.filter((f) => !f.reporte.eliminado);
    const eliminadas = filas.filter((f) => f.reporte.eliminado);
    console.log(
        `[cifrar-pii] ${filas.length} ClasificacionIA con piiDetectada NO vacía — ` +
            `${activas.length} activas (CIFRAR) · ${eliminadas.length} eliminadas (LIMPIAR). ` +
            `Modo ${APLICAR ? "REAL" : "DRY-RUN"}.`,
    );

    if (!APLICAR) {
        console.log("[cifrar-pii] DRY-RUN: no se tocó nada. Re-lanzá con --confirm para aplicar.");
        return;
    }

    let fallos = 0;
    for (const f of filas) {
        try {
            await prisma.$transaction(async (tx) => {
                if (f.reporte.eliminado) {
                    // Baja: no re-introducir PII; dejar plana [] + cifrado null (cripto-shred del campo).
                    await purgarPiiDetectada(tx, f.reporte.contenidoId);
                } else {
                    // Activo: preservar el literal CIFRADO bajo la DEK del reporte.
                    await sellarPiiDetectada(tx, f.reporte.contenidoId, f.piiDetectada);
                }
                await tx.clasificacionIA.update({ where: { id: f.id }, data: { piiDetectada: [] } });
            });
        } catch (error) {
            fallos++;
            console.error(`[cifrar-pii] FALLO id=${f.id} reporte=${f.reporteId}: ${error instanceof Error ? error.message : error}`);
        }
    }

    console.log(`[cifrar-pii] REALIZADO: ${filas.length - fallos} filas saneadas, ${fallos} fallos.`);
    if (fallos > 0) process.exitCode = 1;
}

const esEjecucionDirecta = typeof process.argv[1] === "string" && process.argv[1].endsWith("cifrar-pii-detectada.ts");
if (esEjecucionDirecta) {
    main()
        .catch((error) => {
            console.error("[cifrar-pii] Error:", error instanceof Error ? error.message : error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}

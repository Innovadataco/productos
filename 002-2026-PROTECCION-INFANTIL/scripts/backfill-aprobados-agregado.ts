/**
 * SPEC-131 (BL-5, FR-005) — Backfill/verificación de contadores aprobados.
 * Recomputa `reportesAprobados` y `autenticadosAprobados` de TODOS los agregados
 * con el predicado único aprobado (spec 089/D-08) y corrige los que difieran.
 * IDEMPOTENTE: solo escribe cuando el valor difiere (segunda corrida = 0 cambios).
 * La migración Prisma 20260801120000 ya incluye el backfill SQL inicial (O-1);
 * este script es la verificación/reparación re-corrible por entorno.
 *
 * Uso: node --env-file=.env --import tsx scripts/backfill-aprobados-agregado.ts
 */
import { prisma } from "../src/lib/prisma";
import { whereReporteAprobado } from "../src/lib/reportes-acceso";

const LOTE = 200;

async function main() {
    let revisados = 0;
    let corregidos = 0;
    let procesados = 0;

    for (;;) {
        const agregados = await prisma.identificadorReportado.findMany({
            orderBy: { creadoEn: "asc" },
            skip: procesados,
            take: LOTE,
        });
        if (agregados.length === 0) break;

        for (const agregado of agregados) {
            const [aprobados, autenticados] = await Promise.all([
                prisma.reporte.count({
                    where: whereReporteAprobado({ identificador: agregado.identificador, plataformaId: agregado.plataformaId }),
                }),
                prisma.reporte.count({
                    where: whereReporteAprobado({ identificador: agregado.identificador, plataformaId: agregado.plataformaId, esAnonimo: false }),
                }),
            ]);

            revisados++;
            if (agregado.reportesAprobados !== aprobados || agregado.autenticadosAprobados !== autenticados) {
                await prisma.identificadorReportado.update({
                    where: { id: agregado.id },
                    data: { reportesAprobados: aprobados, autenticadosAprobados: autenticados },
                });
                corregidos++;
            }
        }

        procesados += agregados.length;
        console.log(`[BackfillAprobados] Lote: ${procesados} agregados…`);
    }

    console.log(`[BackfillAprobados] RESUMEN: revisados=${revisados} corregidos=${corregidos}`);
}

main()
    .catch((err: unknown) => {
        console.error("[BackfillAprobados] Error:", err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

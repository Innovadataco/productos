/**
 * SPEC-870 (I-446) — CLI del detector BLANDO de agregados huérfanos. SOLO LECTURA contra la BD viva.
 * Imprime los `IdentificadorReportado` con presencia pública (visible/score/aprobados) y CERO reportes
 * vivos — el drift que el corrector `recalcular-agregados-huerfanos.ts` repara.
 *
 * Uso:
 *   node --env-file=.env --import tsx scripts/limpieza/detectar-agregados-huerfanos.ts
 *
 * BLANDO: sale 0 aunque encuentre huérfanos (vigilancia, no gate). La CORRIDA contra PROD la ejecuta
 * el responsable; la lógica vive en `src/lib/dal/services/agregados-huerfanos.ts` y la prueba su candado.
 */
import { prisma } from "../../src/lib/prisma";
import { detectarAgregadosHuerfanos } from "../../src/lib/dal/services/agregados-huerfanos";
import { log } from "./_common";

async function main(): Promise<void> {
    const huerfanos = await detectarAgregadosHuerfanos(prisma);
    log("detectar-agregados", `Agregados huérfanos (presencia pública sin reporte vivo): ${huerfanos.length}`);
    for (const h of huerfanos) {
        log("detectar-agregados", `  · ${h.identificador}@${h.plataformaId}: score=${h.score} aprobados=${h.reportesAprobados} visible=${h.esVisiblePublicamente}`);
    }
    if (huerfanos.length > 0) {
        log("detectar-agregados", "Reparar con: scripts/limpieza/recalcular-agregados-huerfanos.ts --confirm");
    }
}

if (process.argv[1]?.endsWith("detectar-agregados-huerfanos.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[detectar-agregados] Error:", err instanceof Error ? err.message : err);
            process.exitCode = 1;
        })
        .finally(() => prisma.$disconnect());
}

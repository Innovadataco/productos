/**
 * SPEC-870 (I-446) — DETECTOR BLANDO de agregados públicos HUÉRFANOS.
 *
 * Un `IdentificadorReportado` es HUÉRFANO si afirma presencia pública (`esVisiblePublicamente=true`
 * O `score>0` O `reportesAprobados>0`) pero NO tiene ningún reporte VIVO (no eliminado) que lo
 * respalde — un identificador «de riesgo» en la consulta pública sin evidencia detrás (I-446).
 *
 * SOLO LECTURA: no muta nada (lo arregla el corrector `scripts/limpieza/recalcular-agregados-huerfanos.ts`).
 * BLANDO: si la BD viva arranca con huérfanos, esto los REPORTA — NO es un gate duro que rompa el
 * build (el candado prueba la conducta sobre BD fresca con una fila plantada; contra PROD es vigilancia).
 */
import type { DbClient } from "../unit-of-work";

export interface AgregadoHuerfano {
    identificador: string;
    plataformaId: string;
    score: number;
    reportesAprobados: number;
    esVisiblePublicamente: boolean;
}

/**
 * Lista los agregados huérfanos (presencia pública sin reporte vivo). El predicado «presencia» es
 * amplio a propósito (visible O score O aprobados): cualquiera de los tres sin evidencia viva ya es
 * el defecto de I-446. Dos pasos (candidatos por presencia → filtra por 0 reportes vivos) en vez de
 * un `NOT EXISTS` crudo, para conservar el `select` tipado; el volumen es bajo (decenas de filas).
 */
export async function detectarAgregadosHuerfanos(db: DbClient): Promise<AgregadoHuerfano[]> {
    const candidatos = await db.identificadorReportado.findMany({
        where: {
            OR: [{ esVisiblePublicamente: true }, { score: { gt: 0 } }, { reportesAprobados: { gt: 0 } }],
        },
        select: { identificador: true, plataformaId: true, score: true, reportesAprobados: true, esVisiblePublicamente: true },
    });

    const huerfanos: AgregadoHuerfano[] = [];
    for (const c of candidatos) {
        const vivos = await db.reporte.count({
            where: { identificador: c.identificador, plataformaId: c.plataformaId, eliminado: false },
        });
        if (vivos === 0) huerfanos.push(c);
    }
    return huerfanos;
}

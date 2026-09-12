// src/lib/bi/segmentacion.ts · Segmentación «no es trabajo real» del universo Reporte
// Producto 006 · BI v2 · 2026-09-12
//
// Predicado canónico (CEO 12-09-2026): un reporte NO es trabajo real si
// tiene marca en demo_marcado O existe una fila en simulacion_reportes con
// su reporteId (el ejecutor de simulación crea Reporte REALES que corren los
// tres modelos — no llevan marca de siembra; sin el segundo término se
// colarían como reales). El cero de simulados se lee como «aún no pasa»,
// no como «sobra el término» — por eso el banner muestra el desglose.
//
// OJO (lección de PI, meses en debug): el nombre físico de la tabla es
// demo_marcado, NO DemoMarcado — escribir el del modelo en SQL crudo
// revienta la lectura, y un allSettled se traga el error en silencio.

import { prisma } from "@/lib/db";

export interface SegmentacionData {
    /** Reportes no eliminados en la réplica */
    total: number;
    /** Con marca de siembra (demo_marcado, entidad='Reporte') */
    marcados: number;
    /** Creados por el ejecutor de simulación (simulacion_reportes) */
    simulados: number;
    /** Predicado OR: lo que NO es trabajo real */
    demo: number;
    /** demo/total × 100, 1 decimal */
    pctDemo: number;
}

/**
 * Composición demo/real del universo Reporte. Sin try/catch adentro: el
 * banner (server component) degrada a no-render si la consulta falla
 * (candado 9: el hueco se dice, no se disfraza de cero).
 */
export async function getSegmentacion(): Promise<SegmentacionData> {
    const filas = await prisma.$queryRaw<{
        total: number;
        marcados: number;
        simulados: number;
        demo: number;
    }[]>`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE dm."entidadId" IS NOT NULL)::int AS marcados,
               count(*) FILTER (WHERE sr."reporteId" IS NOT NULL)::int AS simulados,
               count(*) FILTER (WHERE dm."entidadId" IS NOT NULL OR sr."reporteId" IS NOT NULL)::int AS demo
          FROM "Reporte" r
          LEFT JOIN demo_marcado dm ON dm.entidad = 'Reporte' AND dm."entidadId" = r.id
          LEFT JOIN simulacion_reportes sr ON sr."reporteId" = r.id
         WHERE r."eliminado" = false`;
    const f = filas[0] ?? { total: 0, marcados: 0, simulados: 0, demo: 0 };
    return {
        ...f,
        pctDemo: f.total > 0 ? Math.round((f.demo / f.total) * 1000) / 10 : 0,
    };
}

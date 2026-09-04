// src/lib/bi/comite.ts · Capa de datos de Comité (BI v2 · Lote B)
// Producto 006 · BI v2
//
// Alimenta la pestaña "Comité" (escalamientos, resolución y tiempos) con
// datos REALES de la réplica: SolicitudComite (volumen, estados, mediana de
// horas hasta resolución), TransicionReporte (embudo: qué tan profundo llega
// un caso) y AlertaColegio (escaladas por estado). Todo agregado; sin PII.
//
// Alcance deliberado: las apelaciones (Ley 1581) NO se replican — la tabla
// Apelacion está prohibida en la publicación (gobierno). La fila legal no se
// simula: esta página mide la operación del comité, no las disputas.
//
// Candado 9: cada sondeo degrada a vacío con warn; candado 10: toda cifra del
// ResultSet. Comparaciones de estado en minúscula (no se da casing por supuesto).

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI de Comité ─────────────────────────────────────
export interface ComiteData {
    kpis: {
        pendientes: number;
        /** Pendientes con más de 48 h desde su creación — requieren atención */
        pendientesMas48h: number;
        resueltasMes: number;
        /** Mediana de horas creadoEn → resueltoEn (solicitudes resueltas) */
        medianaHoras: number | null;
        /** % de resueltas en el mes que cerraron en ≤ 24 h */
        dentroSlaPct: number | null;
        alertasEscaladasAbiertas: number;
    };
    /** Embudo: de los reportes que entran, cuántos llegan al comité y se cierran */
    embudo: {
        reportes: number;
        pasaronRevisionManual: number;
        escalados: number;
        resueltos: number;
    };
    /** Solicitudes creadas por semana (últimas 8) con su mediana de horas */
    porSemana: { semana: string; creadas: number; resueltas: number; medianaHoras: number | null }[];
    /** Distribución de estados de todas las solicitudes */
    porEstado: { estado: string; total: number }[];
    /** Carga activa por comité (cuenta compartida de plataforma o colegio) */
    cargaPorComite: { comite: string; activas: number; medianaHoras: number | null }[];
    /** Alertas de colegio escaladas, por estado */
    alertasPorEstado: { estado: string; total: number }[];
}

// ─── Filas crudas ────────────────────────────────────────────────────────────
interface FilaKpis {
    pendientes: number;
    pendientes_mas48h: number;
    resueltas_mes: number;
    mediana_horas: number | null;
    dentro_sla_pct: number | null;
    alertas_escaladas: number;
}
interface FilaEmbudo {
    reportes: number;
    revision_manual: number;
    escalados: number;
    resueltos: number;
}
interface FilaSemana {
    semana: string;
    creadas: number;
    resueltas: number;
    mediana_horas: number | null;
}
interface FilaEstado {
    estado: string;
    total: number;
}
interface FilaCarga {
    comite: string;
    activas: number;
    mediana_horas: number | null;
}

const KPIS_VACIOS: FilaKpis = {
    pendientes: 0,
    pendientes_mas48h: 0,
    resueltas_mes: 0,
    mediana_horas: null,
    dentro_sla_pct: null,
    alertas_escaladas: 0,
};
const EMBUDO_VACIO: FilaEmbudo = { reportes: 0, revision_manual: 0, escalados: 0, resueltos: 0 };

async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Comite] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Datos de Comité. Sondeos independientes en paralelo; mediana con
 * percentile_cont (0.5) sobre horas reales creadoEn→resueltoEn.
 */
export async function getComite(): Promise<ComiteData> {
    const [filasKpis, filasEmbudo, filasSemana, filasEstado, filasCarga, filasAlertas] =
        await Promise.all([
            intentar(
                "kpis",
                prisma.$queryRaw<FilaKpis[]>`
                    SELECT
                      (SELECT count(*) FROM "SolicitudComite"
                        WHERE lower("estado") = 'pendiente')::int AS pendientes,
                      (SELECT count(*) FROM "SolicitudComite"
                        WHERE lower("estado") = 'pendiente'
                          AND "creadoEn" < now() - interval '48 hours')::int
                        AS pendientes_mas48h,
                      (SELECT count(*) FROM "SolicitudComite"
                        WHERE "resueltoEn" >= date_trunc('month', now()))::int AS resueltas_mes,
                      (SELECT percentile_cont(0.5) WITHIN GROUP (
                                 ORDER BY EXTRACT(EPOCH FROM ("resueltoEn" - "creadoEn")) / 3600.0)
                        FROM "SolicitudComite"
                        WHERE "resueltoEn" IS NOT NULL)::float AS mediana_horas,
                      (SELECT round(100.0 * count(*) FILTER (
                                 WHERE "resueltoEn" - "creadoEn" <= interval '24 hours')
                                 / NULLIF(count(*), 0), 1)
                        FROM "SolicitudComite"
                        WHERE "resueltoEn" >= date_trunc('month', now())
                          AND "resueltoEn" IS NOT NULL)::float AS dentro_sla_pct,
                      (SELECT count(*) FROM "AlertaColegio"
                        WHERE lower("estado") = 'escalada')::int AS alertas_escaladas`,
            ),
            intentar(
                "embudo",
                prisma.$queryRaw<FilaEmbudo[]>`
                    SELECT
                      (SELECT count(*) FROM "Reporte" WHERE "eliminado" = false)::int AS reportes,
                      (SELECT count(DISTINCT "reporteId") FROM "TransicionReporte"
                        WHERE lower("estadoNuevo"::text) = 'revision_manual')::int AS revision_manual,
                      (SELECT count(*) FROM "SolicitudComite")::int AS escalados,
                      (SELECT count(*) FROM "SolicitudComite"
                        WHERE "resueltoEn" IS NOT NULL)::int AS resueltos`,
            ),
            intentar(
                "por-semana",
                prisma.$queryRaw<FilaSemana[]>`
                    SELECT to_char(semana, '"'"'IYYY-"W"IW'"'"') AS semana,
                           count(*) FILTER (WHERE s."creadoEn" >= semana
                                            AND s."creadoEn" < semana + interval '7 days')::int
                             AS creadas,
                           count(*) FILTER (WHERE s."resueltoEn" >= semana
                                            AND s."resueltoEn" < semana + interval '7 days')::int
                             AS resueltas,
                           (SELECT percentile_cont(0.5) WITHIN GROUP (
                                     ORDER BY EXTRACT(EPOCH FROM (s2."resueltoEn" - s2."creadoEn")) / 3600.0)
                              FROM "SolicitudComite" s2
                             WHERE s2."resueltoEn" >= semana
                               AND s2."resueltoEn" < semana + interval '7 days')::float
                             AS mediana_horas
                    FROM generate_series(
                           date_trunc('week', now()) - interval '7 weeks',
                           date_trunc('week', now()),
                           interval '1 week'
                         ) AS g(semana)
                    LEFT JOIN "SolicitudComite" s
                      ON (s."creadoEn" >= semana AND s."creadoEn" < semana + interval '7 days')
                      OR (s."resueltoEn" >= semana AND s."resueltoEn" < semana + interval '7 days')
                    GROUP BY semana
                    ORDER BY semana`,
            ),
            intentar(
                "por-estado",
                prisma.$queryRaw<FilaEstado[]>`
                    SELECT "estado", count(*)::int AS total
                    FROM "SolicitudComite"
                    GROUP BY "estado"
                    ORDER BY total DESC, "estado"`,
            ),
            // Carga por comité: las cuentas compartidas de colegio resuelven su
            // nombre; las de plataforma quedan agrupadas como "validación".
            // comiteId es un cuid interno — no se imprime tal cual (no significa
            // nada para el lector); se distingue plataforma vs colegio.
            intentar(
                "carga-por-comite",
                prisma.$queryRaw<FilaCarga[]>`
                    SELECT CASE WHEN s."colegioId" IS NOT NULL
                                THEN 'Convivencia · ' || COALESCE(c."nombre", s."colegioId")
                                ELSE 'Validación · plataforma' END AS comite,
                           count(*)::int AS activas,
                           (SELECT percentile_cont(0.5) WITHIN GROUP (
                                     ORDER BY EXTRACT(EPOCH FROM (s2."resueltoEn" - s2."creadoEn")) / 3600.0)
                              FROM "SolicitudComite" s2
                             WHERE s2."resueltoEn" IS NOT NULL
                               AND ((s2."colegioId" IS NOT NULL) = (s."colegioId" IS NOT NULL))
                               AND (s2."colegioId" = s."colegioId"
                                    OR (s2."colegioId" IS NULL AND s."colegioId" IS NULL)))::float
                             AS mediana_horas
                    FROM "SolicitudComite" s
                    LEFT JOIN "Colegio" c ON c."id" = s."colegioId"
                    WHERE s."resueltoEn" IS NULL
                    GROUP BY CASE WHEN s."colegioId" IS NOT NULL
                                  THEN 'Convivencia · ' || COALESCE(c."nombre", s."colegioId")
                                  ELSE 'Validación · plataforma' END,
                             (s."colegioId" IS NOT NULL), s."colegioId"
                    ORDER BY activas DESC, comite`,
            ),
            intentar(
                "alertas-por-estado",
                prisma.$queryRaw<FilaEstado[]>`
                    SELECT "estado", count(*)::int AS total
                    FROM "AlertaColegio"
                    WHERE lower("estado") IN ('escalada','nueva','vista','gestionada')
                    GROUP BY "estado"
                    ORDER BY total DESC, "estado"`,
            ),
        ]);

    const k = filasKpis[0] ?? KPIS_VACIOS;
    const e = filasEmbudo[0] ?? EMBUDO_VACIO;

    return {
        kpis: {
            pendientes: k.pendientes,
            pendientesMas48h: k.pendientes_mas48h,
            resueltasMes: k.resueltas_mes,
            medianaHoras: k.mediana_horas,
            dentroSlaPct: k.dentro_sla_pct,
            alertasEscaladasAbiertas: k.alertas_escaladas,
        },
        embudo: {
            reportes: e.reportes,
            pasaronRevisionManual: e.revision_manual,
            escalados: e.escalados,
            resueltos: e.resueltos,
        },
        porSemana: filasSemana.map((f) => ({
            semana: f.semana,
            creadas: f.creadas,
            resueltas: f.resueltas,
            medianaHoras: f.mediana_horas,
        })),
        porEstado: filasEstado.map((f) => ({ estado: f.estado, total: f.total })),
        cargaPorComite: filasCarga.map((f) => ({
            comite: f.comite,
            activas: f.activas,
            medianaHoras: f.mediana_horas,
        })),
        alertasPorEstado: filasAlertas.map((f) => ({ estado: f.estado, total: f.total })),
    };
}

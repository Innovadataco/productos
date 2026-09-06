// src/lib/bi/salud-motor.ts · Capa de datos de Motor IA e infraestructura (BI v2 · Lote C)
// Producto 006 · BI v2
//
// Alimenta la pestaña "Motor": telemetría del pipeline de clasificación
// (ClasificacionIA, pasos_procesamiento, ReintentoReporte, CorreccionAdmin,
// DerivaMotorSnapshot) y salud de la infraestructura (HealthProbe,
// IncidenteInfra, worker_logs, cola visible como reportes sin clasificar).
// Todo sin PII: metadatos y latencias — el recorte vive en la publicación (02).
//
// Candado 9: cada sondeo degrada a vacío con warn y su tarjeta dice el vacío;
// candado 10: toda cifra del ResultSet. Estados/colas en minúscula.

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI de Motor ──────────────────────────────────────
export interface MotorData {
    kpis: {
        clasificaciones24h: number;
        confianzaMedia24h: number | null;
        /** Correcciones humanas del mes / clasificaciones del mes (%) */
        correccionMesPct: number | null;
        /** Latencia media del paso de clasificación, últimos 7 días (ms) */
        latenciaClasificacionMs: number | null;
        /** Reportes esperando procesamiento (PENDIENTE o PROCESANDO) */
        enCola: number;
        /** Atascados: en PROCESANDO hace más de 10 min */
        atascados: number;
        reintentos24h: number;
        reintentosFallidos24h: number;
    };
    /** Latencia media por etapa del pipeline, últimos 7 días (ms) */
    latenciaPorEtapa: { etapa: string; mediaMs: number; muestras: number }[];
    /** Deriva semanal: tasa de corrección promedio por semana (todas las categorías) */
    deriva: { semana: string; tasaCorreccionPct: number; categorias: number }[];
    /** Top categorías por correcciones confirmadas en el mes */
    topCorrecciones: { categoria: string; correcciones: number }[];
    /** Última señal conocida por servicio probado (app, worker, ollama, tailscale…) */
    infraPorSenal: {
        senal: string;
        ok: boolean;
        latenciaMs: number;
        metodo: string | null;
        haceMin: number;
    }[];
    /** Incidentes recientes (abiertos primero), máx 8. Sin `senal`: en
     * patrones coordinados era sha256 del texto del reporte (Ley 1581) y la
     * whitelist 2026-09-05 la cortó de la réplica (02). */
    incidentes: {
        estado: string;
        inicio: string;
        duracionMin: number | null;
    }[];
    /** Errores de worker_logs en las últimas 24 h, por servicio */
    erroresWorker24h: { servicio: string; errores: number }[];
}

// ─── Filas crudas ────────────────────────────────────────────────────────────
interface FilaKpis {
    clasif_24h: number;
    confianza_24h: number | null;
    correcciones_mes: number;
    clasif_mes: number;
    latencia_clasif_ms: number | null;
    en_cola: number;
    atascados: number;
    reintentos_24h: number;
    reintentos_fallidos_24h: number;
}
interface FilaEtapa {
    etapa: string;
    media_ms: number;
    muestras: number;
}
interface FilaDeriva {
    semana: string;
    tasa_pct: number;
    categorias: number;
}
interface FilaCorr {
    categoria: string;
    correcciones: number;
}
interface FilaSenal {
    senal: string;
    ok: boolean;
    latencia_ms: number;
    metodo: string | null;
    hace_min: number;
}
interface FilaIncidente {
    estado: string;
    inicio: string;
    duracion_min: number | null;
}
interface FilaErrorW {
    servicio: string;
    errores: number;
}

const KPIS_VACIOS: FilaKpis = {
    clasif_24h: 0,
    confianza_24h: null,
    correcciones_mes: 0,
    clasif_mes: 0,
    latencia_clasif_ms: null,
    en_cola: 0,
    atascados: 0,
    reintentos_24h: 0,
    reintentos_fallidos_24h: 0,
};

async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Motor] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Datos de Motor e infraestructura. Sondeos independientes en paralelo.
 * "última señal por servicio": DISTINCT ON, frescura en minutos reales.
 */
export async function getMotor(): Promise<MotorData> {
    const [filasKpis, filasEtapa, filasDeriva, filasCorr, filasSenal, filasIncidentes, filasErroresW] =
        await Promise.all([
            intentar(
                "kpis",
                prisma.$queryRaw<FilaKpis[]>`
                    SELECT
                      (SELECT count(*) FROM "ClasificacionIA"
                        WHERE "creadoEn" >= now() - interval '24 hours')::int AS clasif_24h,
                      (SELECT avg("confianza") FROM "ClasificacionIA"
                        WHERE "creadoEn" >= now() - interval '24 hours')::float AS confianza_24h,
                      (SELECT count(*) FROM "CorreccionAdmin"
                        WHERE "creadoEn" >= date_trunc('month', now())
                          AND "confirmada" = true)::int AS correcciones_mes,
                      (SELECT count(*) FROM "ClasificacionIA"
                        WHERE "creadoEn" >= date_trunc('month', now()))::int AS clasif_mes,
                      (SELECT avg("latenciaMs") FROM "pasos_procesamiento"
                        WHERE lower("etapa") LIKE '%decision%'
                          AND "creadoEn" >= now() - interval '7 days'
                          AND "latenciaMs" IS NOT NULL)::float AS latencia_clasif_ms,
                      (SELECT count(*) FROM "Reporte"
                        WHERE lower("estado"::text) IN ('pendiente','procesando')
                          AND "eliminado" = false)::int AS en_cola,
                      (SELECT count(*) FROM "Reporte"
                        WHERE lower("estado"::text) = 'procesando'
                          AND "eliminado" = false
                          AND "actualizadoEn" < now() - interval '10 minutes')::int AS atascados,
                      (SELECT count(*) FROM "ReintentoReporte"
                        WHERE "creadoEn" >= now() - interval '24 hours')::int AS reintentos_24h,
                      (SELECT count(*) FROM "ReintentoReporte"
                        WHERE "creadoEn" >= now() - interval '24 hours'
                          AND "exitoso" = false)::int AS reintentos_fallidos_24h`,
            ),
            intentar(
                "latencia-por-etapa",
                prisma.$queryRaw<FilaEtapa[]>`
                    SELECT "etapa", round(avg("latenciaMs"))::float AS media_ms,
                           count(*)::int AS muestras
                    FROM "pasos_procesamiento"
                    WHERE "creadoEn" >= now() - interval '7 days'
                      AND "latenciaMs" IS NOT NULL
                    GROUP BY "etapa"
                    ORDER BY media_ms DESC, "etapa"`,
            ),
            intentar(
                "deriva",
                prisma.$queryRaw<FilaDeriva[]>`
                    SELECT to_char("semanaInicio", 'YYYY-MM-DD') AS semana,
                           round(avg("tasaCorreccion") * 100, 1)::float AS tasa_pct,
                           count(*)::int AS categorias
                    FROM "DerivaMotorSnapshot"
                    GROUP BY "semanaInicio"
                    HAVING "semanaInicio" >= now() - interval '10 weeks'
                    ORDER BY "semanaInicio"`,
            ),
            intentar(
                "top-correcciones",
                prisma.$queryRaw<FilaCorr[]>`
                    SELECT COALESCE(ca."categoriaCorregida", ca."categoriaOriginal", 'Sin categoría') AS categoria,
                           count(*)::int AS correcciones
                    FROM "CorreccionAdmin" ca
                    WHERE ca."creadoEn" >= date_trunc('month', now())
                      AND ca."confirmada" = true
                    GROUP BY COALESCE(ca."categoriaCorregida", ca."categoriaOriginal", 'Sin categoría')
                    ORDER BY correcciones DESC, categoria
                    LIMIT 6`,
            ),
            intentar(
                "infra-por-senal",
                prisma.$queryRaw<FilaSenal[]>`
                    SELECT DISTINCT ON (h."senal") h."senal",
                           h."ok",
                           h."latenciaMs"::float AS latencia_ms,
                           h."metodo",
                           round(EXTRACT(EPOCH FROM (now() - h."creadoEn")) / 60)::int AS hace_min
                    FROM "HealthProbe" h
                    ORDER BY h."senal", h."creadoEn" DESC`,
            ),
            intentar(
                "incidentes",
                prisma.$queryRaw<FilaIncidente[]>`
                    SELECT "estado",
                           to_char("inicio", 'DD/MM/YYYY HH24:MI') AS inicio,
                           CASE WHEN "fin" IS NULL THEN NULL
                                ELSE round(EXTRACT(EPOCH FROM ("fin" - "inicio")) / 60)::int
                           END AS duracion_min
                    FROM "IncidenteInfra"
                    ORDER BY (lower("estado") = 'abierto') DESC, "inicio" DESC
                    LIMIT 8`,
            ),
            intentar(
                "errores-worker-24h",
                prisma.$queryRaw<FilaErrorW[]>`
                    SELECT "servicio", count(*)::int AS errores
                    FROM "worker_logs"
                    WHERE lower("nivel"::text) = 'error'
                      AND "creadoEn" >= now() - interval '24 hours'
                    GROUP BY "servicio"
                    ORDER BY errores DESC, "servicio"`,
            ),
        ]);

    const k = filasKpis[0] ?? KPIS_VACIOS;

    return {
        kpis: {
            clasificaciones24h: k.clasif_24h,
            confianzaMedia24h: k.confianza_24h,
            correccionMesPct:
                k.clasif_mes > 0
                    ? Math.round((k.correcciones_mes / k.clasif_mes) * 1000) / 10
                    : null,
            latenciaClasificacionMs: k.latencia_clasif_ms,
            enCola: k.en_cola,
            atascados: k.atascados,
            reintentos24h: k.reintentos_24h,
            reintentosFallidos24h: k.reintentos_fallidos_24h,
        },
        latenciaPorEtapa: filasEtapa.map((f) => ({
            etapa: f.etapa,
            mediaMs: f.media_ms,
            muestras: f.muestras,
        })),
        deriva: filasDeriva.map((f) => ({
            semana: f.semana,
            tasaCorreccionPct: f.tasa_pct,
            categorias: f.categorias,
        })),
        topCorrecciones: filasCorr.map((f) => ({
            categoria: f.categoria,
            correcciones: f.correcciones,
        })),
        infraPorSenal: filasSenal.map((f) => ({
            senal: f.senal,
            ok: f.ok,
            latenciaMs: f.latencia_ms,
            metodo: f.metodo,
            haceMin: f.hace_min,
        })),
        incidentes: filasIncidentes.map((f) => ({
            estado: f.estado,
            inicio: f.inicio,
            duracionMin: f.duracion_min,
        })),
        erroresWorker24h: filasErroresW.map((f) => ({
            servicio: f.servicio,
            errores: f.errores,
        })),
    };
}

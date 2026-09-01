// src/lib/bi/pulso.ts · Capa de datos del Pulso (Fase 3 · réplica real de PI)
// Producto 006 · BI v2
//
// Alimenta el dashboard "Pulso" (mockup-bi-v2.html) con datos REALES de la
// réplica read-only de PI: MVs mv_fact_* (scripts/replica-setup/05-mv-fact.sql)
// y tablas replicadas ("Reporte", "TransicionReporte", "Colegio",
// "ClasificacionIA"). El volumen real es pequeño: todo cálculo es honesto
// con pocos datos y con el vacío.
//
// Candado 9 (honestidad): toda cifra sale del ResultSet. Sin base de
// comparación el delta es NULL (la UI muestra "sin comparación", jamás un
// porcentaje inventado); el vacío se reporta como vacío (hayDatos=false).
// Candado 10: ninguna cifra se genera fuera de las filas devueltas.
//
// Queries: $queryRaw (forma parametrizada) con identificadores SIEMPRE
// citados. Conteos casteados a ::int (evita bigint no serializable) y
// promedios a ::float. Las ventanas temporales se calculan EN SQL
// (date_trunc/interval con la TZ de la sesión); en JS solo se computan
// DIFERENCIAS entre instantes (minutos/días transcurridos), que no
// dependen de timezone.

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI del Pulso ─────────────────────────────────────
export interface PulsoData {
    kpis: {
        reportesMes: number;
        /** % mes actual vs. mismo tramo del mes anterior · NULL sin base */
        deltaMesPct: number | null;
        reportesHoy: number;
        colegiosActivos: number;
        /** Horas creación → clasificación (30 d) · NULL sin clasificaciones */
        horasClasificacionMedia: number | null;
        /** actual − anterior en horas (negativo = mejora) · NULL sin historia */
        deltaClasificacionH: number | null;
    };
    /** Últimos 14 días, días sin reportes rellenados con 0 (en SQL) */
    serieDiaria: { dia: string; total: number }[];
    porCategoria: { categoria: string; total: number; pct: number }[];
    /** Máx 8 eventos · haceMin calculado en servidor · texto determinista */
    ticker: { haceMin: number; texto: string }[];
    /** 0–100 · fórmula determinista documentada abajo */
    saludOperativa: number;
    ultimoReporteHaceMin: number | null;
    /** false cuando no hay ni un solo reporte histórico */
    hayDatos: boolean;
}

// ─── Filas crudas de las consultas ───────────────────────────────────────────
interface FilaAgregados {
    total_historico: number;
    hoy: number;
    mes_actual: number;
    mes_anterior_mismo_tramo: number;
    reportes_7d: number;
    reportes_30d: number;
    clasificados_30d: number;
}
interface FilaConteo {
    total: number;
}
interface FilaSerie {
    dia: string;
    total: number;
}
interface FilaCategoria {
    categoria: string;
    total: number;
}
interface FilaTicker {
    instante: Date;
    estado_nuevo: string;
    reporte_id: string;
    categoria: string | null;
}
interface FilaUltimo {
    ultimo: Date | null;
}
interface FilaMedias {
    media_actual_h: number | null;
    media_anterior_h: number | null;
}

/** Medias de tiempo creación → clasificación, en horas (30 d vs. 30 previos). */
export interface MediasClasificacion {
    actual: number | null;
    anterior: number | null;
}

// ─── Salud operativa (0–100) · fórmula determinista ──────────────────────────
// salud = actividad (40) + réplica (30) + clasificación (30), redondeada y
// acotada a [0, 100]:
//   · Actividad reciente (0–40): reportes de los últimos 7 días, saturando
//     en 5 (5+ reportes/semana = pleno). Con 0 reportes → 0 pts: el vacío
//     NO suma salud (sin actividad medible no se presume operación).
//   · Réplica (0–30): 30 si existe suscripción lógica de PI en esta BD
//     (pg_stat_subscription), 0 si no existe o el sondeo falla
//     (deny-by-default: no se otorgan puntos por algo no medible).
//   · Clasificación (0–30): proporción clasificada de los reportes de los
//     últimos 30 días × 30; sin reportes en la ventana → 0 pts.
const PESO_ACTIVIDAD = 40;
const PESO_REPLICA = 30;
const PESO_CLASIFICACION = 30;
const SATURACION_SEMANAL = 5;

const MAX_TICKER = 8;
const MS_MINUTO = 60_000;

const AGREGADOS_VACIOS: FilaAgregados = {
    total_historico: 0,
    hoy: 0,
    mes_actual: 0,
    mes_anterior_mismo_tramo: 0,
    reportes_7d: 0,
    reportes_30d: 0,
    clasificados_30d: 0,
};

// ─── Helpers puros (también usados por el motor de insights) ─────────────────

/** Redondeo a 1 decimal para cifras en horas. */
export function redondear1(valor: number): number {
    return Math.round(valor * 10) / 10;
}

/**
 * Categoría enum → etiqueta legible ("CONTACTO_INSISTENTE" → "Contacto
 * insistente"). NULL → "sin clasificar" (minúscula: se incrusta en frase).
 */
export function formatearCategoria(categoria: string | null): string {
    if (!categoria) return "sin clasificar";
    const limpia = categoria.replace(/_/g, " ").toLowerCase();
    return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/** Minutos transcurridos desde un instante (nunca negativo: clock skew → 0). */
function minutosDesde(instante: Date, ahoraMs: number): number {
    return Math.max(0, Math.floor((ahoraMs - instante.getTime()) / MS_MINUTO));
}

/**
 * Ejecuta una consulta de una sección del Pulso. Si falla (MV ausente,
 * réplica caída, permisos), la sección degrada a VACÍO con warn — nunca se
 * inventa un dato para rellenarla (candado 9) y el resto del Pulso vive.
 */
async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Pulso] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Texto determinista del evento del ticker. Los ids de Reporte son cuid
 * (no secuenciales): la referencia visible son los últimos 6 chars en
 * mayúscula — determinista y trazable, sin inventar una numeración que no
 * existe en la fuente (candado 9).
 */
function textoTicker(estadoNuevo: string, reporteId: string, categoria: string | null): string {
    const ref = `#${reporteId.slice(-6).toUpperCase()}`;
    const cat = formatearCategoria(categoria);
    switch (estadoNuevo) {
        case "CLASIFICADO":
            return `Reporte ${ref} clasificado como ${cat}`;
        case "CORREGIDO":
            return `Reporte ${ref} corregido a ${cat}`;
        case "REVISION_MANUAL":
            return `Reporte ${ref} pasó a revisión manual`;
        case "POSIBLE_SPAM":
            return `Reporte ${ref} marcado como posible spam`;
        case "DUPLICADO":
            return `Reporte ${ref} marcado como duplicado`;
        case "REQUIERE_ANONIMIZACION":
            return `Reporte ${ref} requiere anonimización`;
        case "PROCESANDO":
            return `Reporte ${ref} en procesamiento`;
        case "PENDIENTE":
            return `Reporte ${ref} en espera de procesamiento`;
        default:
            return `Reporte ${ref} cambió a ${estadoNuevo.toLowerCase().replace(/_/g, " ")}`;
    }
}

/**
 * Horas medias creación → clasificación del mes móvil actual y del anterior.
 * Compartida con el motor de insights (regla de mejora). Si la consulta
 * falla devuelve NULLs honestos (sin historia no hay comparación).
 */
export async function obtenerMediasClasificacion(): Promise<MediasClasificacion> {
    try {
        const filas = await prisma.$queryRaw<FilaMedias[]>`
            SELECT
              (avg(EXTRACT(EPOCH FROM (c."creadoEn" - r."creadoEn")) / 3600)
                FILTER (WHERE c."creadoEn" >= now() - interval '30 days'))::float AS media_actual_h,
              (avg(EXTRACT(EPOCH FROM (c."creadoEn" - r."creadoEn")) / 3600)
                FILTER (WHERE c."creadoEn" >= now() - interval '60 days'
                          AND c."creadoEn" <  now() - interval '30 days'))::float AS media_anterior_h
            FROM "ClasificacionIA" c
            JOIN "Reporte" r ON r."id" = c."reporteId"
            WHERE r."eliminado" = false`;
        const fila = filas[0];
        return {
            actual: fila?.media_actual_h != null ? redondear1(fila.media_actual_h) : null,
            anterior: fila?.media_anterior_h != null ? redondear1(fila.media_anterior_h) : null,
        };
    } catch (error) {
        console.warn(
            `[Pulso] Medias de clasificación no disponibles: NULL honesto — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return { actual: null, anterior: null };
    }
}

/**
 * Datos vivos del Pulso. Ocho sondeos independientes en paralelo; cada uno
 * degrada a vacío por su cuenta si falla. Ningún valor se hardcodea: todo
 * sale de las filas devueltas (candados 9 y 10).
 */
export async function getPulso(): Promise<PulsoData> {
    const ahoraMs = Date.now();

    const [
        medias,
        filasAgregados,
        filasColegios,
        filasSerie,
        filasCategorias,
        filasTicker,
        filasReplica,
        filasUltimo,
    ] = await Promise.all([
        obtenerMediasClasificacion(),
        // Agregados del mes/día/semana + insumos de salud, en UN paso por la MV.
        // mes_anterior_mismo_tramo: MISMO tramo del mes anterior (día 1 → hoy),
        // comparación honesta manzana con manzana.
        intentar(
            "agregados",
            prisma.$queryRaw<FilaAgregados[]>`
                SELECT
                  COALESCE(sum("total_reportes"), 0)::int AS total_historico,
                  COALESCE(sum("total_reportes")
                    FILTER (WHERE "dia" = date_trunc('day', now())), 0)::int AS hoy,
                  COALESCE(sum("total_reportes")
                    FILTER (WHERE "dia" >= date_trunc('month', now())), 0)::int AS mes_actual,
                  COALESCE(sum("total_reportes")
                    FILTER (WHERE "dia" >= date_trunc('month', now()) - interval '1 month'
                              AND "dia" <  date_trunc('month', now()) - interval '1 month'
                                           + (now() - date_trunc('month', now()))), 0)::int AS mes_anterior_mismo_tramo,
                  COALESCE(sum("total_reportes")
                    FILTER (WHERE "dia" >= date_trunc('day', now()) - interval '7 days'), 0)::int AS reportes_7d,
                  COALESCE(sum("total_reportes")
                    FILTER (WHERE "dia" >= date_trunc('day', now()) - interval '30 days'), 0)::int AS reportes_30d,
                  COALESCE(sum("total_clasificados")
                    FILTER (WHERE "dia" >= date_trunc('day', now()) - interval '30 days'), 0)::int AS clasificados_30d
                FROM "mv_fact_reporte_diario"`,
        ),
        intentar(
            "colegios",
            prisma.$queryRaw<FilaConteo[]>`
                SELECT count(*)::int AS total
                FROM "Colegio"
                WHERE "estado" = 'activo'`,
        ),
        // Últimos 14 días con huecos rellenados a 0 en SQL (generate_series).
        intentar(
            "serie",
            prisma.$queryRaw<FilaSerie[]>`
                SELECT to_char(d."dia", 'YYYY-MM-DD') AS dia,
                       COALESCE(sum(m."total_reportes"), 0)::int AS total
                FROM generate_series(
                       date_trunc('day', now()) - interval '13 days',
                       date_trunc('day', now()),
                       interval '1 day'
                     ) AS d("dia")
                LEFT JOIN "mv_fact_reporte_diario" m ON m."dia" = d."dia"
                GROUP BY d."dia"
                ORDER BY d."dia"`,
        ),
        intentar(
            "categorias",
            prisma.$queryRaw<FilaCategoria[]>`
                SELECT "categoria",
                       COALESCE(sum("total_reportes"), 0)::int AS total
                FROM "mv_fact_reporte_diario"
                WHERE "dia" >= date_trunc('month', now())
                GROUP BY "categoria"
                ORDER BY total DESC, "categoria"`,
        ),
        intentar(
            "ticker",
            prisma.$queryRaw<FilaTicker[]>`
                SELECT t."creadoEn" AS instante,
                       t."estadoNuevo"::text AS estado_nuevo,
                       t."reporteId" AS reporte_id,
                       c."categoria"::text AS categoria
                FROM "TransicionReporte" t
                JOIN "Reporte" r ON r."id" = t."reporteId"
                LEFT JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                WHERE r."eliminado" = false
                ORDER BY t."creadoEn" DESC, t."id" DESC
                LIMIT 8`,
        ),
        intentar(
            "replica",
            prisma.$queryRaw<FilaConteo[]>`
                SELECT count(*)::int AS total FROM pg_stat_subscription`,
        ),
        intentar(
            "ultimo-reporte",
            prisma.$queryRaw<FilaUltimo[]>`
                SELECT max("creadoEn") AS ultimo
                FROM "Reporte"
                WHERE "eliminado" = false`,
        ),
    ]);

    const agregados = filasAgregados[0] ?? AGREGADOS_VACIOS;

    // ── KPIs: NULL cuando no hay base de comparación (jamás % inventado) ──
    const deltaMesPct =
        agregados.mes_anterior_mismo_tramo > 0
            ? Math.round(
                  ((agregados.mes_actual - agregados.mes_anterior_mismo_tramo) /
                      agregados.mes_anterior_mismo_tramo) *
                      100,
              )
            : null;
    const deltaClasificacionH =
        medias.actual !== null && medias.anterior !== null
            ? redondear1(medias.actual - medias.anterior)
            : null;

    // ── Donut por categoría del mes: pct entero sobre el total del mes ──
    const totalMesCategorias = filasCategorias.reduce((acc, f) => acc + f.total, 0);
    const porCategoria = filasCategorias.map((f) => ({
        categoria: f.categoria,
        total: f.total,
        pct: totalMesCategorias > 0 ? Math.round((f.total / totalMesCategorias) * 100) : 0,
    }));

    // ── Ticker: máx 8, haceMin calculado en servidor, texto determinista ──
    const ticker = filasTicker.slice(0, MAX_TICKER).map((f) => ({
        haceMin: minutosDesde(f.instante, ahoraMs),
        texto: textoTicker(f.estado_nuevo, f.reporte_id, f.categoria),
    }));

    // ── Salud operativa: fórmula documentada arriba ──
    const ptsActividad = PESO_ACTIVIDAD * Math.min(agregados.reportes_7d / SATURACION_SEMANAL, 1);
    const ptsReplica = (filasReplica[0]?.total ?? 0) > 0 ? PESO_REPLICA : 0;
    const ptsClasificacion =
        agregados.reportes_30d > 0
            ? PESO_CLASIFICACION * Math.min(agregados.clasificados_30d / agregados.reportes_30d, 1)
            : 0;
    const saludOperativa = Math.max(
        0,
        Math.min(100, Math.round(ptsActividad + ptsReplica + ptsClasificacion)),
    );

    const ultimo = filasUltimo[0]?.ultimo ?? null;

    return {
        kpis: {
            reportesMes: agregados.mes_actual,
            deltaMesPct,
            reportesHoy: agregados.hoy,
            colegiosActivos: filasColegios[0]?.total ?? 0,
            horasClasificacionMedia: medias.actual,
            deltaClasificacionH,
        },
        serieDiaria: filasSerie.map((f) => ({ dia: f.dia, total: f.total })),
        porCategoria,
        ticker,
        saludOperativa,
        ultimoReporteHaceMin: ultimo ? minutosDesde(ultimo, ahoraMs) : null,
        hayDatos: agregados.total_historico > 0,
    };
}

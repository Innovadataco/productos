// src/lib/bi/geo.ts · Capa de datos de Geografía (BI v2 · réplica real de PI)
// Producto 006 · BI v2
//
// Alimenta la pestaña "Geografía" del mockup v3 (mapa + cronología) con datos
// REALES de la réplica read-only de PI: "Reporte" (ciudadId + ciudad/pais
// texto), catálogo "Ciudad" (nombre/lat/lng), el agregado público
// "IdentificadorReportado" (totalReportes — SIN `identificador`, cortado en
// origen) y "eventos_match" (puente interCiudad, solo metadatos agregados).
//
// Candado 9 (honestidad): toda cifra sale del ResultSet.
//   · topCiudades: solo ciudades RESUELTAS (ciudadId → Ciudad con lat/lng);
//     una ciudad sin coordenadas NO entra al mapa (no se inventa un punto),
//     pero sí cuenta en ciudadesConReportes/paisesConReportes, donde el
//     fallback cuando ciudadId/paisId es NULL es el texto libre del reporte
//     (normalizado: lower+btrim) con prefijo 'txt:' para que jamás colisione
//     con un cuid real. Del mismo ResultSet sale calorCiudades (SPEC-006):
//     intensidad 0..1 = total / máximo del top, para el mapa de calor.
//   · Reincidencia: IdentificadorReportado es el ÚNICO puente de
//     reincidencia sin PII. Con menos de MIN_FILAS_REINCIDENCIA filas el
//     agregado es demasiado delgado para mostrarse como estadística →
//     fuente='honesto_vacio' y la UI lo dice ("aún sin datos suficientes");
//     los conteos se devuelven tal cual salieron (jamás maquillados).
//   · porMes: 12 meses móviles con huecos rellenados a 0 EN SQL
//     (generate_series); estacionalidadDow: 7 días L..D, los días sin
//     reportes quedan en 0 en JS a partir del mapa devuelto.
//   · comportamiento: top 8 países/ciudades con su categoría más frecuente;
//     sin clasificación → categoriaTop NULL, nunca una supuesta.
//   · totales (KPIs del encabezado, como el dashboard público de PI): un
//     solo ResultSet con 3 subconsultas; % autenticados con NULLIF(count,0)
//     → NULL con 0 reportes (jamás NaN). Sondeo roto → los 3 en null y la
//     UI dice "sin datos" (candado 9), nunca un 0 inventado.
//   · porPais (choropleth): TODOS los países resueltos con su total, nombre
//     ES del catálogo; la traducción ES→EN al GeoJSON vive en
//     src/components/bi/geo/nombres-pais.ts.
//
// Candado 10: ningún número quemado (los únicos literales son etiquetas de
// día y los umbrales/límites documentados como constantes).
// Ventanas temporales calculadas EN SQL con la TZ de la sesión (mismo
// criterio que pulso.ts).

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI de Geografía ──────────────────────────────────
export interface GeoData {
    /** Top de ciudades con coordenadas (entran al mapa) · mayor → menor */
    topCiudades: { nombre: string; total: number; lat: number; lng: number }[];
    /** Ciudades distintas con reportes (resueltas + fallback texto) */
    ciudadesConReportes: number;
    /** Países distintos con reportes (resueltos + fallback texto) */
    paisesConReportes: number;
    reincidencia: {
        /** Identificadores únicos agregados en IdentificadorReportado */
        unicos: number;
        /** Con ≥2 reportes acumulados */
        con2mas: number;
        /** Con ≥5 reportes acumulados */
        con5mas: number;
        /** Con ≥1 evento de match inter-ciudad (eventos_match.interCiudad) */
        multiCiudad: number;
        /**
         * 'agregado' = base suficiente (≥ MIN_FILAS_REINCIDENCIA filas);
         * 'honesto_vacio' = el demo pobló poco el agregado: la UI muestra
         * "aún sin datos suficientes" en vez de una estadística inflada.
         */
        fuente: "agregado" | "honesto_vacio";
    };
    /** Reportes por día de semana, siempre 7 entradas L,M,X,J,V,S,D */
    estacionalidadDow: { dia: string; total: number }[];
    /** Últimos 12 meses móviles (YYYY-MM), meses sin reportes con 0 */
    porMes: { mes: string; total: number }[];
    /**
     * Mapa de calor (SPEC-006): las topCiudades con `intensidad` 0..1
     * normalizada — total / máximo del top (la ciudad líder marca 1.0).
     * Solo ciudades con lat/lng REALES (las mismas que entran al mapa;
     * sin coordenadas no hay punto, no se inventa). Si el top está vacío
     * o degradado → []. La normalización es presentación pura sobre cifras
     * del ResultSet (candado 10: no se crea ningún dato nuevo).
     */
    calorCiudades: { nombre: string; lat: number; lng: number; total: number; intensidad: number }[];
    /**
     * Comportamiento por país/ciudad (SPEC-006): top 8 países y top 8
     * ciudades por volumen de reportes, cada uno con su categoría más
     * frecuente (join ClasificacionIA sobre SUS reportes). categoriaTop es
     * NULL cuando el país/ciudad no tiene ningún reporte clasificado
     * (candado 9: no se presume categoría). Solo países/ciudades RESUELTOS
     * (paisId/ciudadId → catálogo); el texto libre sin resolver no entra
     * (mismo criterio que topCiudades). Vacío o sondeo roto → [].
     */
    comportamiento: {
        porPais: { pais: string; total: number; categoriaTop: string | null }[];
        porCiudadTop: { ciudad: string; total: number; categoriaTop: string | null }[];
    };
    /**
     * KPIs generales (encabezado de la página, como el dashboard público de
     * PI). Un solo ResultSet con 3 subconsultas. `null` = el sondeo degrado
     * o el dato no existe (0 reportes en el % autenticados): la UI muestra
     * "—"/"sin datos" en vez de un 0 inventado (candado 9).
     */
    totales: {
        /** count(*) de Reporte no eliminados · null si el sondeo degrado */
        reportes: number | null;
        /** count(*) de IdentificadorReportado visible públicamente */
        identificadoresVisibles: number | null;
        /** 100 · no anónimos / total · null con total 0 o sondeo roto */
        pctAutenticados: number | null;
    };
    /**
     * Choropleth de países (relleno del polígono según reportes del país):
     * TODOS los países RESUELTOS (paisId → catálogo "Pais"), nombre en
     * español, mayor → menor. Vacío o sondeo roto → []: el mapa queda con el
     * relleno base y la leyenda lo dice (candado 9).
     */
    porPais: { pais: string; total: number }[];
}

// ─── Constantes documentadas (no son datos: son forma de la vista) ───────────
/** Tope del ranking de ciudades del mapa. */
const TOP_CIUDADES_LIMITE = 12;
/** Tope del ranking de países/ciudades del bloque "comportamiento". */
const TOP_COMPORTAMIENTO_LIMITE = 8;
/**
 * Mínimo de filas de IdentificadorReportado para mostrar reincidencia como
 * estadística. Debajo, el agregado es anecdótico (candado 9): fuente
 * 'honesto_vacio'.
 */
const MIN_FILAS_REINCIDENCIA = 30;
/** Etiquetas de día por ISODOW (1 = lunes … 7 = domingo). */
const ETIQUETAS_DOW = ["L", "M", "X", "J", "V", "S", "D"] as const;
/**
 * Tope del ranking de países del choropleth: con el volumen de la réplica
 * 100 sobra de sobra; es solo un tope defensivo contra catálogos gigantes.
 */
const PAISES_COROPLETA_LIMITE = 100;

// ─── Filas crudas de las consultas ───────────────────────────────────────────
interface FilaCiudadTop {
    nombre: string;
    total: number;
    lat: number;
    lng: number;
}
interface FilaCobertura {
    ciudades: number;
    paises: number;
}
interface FilaReincidencia {
    unicos: number;
    con_2_mas: number;
    con_5_mas: number;
    multi_ciudad: number;
}
interface FilaDow {
    dow: number;
    total: number;
}
interface FilaMes {
    mes: string;
    total: number;
}
interface FilaComportamientoPais {
    pais: string;
    total: number;
    categoria_top: string | null;
}
interface FilaComportamientoCiudad {
    ciudad: string;
    total: number;
    categoria_top: string | null;
}
interface FilaTotales {
    reportes: number;
    identificadores_visibles: number;
    pct_autenticados: number | null;
}
interface FilaPais {
    pais: string;
    total: number;
}

// Fallbacks de degradación (consulta rota → ceros/vacío con warn; candado 9).
const COBERTURA_VACIA: FilaCobertura = { ciudades: 0, paises: 0 };
const REINCIDENCIA_VACIA: FilaReincidencia = {
    unicos: 0,
    con_2_mas: 0,
    con_5_mas: 0,
    multi_ciudad: 0,
};

/**
 * Ejecuta una consulta de una sección de Geografía. Si falla (réplica caída,
 * tabla ausente), la sección degrada a VACÍO con warn — nunca se inventa un
 * dato para rellenarla (candado 9) y el resto de la pestaña vive.
 */
async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Geo] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Datos de Geografía. Cinco sondeos independientes en paralelo (cada uno
 * degrada por su cuenta). Queries $queryRaw con identificadores citados;
 * conteos casteados a ::int y coordenadas a ::float en SQL.
 */
export async function getGeo(): Promise<GeoData> {
    const [
        filasTop,
        filasCobertura,
        filasReincidencia,
        filasDow,
        filasMes,
        filasCompPais,
        filasCompCiudad,
        filasTotales,
        filasPais,
    ] = await Promise.all([
            // Top de ciudades RESUELTAS con coordenadas (las únicas que
            // entran al mapa). Sin lat/lng no hay punto — no se inventa.
            intentar(
                "top-ciudades",
                prisma.$queryRaw<FilaCiudadTop[]>`
                    SELECT c."nombre" AS nombre,
                           count(*)::int AS total,
                           c."lat"::float AS lat,
                           c."lng"::float AS lng
                    FROM "Reporte" r
                    JOIN "Ciudad" c ON c."id" = r."ciudadId"
                    WHERE r."eliminado" = false
                      AND c."lat" IS NOT NULL
                      AND c."lng" IS NOT NULL
                    GROUP BY c."id", c."nombre", c."lat", c."lng"
                    ORDER BY total DESC, c."nombre"
                    LIMIT ${TOP_CIUDADES_LIMITE}`,
            ),
            // Cobertura: ciudades/países distintos con reportes. Cuando el
            // reporte no tiene ciudadId/paisId resuelto se usa el texto
            // libre normalizado con prefijo 'txt:' (cuenta en el conteo
            // aunque no pueda entrar al mapa).
            intentar(
                "cobertura",
                prisma.$queryRaw<FilaCobertura[]>`
                    SELECT count(DISTINCT COALESCE(r."ciudadId",
                             'txt:' || lower(btrim(r."ciudad"))))::int AS ciudades,
                           count(DISTINCT COALESCE(r."paisId",
                             'txt:' || lower(btrim(r."pais"))))::int AS paises
                    FROM "Reporte" r
                    WHERE r."eliminado" = false`,
            ),
            // Reincidencia sin PII: agregado público + puente interCiudad.
            intentar(
                "reincidencia",
                prisma.$queryRaw<FilaReincidencia[]>`
                    SELECT count(*)::int AS unicos,
                           count(*) FILTER (WHERE "totalReportes" >= 2)::int AS con_2_mas,
                           count(*) FILTER (WHERE "totalReportes" >= 5)::int AS con_5_mas,
                           (SELECT count(DISTINCT "identificadorId")
                              FROM "eventos_match"
                             WHERE "interCiudad" = true)::int AS multi_ciudad
                    FROM "IdentificadorReportado"`,
            ),
            // Estacionalidad semanal (ISODOW: 1=lunes … 7=domingo).
            intentar(
                "estacionalidad-dow",
                prisma.$queryRaw<FilaDow[]>`
                    SELECT EXTRACT(ISODOW FROM "creadoEn")::int AS dow,
                           count(*)::int AS total
                    FROM "Reporte"
                    WHERE "eliminado" = false
                    GROUP BY dow
                    ORDER BY dow`,
            ),
            // Cronología: 12 meses móviles, huecos a 0 con generate_series.
            intentar(
                "por-mes",
                prisma.$queryRaw<FilaMes[]>`
                    SELECT to_char(m."mes", 'YYYY-MM') AS mes,
                           count(r."id")::int AS total
                    FROM generate_series(
                           date_trunc('month', now()) - interval '11 months',
                           date_trunc('month', now()),
                           interval '1 month'
                         ) AS m("mes")
                    LEFT JOIN "Reporte" r
                      ON r."creadoEn" >= m."mes"
                     AND r."creadoEn" <  m."mes" + interval '1 month'
                     AND r."eliminado" = false
                    GROUP BY m."mes"
                    ORDER BY m."mes"`,
            ),
            // Comportamiento por país: top 8 por reportes con su categoría
            // más frecuente (row_number por país sobre SUS clasificaciones;
            // desempate alfabético estable). LEFT JOIN: sin clasificación →
            // categoria_top NULL honesto. Solo paisId resueltos a catálogo.
            intentar(
                "comportamiento-pais",
                prisma.$queryRaw<FilaComportamientoPais[]>`
                    WITH paises AS (
                      SELECT p."id", p."nombre", count(*)::int AS total
                      FROM "Reporte" r
                      JOIN "Pais" p ON p."id" = r."paisId"
                      WHERE r."eliminado" = false
                      GROUP BY p."id", p."nombre"
                      ORDER BY total DESC, p."nombre"
                      LIMIT ${TOP_COMPORTAMIENTO_LIMITE}
                    ),
                    cats AS (
                      SELECT r."paisId", c."categoria"::text AS categoria,
                             row_number() OVER (
                               PARTITION BY r."paisId"
                               ORDER BY count(*) DESC, c."categoria"
                             ) AS rn
                      FROM "Reporte" r
                      JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                      WHERE r."eliminado" = false
                        AND r."paisId" IN (SELECT "id" FROM paises)
                      GROUP BY r."paisId", c."categoria"
                    )
                    SELECT pa."nombre" AS pais,
                           pa.total,
                           ca.categoria AS categoria_top
                    FROM paises pa
                    LEFT JOIN cats ca ON ca."paisId" = pa."id" AND ca.rn = 1
                    ORDER BY pa.total DESC, pa."nombre"`,
            ),
            // Comportamiento por ciudad: idéntica regla sobre ciudadId.
            intentar(
                "comportamiento-ciudad",
                prisma.$queryRaw<FilaComportamientoCiudad[]>`
                    WITH ciudades AS (
                      SELECT c."id", c."nombre", count(*)::int AS total
                      FROM "Reporte" r
                      JOIN "Ciudad" c ON c."id" = r."ciudadId"
                      WHERE r."eliminado" = false
                      GROUP BY c."id", c."nombre"
                      ORDER BY total DESC, c."nombre"
                      LIMIT ${TOP_COMPORTAMIENTO_LIMITE}
                    ),
                    cats AS (
                      SELECT r."ciudadId", c."categoria"::text AS categoria,
                             row_number() OVER (
                               PARTITION BY r."ciudadId"
                               ORDER BY count(*) DESC, c."categoria"
                             ) AS rn
                      FROM "Reporte" r
                      JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                      WHERE r."eliminado" = false
                        AND r."ciudadId" IN (SELECT "id" FROM ciudades)
                      GROUP BY r."ciudadId", c."categoria"
                    )
                    SELECT ci."nombre" AS ciudad,
                           ci.total,
                           ca.categoria AS categoria_top
                    FROM ciudades ci
                    LEFT JOIN cats ca ON ca."ciudadId" = ci."id" AND ca.rn = 1
                    ORDER BY ci.total DESC, ci."nombre"`,
            ),
            // KPIs generales (dashboard público de PI): UN ResultSet con las
            // 3 subconsultas. El % autenticados usa NULLIF(count(*), 0): con
            // 0 reportes devuelve NULL (la UI dice "sin datos"), jamás NaN
            // ni división por cero (candado 9).
            intentar(
                "totales",
                prisma.$queryRaw<FilaTotales[]>`
                    SELECT (SELECT count(*) FROM "Reporte"
                             WHERE "eliminado" = false)::int AS reportes,
                           (SELECT count(*) FROM "IdentificadorReportado"
                             WHERE "esVisiblePublicamente" = true)::int AS identificadores_visibles,
                           (SELECT 100.0 * count(*) FILTER (WHERE "esAnonimo" = false)
                                   / NULLIF(count(*), 0)
                              FROM "Reporte"
                             WHERE "eliminado" = false)::float AS pct_autenticados`,
            ),
            // Choropleth: TODOS los países resueltos con su total (nombre en
            // español del catálogo; la traducción al GeoJSON es del cliente).
            intentar(
                "por-pais",
                prisma.$queryRaw<FilaPais[]>`
                    SELECT p."nombre" AS pais,
                           count(*)::int AS total
                    FROM "Reporte" r
                    JOIN "Pais" p ON p."id" = r."paisId"
                    WHERE r."eliminado" = false
                    GROUP BY p."id", p."nombre"
                    ORDER BY total DESC, p."nombre"
                    LIMIT ${PAISES_COROPLETA_LIMITE}`,
            ),
        ]);

    const cobertura = filasCobertura[0] ?? COBERTURA_VACIA;
    const reincidencia = filasReincidencia[0] ?? REINCIDENCIA_VACIA;
    // Totales: sin fila (sondeo roto → []) los tres valores quedan en null:
    // la UI anuncia "sin datos" en vez de mostrar un 0 inventado (candado 9).
    const totales = filasTotales[0] ?? null;

    // Días L..D siempre presentes; el día sin filas en el ResultSet queda en
    // 0 (el hueco existe de verdad, no se disimula).
    const totalPorDow = new Map(filasDow.map((f) => [f.dow, f.total]));
    const estacionalidadDow = ETIQUETAS_DOW.map((dia, i) => ({
        dia,
        total: totalPorDow.get(i + 1) ?? 0,
    }));

    // Calor (SPEC-006): intensidad = total / máximo del top → líder en 1.0.
    // Sin filas (o máximo 0, caso defensivo) no hay división: 0, jamás NaN.
    const maxTop = filasTop.reduce((acc, f) => Math.max(acc, f.total), 0);

    return {
        topCiudades: filasTop.map((f) => ({
            nombre: f.nombre,
            total: f.total,
            lat: f.lat,
            lng: f.lng,
        })),
        ciudadesConReportes: cobertura.ciudades,
        paisesConReportes: cobertura.paises,
        reincidencia: {
            unicos: reincidencia.unicos,
            con2mas: reincidencia.con_2_mas,
            con5mas: reincidencia.con_5_mas,
            multiCiudad: reincidencia.multi_ciudad,
            fuente:
                reincidencia.unicos >= MIN_FILAS_REINCIDENCIA
                    ? "agregado"
                    : "honesto_vacio",
        },
        estacionalidadDow,
        porMes: filasMes.map((f) => ({ mes: f.mes, total: f.total })),
        calorCiudades: filasTop.map((f) => ({
            nombre: f.nombre,
            lat: f.lat,
            lng: f.lng,
            total: f.total,
            intensidad: maxTop > 0 ? f.total / maxTop : 0,
        })),
        comportamiento: {
            porPais: filasCompPais.map((f) => ({
                pais: f.pais,
                total: f.total,
                categoriaTop: f.categoria_top,
            })),
            porCiudadTop: filasCompCiudad.map((f) => ({
                ciudad: f.ciudad,
                total: f.total,
                categoriaTop: f.categoria_top,
            })),
        },
        totales: {
            reportes: totales?.reportes ?? null,
            identificadoresVisibles: totales?.identificadores_visibles ?? null,
            pctAutenticados: totales?.pct_autenticados ?? null,
        },
        porPais: filasPais.map((f) => ({ pais: f.pais, total: f.total })),
    };
}

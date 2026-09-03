// src/lib/bi/reportes360.ts · Capa de datos de "Reportes 360" (análisis
// completo de reportes) · Producto 006 · BI v2 · SPEC-006
//
// Sección de /analitica pedida por el dueño ("fortalecer MUCHO el análisis
// de reportes — un análisis completo"): desglose del universo "Reporte"
// (WHERE "eliminado" = false) por categoría de la IA, estado del pipeline,
// plataforma, anonimato, prioridad alta, edad de la víctima y evolución
// mensual de los últimos MESES_EVOLUCION meses con huecos a 0.
//
// Candado 9 (honestidad): toda cifra sale del ResultSet; si una consulta
// falla su bloque degrada a vacío con warn (patrón `intentar`, igual que
// geo.ts y analitica.ts) y los porcentajes son NULL cuando el denominador
// es 0 (jamás un % inventado).
// Candado 10: ninguna cifra se genera fuera de las filas devueltas; en JS
// solo se computan proporciones SOBRE esas filas.
//
// Queries: $queryRaw parametrizadas con identificadores SIEMPRE citados;
// conteos casteados a ::int. Las ventanas temporales se calculan EN SQL
// (date_trunc/interval con la TZ de sesión).

import { prisma } from "@/lib/db";
import { redondear1 } from "@/lib/bi/pulso";

// ─── Contrato expuesto a la UI de Analítica ──────────────────────────────────

/** Rango de edad de la víctima (constantes documentadas, orden fijo). */
export type RangoEdad =
    | "MENOR_13"
    | "EDAD_13_15"
    | "EDAD_16_17"
    | "EDAD_18_MAS"
    | "SIN_DATO";

export interface Reportes360Data {
    /** Total de reportes no eliminados (denominador de los % globales). */
    totalReportes: number;
    /**
     * Por categoría de la IA (join ClasificacionIA). Los reportes sin
     * clasificación entran como 'SIN_CLASIFICAR' (el valor es el literal del
     * contrato; la UI lo formatea). pctClasificado = share SOBRE el total
     * clasificado (SIN_CLASIFICAR queda excluido del denominador y su pct
     * es NULL: no es una categoría, no tiene % del clasificado).
     */
    porCategoria: { categoria: string; total: number; pctClasificado: number | null }[];
    /** Por estado del pipeline (enum crudo de PI, sale del dato, no se quema). */
    porEstado: { estado: string; total: number }[];
    /** Top TOPE_PLATAFORMAS por volumen (join Plataforma). */
    porPlataforma: { plataforma: string; total: number }[];
    /** Anónimos vs. autenticados; pctAnonimos NULL si totalReportes = 0. */
    anonimato: { anonimos: number; autenticados: number; pctAnonimos: number | null };
    /** Reportes con prioridadAlta = true; pct NULL si totalReportes = 0. */
    prioridadAlta: { total: number; pct: number | null };
    /** Por edad de la víctima (Int? en PI); rangos en orden documentado. */
    porEdad: { rango: RangoEdad; total: number }[];
    /**
     * Serie mensual de los últimos MESES_EVOLUCION meses (incluye el en
     * curso) con huecos rellenados a 0 en SQL (generate_series, mismo patrón
     * que porMes de geo.ts). La UI recorta el rango en memoria (3/6/12/24);
     * aquí siempre se mandan las MESES_EVOLUCION entradas completas.
     */
    evolucionMensual: { mes: string; total: number }[];
}

// ─── Filas crudas de las consultas (alias snake_case del ResultSet) ──────────
interface FilaCategoria360 {
    categoria: string;
    total: number;
}
interface FilaEstado360 {
    estado: string;
    total: number;
}
interface FilaPlataforma360 {
    plataforma: string;
    total: number;
}
interface FilaAnonimato360 {
    total: number;
    anonimos: number;
    autenticados: number;
    prioridad_alta: number;
}
interface FilaEdad360 {
    menores_13: number;
    edad_13_15: number;
    edad_16_17: number;
    edad_18_mas: number;
    sin_dato: number;
}
interface FilaMes360 {
    mes: string;
    total: number;
}

// ─── Constantes documentadas ─────────────────────────────────────────────────
/** Meses de la serie de evolución que manda el servidor (el cliente recorta). */
const MESES_EVOLUCION = 24;
/** Tope del ranking de plataformas (top N del bloque). */
const TOPE_PLATAFORMAS = 10;

// Fallbacks de degradación (consulta rota → vacío honesto con warn, candado 9).
const ANONIMATO_VACIO: FilaAnonimato360 = {
    total: 0,
    anonimos: 0,
    autenticados: 0,
    prioridad_alta: 0,
};
const EDAD_VACIA: FilaEdad360 = {
    menores_13: 0,
    edad_13_15: 0,
    edad_16_17: 0,
    edad_18_mas: 0,
    sin_dato: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Ejecuta un sondeo de un bloque. Si falla (réplica caída, permisos), el
 * bloque degrada a VACÍO con warn — nunca se inventa un dato para rellenarlo
 * (candado 9) y el resto de la sección vive. Mismo patrón que `intentar` de
 * geo.ts y analitica.ts.
 */
async function intentar<T>(bloque: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Reportes360] Bloque '${bloque}' degradado a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/** % de `parte` sobre `total`, redondeado a 1 decimal; NULL si no hay base. */
function pctSobre(parte: number, total: number): number | null {
    return total > 0 ? redondear1((parte / total) * 100) : null;
}

// ─── Función principal ───────────────────────────────────────────────────────

/**
 * Datos vivos de "Reportes 360". Los 6 sondeos corren en paralelo; cada uno
 * degrada a vacío por su cuenta si falla. Ningún valor se hardcodea: todo
 * sale de las filas devueltas o de proporciones calculadas sobre ellas
 * (candados 9 y 10). Todo el universo es "Reporte" WHERE "eliminado" =
 * false, salvo que el bloque indique otra cosa.
 */
export async function getReportes360(): Promise<Reportes360Data> {
    const [filasCategoria, filasEstado, filasPlataforma, filasAnonimato, filasEdad, filasMeses] =
        await Promise.all([
            // (1) Por categoría: LEFT JOIN ClasificacionIA — el reporte sin
            // clasificación entra como SIN_CLASIFICAR (no se le asigna una
            // categoría que no tiene, candado 9).
            intentar(
                "por-categoria",
                prisma.$queryRaw<FilaCategoria360[]>`
                    SELECT coalesce(c."categoria"::text, 'SIN_CLASIFICAR') AS categoria,
                           count(*)::int AS total
                    FROM "Reporte" r
                    LEFT JOIN "ClasificacionIA" c ON c."reporteId" = r."id"
                    WHERE r."eliminado" = false
                    GROUP BY c."categoria"
                    ORDER BY total DESC, categoria`,
            ),
            // (2) Por estado del pipeline: el enum sale del dato (GROUP BY del
            // campo), no se quema ningún estado en el código.
            intentar(
                "por-estado",
                prisma.$queryRaw<FilaEstado360[]>`
                    SELECT r."estado"::text AS estado,
                           count(*)::int AS total
                    FROM "Reporte" r
                    WHERE r."eliminado" = false
                    GROUP BY r."estado"
                    ORDER BY total DESC, r."estado"`,
            ),
            // (3) Top de plataformas por volumen (join Plataforma).
            intentar(
                "por-plataforma",
                prisma.$queryRaw<FilaPlataforma360[]>`
                    SELECT p."nombre" AS plataforma,
                           count(*)::int AS total
                    FROM "Reporte" r
                    JOIN "Plataforma" p ON p."id" = r."plataformaId"
                    WHERE r."eliminado" = false
                    GROUP BY p."nombre"
                    ORDER BY total DESC, p."nombre"
                    LIMIT ${TOPE_PLATAFORMAS}`,
            ),
            // (4+5) Anónimos vs. autenticados + prioridad alta + total del
            // universo (denominador de los % globales), en un solo barrido.
            intentar(
                "anonimato-prioridad",
                prisma.$queryRaw<FilaAnonimato360[]>`
                    SELECT count(*)::int AS total,
                           count(*) FILTER (WHERE "esAnonimo")::int AS anonimos,
                           count(*) FILTER (WHERE NOT "esAnonimo")::int AS autenticados,
                           count(*) FILTER (WHERE "prioridadAlta")::int AS prioridad_alta
                    FROM "Reporte"
                    WHERE "eliminado" = false`,
            ),
            // (6) Edad de la víctima (Int? en PI; NULL = sin dato). Rangos
            // disjuntos documentados como constantes del contrato: <13,
            // 13–15, 16–17, 18+ y sin dato.
            intentar(
                "por-edad",
                prisma.$queryRaw<FilaEdad360[]>`
                    SELECT count(*) FILTER (WHERE "edadVictima" < 13)::int AS menores_13,
                           count(*) FILTER (
                             WHERE "edadVictima" >= 13 AND "edadVictima" <= 15)::int AS edad_13_15,
                           count(*) FILTER (
                             WHERE "edadVictima" >= 16 AND "edadVictima" <= 17)::int AS edad_16_17,
                           count(*) FILTER (WHERE "edadVictima" >= 18)::int AS edad_18_mas,
                           count(*) FILTER (WHERE "edadVictima" IS NULL)::int AS sin_dato
                    FROM "Reporte"
                    WHERE "eliminado" = false`,
            ),
            // (7) Evolución mensual de los últimos MESES_EVOLUCION meses
            // (incluye el en curso), huecos rellenados con 0 por
            // generate_series (mismo patrón que porMes de geo.ts). El
            // interval * int parametrizado se resuelve en prisma (el named
            // arg make_interval falla con 42P08 — verificado en analitica.ts).
            intentar(
                "evolucion-mensual",
                prisma.$queryRaw<FilaMes360[]>`
                    SELECT to_char(m."mes", 'YYYY-MM') AS mes,
                           count(r."id")::int AS total
                    FROM generate_series(
                           date_trunc('month', now()) - (interval '1 month' * (${MESES_EVOLUCION - 1}::int)),
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
        ]);

    // ── (1) Por categoría: pct SOBRE el clasificado (SIN_CLASIFICAR queda
    // fuera del denominador y su pct es NULL — no es una categoría). ──
    const clasificados = filasCategoria
        .filter((f) => f.categoria !== "SIN_CLASIFICAR")
        .reduce((acc, f) => acc + f.total, 0);
    const porCategoria = filasCategoria.map((f) => ({
        categoria: f.categoria,
        total: f.total,
        pctClasificado:
            f.categoria === "SIN_CLASIFICAR" ? null : pctSobre(f.total, clasificados),
    }));

    // ── (4+5) Anonimato + prioridad: % sobre el total del universo ──
    const anon = filasAnonimato[0] ?? ANONIMATO_VACIO;

    // ── (6) Edad: filas crudas → rangos en orden documentado ──
    const edad = filasEdad[0] ?? EDAD_VACIA;
    const porEdad: Reportes360Data["porEdad"] = [
        { rango: "MENOR_13", total: edad.menores_13 },
        { rango: "EDAD_13_15", total: edad.edad_13_15 },
        { rango: "EDAD_16_17", total: edad.edad_16_17 },
        { rango: "EDAD_18_MAS", total: edad.edad_18_mas },
        { rango: "SIN_DATO", total: edad.sin_dato },
    ];

    return {
        totalReportes: anon.total,
        porCategoria,
        porEstado: filasEstado.map((f) => ({ estado: f.estado, total: f.total })),
        porPlataforma: filasPlataforma.map((f) => ({
            plataforma: f.plataforma,
            total: f.total,
        })),
        anonimato: {
            anonimos: anon.anonimos,
            autenticados: anon.autenticados,
            pctAnonimos: pctSobre(anon.anonimos, anon.total),
        },
        prioridadAlta: {
            total: anon.prioridad_alta,
            pct: pctSobre(anon.prioridad_alta, anon.total),
        },
        porEdad,
        evolucionMensual: filasMeses.map((f) => ({ mes: f.mes, total: f.total })),
    };
}

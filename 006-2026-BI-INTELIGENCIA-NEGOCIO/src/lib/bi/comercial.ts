// src/lib/bi/comercial.ts · Capa de datos de Comercial (BI v2 · Lote A)
// Producto 006 · BI v2
//
// Alimenta la pestaña "Comercial" (plata y operación de cobro) con datos
// REALES de la réplica read-only de PI: Suscripcion (estados, vencimientos,
// freemium, montoRealPagado/fechaPagoReal del alta manual autorizada), Pago
// (renovaciones declaradas — hoy vacía en prod, degrada honesto), Plan
// (nombre legible) y Colegio (nombre del titular — visible solo al CEO,
// decisión ARQ_07).
//
// Alcance deliberado (orden CEO 2026-09-03): bonos y referidos quedan FUERA —
// el módulo está en desarrollo en PI y sus tablas no se publican.
//
// Candado 9 (honestidad): cada sondeo degrada por su cuenta a vacío con warn;
// jamás se inventa una cifra. Candado 10: ningún número quemado — toda cifra
// sale del ResultSet. Moneda de presentación: COP (negocio local).

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI de Comercial ──────────────────────────────────
export interface ComercialData {
    kpis: {
        /** Suma de montoRealPagado con fechaPagoReal en el mes en curso (COP) */
        recaudoMes: number | null;
        recaudoMesAnterior: number | null;
        /** Suma de montoRealPagado en el año en curso (COP) */
        recaudoAnio: number | null;
        activas: number;
        enGracia: number;
        suspendidas: number;
        freemiumActivos: number;
        /** % de pagantes con origen FREEMIUM_AUTO (0 si no hay pagantes) */
        conversionFreemiumPct: number | null;
        /** Pagos (renovaciones) esperando autorización — tabla Pago */
        pagosPendientesAutorizacion: number;
    };
    /** Embudo comercial: de colegio registrado a cliente que paga */
    embudo: {
        registrados: number;
        onboardingCompletado: number;
        freemium: number;
        pagantes: number;
        renovaron: number;
    };
    /** Recaudo real por mes, últimos 12 (COP) — mes más reciente de último */
    recaudoPorMes: { mes: string; total: number }[];
    /** Recaudo por método de pago declarado (alta manual) — null si sin datos */
    recaudoPorMetodo: { metodo: string; total: number; cantidad: number }[] | null;
    /** Suscripciones que vencen en los próximos 7 días (llamadas a hacer) */
    vencen7Dias: {
        titular: string;
        plan: string | null;
        estado: string;
        venceEn: string;
        enGracia: boolean;
    }[];
    /** Top titulares por valor acumulado pagado (COP) */
    topClientes: {
        titular: string;
        acumulado: number;
        antiguedadMeses: number | null;
        estado: string;
    }[];
    /** Bandas de vencimiento (mismo criterio que Analítica, sobre Suscripcion) */
    vencimientos: {
        estaSemana: number;
        en15d: number;
        en30d: number;
        freemiumExpiraSemana: number;
    };
}

// ─── Filas crudas ────────────────────────────────────────────────────────────
interface FilaKpis {
    recaudo_mes: number | null;
    recaudo_mes_anterior: number | null;
    recaudo_anio: number | null;
    activas: number;
    en_gracia: number;
    suspendidas: number;
    freemium_activos: number;
    freemium_convertidas: number;
    pagantes: number;
    pagos_pendientes: number;
}
interface FilaEmbudo {
    registrados: number;
    onboarding_completado: number;
    freemium: number;
    pagantes: number;
    renovaron: number;
}
interface FilaMes {
    mes: string;
    total: number;
}
interface FilaMetodo {
    metodo: string;
    total: number;
    cantidad: number;
}
interface FilaVence {
    titular: string;
    plan: string | null;
    estado: string;
    vence_en: string;
    en_gracia: boolean;
}
interface FilaTop {
    titular: string;
    acumulado: number;
    antiguedad_meses: number | null;
    estado: string;
}
interface FilaBand {
    esta_semana: number;
    en15d: number;
    en30d: number;
    freemium_expira_semana: number;
}

const KPIS_VACIOS: FilaKpis = {
    recaudo_mes: null,
    recaudo_mes_anterior: null,
    recaudo_anio: null,
    activas: 0,
    en_gracia: 0,
    suspendidas: 0,
    freemium_activos: 0,
    freemium_convertidas: 0,
    pagantes: 0,
    pagos_pendientes: 0,
};
const EMBUDO_VACIO: FilaEmbudo = {
    registrados: 0,
    onboarding_completado: 0,
    freemium: 0,
    pagantes: 0,
    renovaron: 0,
};
const BAND_VACIA: FilaBand = {
    esta_semana: 0,
    en15d: 0,
    en30d: 0,
    freemium_expira_semana: 0,
};

async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Comercial] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Datos de Comercial. Sondeos independientes en paralelo (cada uno degrada
 * por su cuenta). Las comparaciones de estado van en minúscula: la réplica
 * trae los enums tal cual PI y el casing no se da por supuesto.
 */
export async function getComercial(): Promise<ComercialData> {
    const [filasKpis, filasEmbudo, filasMes, filasMetodo, filasVence, filasTop, filasBand] =
        await Promise.all([
            intentar(
                "kpis",
                prisma.$queryRaw<FilaKpis[]>`
                    SELECT
                      (SELECT sum(s."montoRealPagado")
                        FROM "Suscripcion" s
                       WHERE s."fechaPagoReal" >= date_trunc('month', now()))::float
                        AS recaudo_mes,
                      (SELECT sum(s."montoRealPagado")
                        FROM "Suscripcion" s
                       WHERE s."fechaPagoReal" >= date_trunc('month', now()) - interval '1 month'
                         AND s."fechaPagoReal" <  date_trunc('month', now()))::float
                        AS recaudo_mes_anterior,
                      (SELECT sum(s."montoRealPagado")
                        FROM "Suscripcion" s
                       WHERE s."fechaPagoReal" >= date_trunc('year', now()))::float
                        AS recaudo_anio,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE lower("estado") = 'activa')::int AS activas,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE lower("estado") = 'en_gracia')::int AS en_gracia,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE lower("estado") = 'suspendida')::int AS suspendidas,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "esFreemium" = true
                          AND lower("estado") IN ('activa','en_gracia'))::int AS freemium_activos,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE lower("origen") = 'freemium_auto'
                          AND "esFreemium" = false
                          AND lower("estado") IN ('activa','en_gracia'))::int
                        AS freemium_convertidas,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "esFreemium" = false
                          AND lower("estado") IN ('activa','en_gracia'))::int AS pagantes,
                      (SELECT count(*) FROM "Pago"
                        WHERE lower("estado") = 'pendiente_autorizacion')::int AS pagos_pendientes`,
            ),
            intentar(
                "embudo",
                prisma.$queryRaw<FilaEmbudo[]>`
                    SELECT
                      (SELECT count(*) FROM "Colegio")::int AS registrados,
                      (SELECT count(*) FROM "OnboardingColegio"
                        WHERE lower("estado") = 'completado')::int AS onboarding_completado,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "esFreemium" = true)::int AS freemium,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "esFreemium" = false)::int AS pagantes,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "esFreemium" = false
                          AND "fechaInicio" < now() - interval '30 days')::int AS renovaron`,
            ),
            intentar(
                "recaudo-por-mes",
                prisma.$queryRaw<FilaMes[]>`
                    SELECT to_char(m, 'YYYY-MM') AS mes, coalesce(sum(s."montoRealPagado"), 0)::float AS total
                    FROM generate_series(
                           date_trunc('month', now()) - interval '11 months',
                           date_trunc('month', now()),
                           interval '1 month'
                         ) AS g(m)
                    LEFT JOIN "Suscripcion" s
                      ON date_trunc('month', s."fechaPagoReal") = m
                    GROUP BY m
                    ORDER BY m`,
            ),
            // Recaudo por método: del alta manual (Suscripcion.metodoPagoManual).
            // La tabla Pago (renovaciones) hoy está vacía en prod; si algún día
            // tiene datos autorizados, este sondeo se enriquece — no se mezcla.
            intentar(
                "recaudo-por-metodo",
                prisma.$queryRaw<FilaMetodo[]>`
                    SELECT COALESCE(NULLIF("metodoPagoManual", ''), 'Sin método') AS metodo,
                           sum("montoRealPagado")::float AS total,
                           count(*)::int AS cantidad
                    FROM "Suscripcion"
                    WHERE "montoRealPagado" IS NOT NULL AND "montoRealPagado" > 0
                    GROUP BY COALESCE(NULLIF("metodoPagoManual", ''), 'Sin método')
                    ORDER BY total DESC`,
            ),
            intentar(
                "vencen-7-dias",
                prisma.$queryRaw<FilaVence[]>`
                    SELECT COALESCE(c."nombre", 'Padre · ' || s."id") AS titular,
                           p."nombre" AS plan,
                           s."estado",
                           to_char(s."fechaFin", 'DD/MM/YYYY') AS vence_en,
                           (lower(s."estado") = 'en_gracia') AS en_gracia
                    FROM "Suscripcion" s
                    LEFT JOIN "Colegio" c ON c."id" = s."colegioId"
                    LEFT JOIN "Plan" p ON p."id" = s."planActualId"
                    WHERE s."fechaFin" >= now()
                      AND s."fechaFin" <  now() + interval '7 days'
                      AND lower(s."estado") IN ('activa','en_gracia')
                    ORDER BY s."fechaFin" ASC
                    LIMIT 10`,
            ),
            intentar(
                "top-clientes",
                prisma.$queryRaw<FilaTop[]>`
                    SELECT COALESCE(c."nombre", 'Padre · ' || s."id") AS titular,
                           sum(s."montoRealPagado")::float AS acumulado,
                           (EXTRACT(YEAR FROM age(now(), min(s."fechaInicio"))) * 12
                             + EXTRACT(MONTH FROM age(now(), min(s."fechaInicio"))))::int
                             AS antiguedad_meses,
                           (SELECT s2."estado" FROM "Suscripcion" s2
                             WHERE s2."colegioId" = s."colegioId"
                                OR s2."id" = s."id"
                             ORDER BY s2."updatedAt" DESC LIMIT 1) AS estado
                    FROM "Suscripcion" s
                    LEFT JOIN "Colegio" c ON c."id" = s."colegioId"
                    WHERE s."montoRealPagado" IS NOT NULL AND s."montoRealPagado" > 0
                    GROUP BY COALESCE(c."nombre", 'Padre · ' || s."id"), s."colegioId", s."id"
                    ORDER BY acumulado DESC
                    LIMIT 8`,
            ),
            intentar(
                "vencimientos-bandas",
                prisma.$queryRaw<FilaBand[]>`
                    SELECT
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "fechaFin" >= now() AND "fechaFin" < now() + interval '7 days'
                          AND lower("estado") IN ('activa','en_gracia'))::int AS esta_semana,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "fechaFin" >= now() + interval '7 days'
                          AND "fechaFin" < now() + interval '15 days'
                          AND lower("estado") IN ('activa','en_gracia'))::int AS en15d,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "fechaFin" >= now() + interval '15 days'
                          AND "fechaFin" < now() + interval '30 days'
                          AND lower("estado") IN ('activa','en_gracia'))::int AS en30d,
                      (SELECT count(*) FROM "Suscripcion"
                        WHERE "esFreemium" = true
                          AND "freemiumFechaFin" >= now()
                          AND "freemiumFechaFin" < now() + interval '7 days')::int
                        AS freemium_expira_semana`,
            ),
        ]);

    const k = filasKpis[0] ?? KPIS_VACIOS;
    const e = filasEmbudo[0] ?? EMBUDO_VACIO;
    const b = filasBand[0] ?? BAND_VACIA;

    return {
        kpis: {
            recaudoMes: k.recaudo_mes,
            recaudoMesAnterior: k.recaudo_mes_anterior,
            recaudoAnio: k.recaudo_anio,
            activas: k.activas,
            enGracia: k.en_gracia,
            suspendidas: k.suspendidas,
            freemiumActivos: k.freemium_activos,
            conversionFreemiumPct:
                k.pagantes > 0
                    ? Math.round((k.freemium_convertidas / k.pagantes) * 1000) / 10
                    : null,
            pagosPendientesAutorizacion: k.pagos_pendientes,
        },
        embudo: {
            registrados: e.registrados,
            onboardingCompletado: e.onboarding_completado,
            freemium: e.freemium,
            pagantes: e.pagantes,
            renovaron: e.renovaron,
        },
        recaudoPorMes: filasMes.map((f) => ({ mes: f.mes, total: f.total })),
        // Sin ningún pago declarado, la sección entera dice su vacío (candado 9)
        // en vez de pintar barras en cero.
        recaudoPorMetodo:
            filasMetodo.length > 0
                ? filasMetodo.map((f) => ({
                      metodo: f.metodo,
                      total: f.total,
                      cantidad: f.cantidad,
                  }))
                : null,
        vencen7Dias: filasVence.map((f) => ({
            titular: f.titular,
            plan: f.plan,
            estado: f.estado,
            venceEn: f.vence_en,
            enGracia: f.en_gracia,
        })),
        topClientes: filasTop.map((f) => ({
            titular: f.titular,
            acumulado: f.acumulado,
            antiguedadMeses: f.antiguedad_meses,
            estado: f.estado,
        })),
        vencimientos: {
            estaSemana: b.esta_semana,
            en15d: b.en15d,
            en30d: b.en30d,
            freemiumExpiraSemana: b.freemium_expira_semana,
        },
    };
}

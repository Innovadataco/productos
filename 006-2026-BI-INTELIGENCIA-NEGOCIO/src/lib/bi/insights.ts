// src/lib/bi/insights.ts · Motor determinista de insights del Pulso
// Producto 006 · BI v2 · "BI detectó · sin que le preguntes"
//
// Tres reglas DETERMINISTAS sobre datos reales de la réplica de PI:
//   (a) tendencia al alza de una categoría      → ambar  (atención)
//   (b) colegios activos sin reportes en N días → cielo  (patrón)
//   (c) mejora del tiempo medio de clasificación → pino  (buena noticia)
//
// Candado 9: sin base de comparación NO hay insight (una categoría sin
// reportes en las 2 semanas previas no tiene % de subida computable; sin
// historia de clasificación no hay mejora). Jamás se fabrica un insight:
// si no dispara ninguna regla se devuelve [].
// Candado 10: toda cifra del título/detalle sale del ResultSet.
//
// B3: los umbrales viven en bi_config (editables sin despliegue, seed en
// prisma/seed.ts), NUNCA quemados. Patrón de lectura: BD → default.
//
// Marco de vigilancia (Lote 1): getInsights() concatena además los insights
// de vigilancia (getInsightsVigilancia de '@/lib/bi/vigilancia' — mismo
// contrato Insight), ordena todo por severidad y recorta al máximo total.
//
// Salida: máximo 4 insights, ordenados por severidad ambar → cielo → pino.

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { getInsightsVigilancia } from "@/lib/bi/vigilancia";
import {
    formatearCategoria,
    obtenerMediasClasificacion,
    redondear1,
} from "@/lib/bi/pulso";

// ─── Contrato expuesto a la UI del Pulso ─────────────────────────────────────
export interface Insight {
    severidad: "ambar" | "cielo" | "pino";
    titulo: string;
    detalle: string;
    accion?: { etiqueta: string; href: "/operacion" | "/chat" };
}

const CLAVE_UMBRAL_SUBIDA = "bi.insights.subida_semanal_pct";
const CLAVE_DIAS_SIN_REPORTES = "bi.insights.dias_sin_reportes";
const DEFAULT_SUBIDA_SEMANAL_PCT = 50;
const DEFAULT_DIAS_SIN_REPORTES = 30;

const MAX_INSIGHTS = 4;
const MS_DIA = 86_400_000;

interface FilaTendencia {
    categoria: string;
    reciente: number;
    previa: number;
}
interface FilaColegio {
    colegio_id: string;
    nombre: string;
    ultimo: Date | null;
}

/** Entero positivo desde bi_config; valor ausente/roto → default (B3). */
function parseEnteroPositivo(valor: string | null, defecto: number): number {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : defecto;
}

/**
 * Una regla que falla (MV ausente, réplica caída) NO produce insight: sin
 * datos no se afirma nada. Se loguea y se sigue con las demás reglas.
 */
async function intentarInsight(
    regla: string,
    producir: () => Promise<Insight | null>,
): Promise<Insight | null> {
    try {
        return await producir();
    } catch (error) {
        console.warn(
            `[Insights] Regla '${regla}' sin resultado: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return null;
    }
}

/**
 * (a) ambar · categoría cuyas últimas 2 semanas superan el umbral de subida
 * frente a las 2 anteriores. Requiere base: previa = 0 → NO dispara (no hay
 * % computable, candado 9). Si disparan varias, gana la de mayor subida.
 */
async function insightTendencia(umbralPct: number): Promise<Insight | null> {
    const filas = await prisma.$queryRaw<FilaTendencia[]>`
        SELECT "categoria",
               COALESCE(sum("total_reportes")
                 FILTER (WHERE "dia" >= date_trunc('day', now()) - interval '14 days'), 0)::int AS reciente,
               COALESCE(sum("total_reportes")
                 FILTER (WHERE "dia" <  date_trunc('day', now()) - interval '14 days'), 0)::int AS previa
        FROM "mv_fact_reporte_diario"
        WHERE "dia" >= date_trunc('day', now()) - interval '28 days'
        GROUP BY "categoria"
        ORDER BY "categoria"`;

    let mejor: { categoria: string; reciente: number; previa: number; pct: number } | null = null;
    for (const f of filas) {
        if (f.previa <= 0 || f.reciente <= f.previa) continue; // sin base o sin subida
        const pct = Math.round(((f.reciente - f.previa) / f.previa) * 100);
        if (pct < umbralPct) continue;
        if (!mejor || pct > mejor.pct) {
            mejor = { categoria: f.categoria, reciente: f.reciente, previa: f.previa, pct };
        }
    }
    if (!mejor) return null;

    return {
        severidad: "ambar",
        titulo: `${formatearCategoria(mejor.categoria)} sube ${mejor.pct}% en 2 semanas`,
        detalle: `De ${mejor.previa} a ${mejor.reciente} reportes: últimas 2 semanas vs. las 2 anteriores. Umbral de alerta: ${umbralPct}%.`,
        accion: { etiqueta: "Ver operación →", href: "/operacion" },
    };
}

/**
 * (b) cielo · colegios activos sin reportes en N+ días (o jamás). El vínculo
 * real en el schema de PI es Colegio.tenantId ↔ Reporte.tenantId. Silencio
 * prolongado puede ser subregistro: el detalle lo dice, no lo oculta.
 */
async function insightColegiosSilenciosos(dias: number): Promise<Insight | null> {
    const filas = await prisma.$queryRaw<FilaColegio[]>`
        SELECT c."id" AS colegio_id,
               c."nombre" AS nombre,
               max(r."creadoEn") AS ultimo
        FROM "Colegio" c
        LEFT JOIN "Reporte" r
          ON r."tenantId" = c."tenantId"
         AND r."eliminado" = false
        WHERE c."estado" = 'activo'
        GROUP BY c."id", c."nombre"
        ORDER BY c."nombre"`;

    const ahoraMs = Date.now();
    const silenciosos = filas.filter(
        (f) => f.ultimo === null || Math.floor((ahoraMs - f.ultimo.getTime()) / MS_DIA) >= dias,
    );
    if (silenciosos.length === 0) return null;

    const nombres = silenciosos
        .slice(0, 3)
        .map((f) => f.nombre)
        .join(", ");
    const extra = silenciosos.length > 3 ? ` y ${silenciosos.length - 3} más` : "";

    return {
        severidad: "cielo",
        titulo: `${silenciosos.length} ${silenciosos.length === 1 ? "colegio" : "colegios"} sin reportes en ${dias}+ días`,
        detalle: `${nombres}${extra}. Puede indicar subregistro, no necesariamente ausencia de riesgo.`,
        accion: { etiqueta: "Ver operación →", href: "/operacion" },
    };
}

/**
 * (c) pino · el tiempo medio creación → clasificación bajó frente al periodo
 * anterior (30 días móviles vs. los 30 previos). Sin historia en alguna de
 * las dos ventanas → NULL → NO hay insight (candado 9).
 */
async function insightMejoraClasificacion(): Promise<Insight | null> {
    const { actual, anterior } = await obtenerMediasClasificacion();
    if (actual === null || anterior === null) return null;
    const mejora = redondear1(anterior - actual);
    if (mejora <= 0) return null;

    return {
        severidad: "pino",
        titulo: `Clasificación ${mejora} h más rápida`,
        detalle: `La media bajó de ${anterior} h a ${actual} h (últimos 30 días vs. los 30 anteriores). El circuito de revisión está funcionando.`,
        accion: { etiqueta: "Preguntar al chat", href: "/chat" },
    };
}

/**
 * Motor proactivo del Pulso: evalúa las tres reglas en paralelo con los
 * umbrales vigentes de bi_config, concatena los insights del marco de
 * vigilancia (getInsightsVigilancia, mismo contrato Insight) y devuelve
 * máximo 4 ordenados por severidad. Si la vigilancia falla NO tumba el
 * motor: se loguea y se sigue solo con las reglas locales (mismo criterio
 * que intentarInsight). Sin disparos → [] (la UI muestra su estado de calma
 * honesto).
 */
export async function getInsights(): Promise<Insight[]> {
    const [valorUmbral, valorDias] = await Promise.all([
        getConfig(CLAVE_UMBRAL_SUBIDA),
        getConfig(CLAVE_DIAS_SIN_REPORTES),
    ]);
    const umbralSubida = parseEnteroPositivo(valorUmbral, DEFAULT_SUBIDA_SEMANAL_PCT);
    const diasSinReportes = parseEnteroPositivo(valorDias, DEFAULT_DIAS_SIN_REPORTES);

    const [resultados, vigilancia] = await Promise.all([
        Promise.all([
            intentarInsight("tendencia", () => insightTendencia(umbralSubida)),
            intentarInsight("colegios_silenciosos", () => insightColegiosSilenciosos(diasSinReportes)),
            intentarInsight("mejora_clasificacion", () => insightMejoraClasificacion()),
        ]),
        (async (): Promise<Insight[]> => {
            try {
                return await getInsightsVigilancia();
            } catch (error) {
                console.warn(
                    `[Insights] Vigilancia sin resultado: consulta falló — ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
                return [];
            }
        })(),
    ]);

    const orden: Record<Insight["severidad"], number> = { ambar: 0, cielo: 1, pino: 2 };
    return [
        ...resultados.filter((i): i is Insight => i !== null),
        ...vigilancia,
    ]
        .sort((a, b) => orden[a.severidad] - orden[b.severidad])
        .slice(0, MAX_INSIGHTS);
}

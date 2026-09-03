// src/lib/bi/vigilancia.ts · Capa de datos del marco de vigilancia (4 monitores)
// Producto 006 · BI v2 · Lote 1 (marco de vigilancia) + Lote 3 (panel bitácora)
//
// Cuatro monitores DETERMINISTAS sobre la réplica de PI (solo lectura):
//   (a) cicloVida  — embudo por estado actual de Reporte + horas medias por
//                    paso (TransicionReporte) + atascados en REVISION_MANUAL.
//   (b) motorCaido — SÍNTOMA de motor detenido: última ClasificacionIA vieja
//                    Y cola de reportes sin clasificar. No es monitoreo de la
//                    infra de PI (worker/Ollama): es una señal en los datos,
//                    que puede tener causas benignas (p. ej. sin reportes
//                    nuevos que clasificar... la cola > 0 descarta esa).
//   (c) comercial  — vencimientos de Suscripcion ACTIVA por ventana de
//                    fechaFin (0,7] / (7,15] / (15,30] días + freemium y
//                    premium activos de titular PADRE.
//   (d) antifraude — ráfagas (esRafaga) en la ventana configurada, spam de la
//                    semana y honestidad sobre FuenteReporte (vacía en demo).
//
// Candados:
//   9  — honestidad con el vacío: sin transiciones → horasMedias null; sin
//        clasificaciones jamás → ultimaClasificacionEn null; FuenteReporte
//        vacía → fuenteReporteConDatos false. Jamás una cifra inventada.
//   10 — TODA cifra sale del ResultSet; aquí no hay ni un número quemado.
//   B3 — umbrales en bi_config (seed en prisma/seed.ts con update:{} vacío,
//        NUNCA pisa customizaciones del operador), default como último
//        fallback (patrón de src/lib/config.ts).
//
// Queries $queryRaw parametrizadas: los valores van SIEMPRE como ${...}
// (Prisma los enlaza como $1..$n); los identificadores de tabla/columna van
// citados, nunca interpolados. Columnas enum se castean a ::text para
// compararlas con el parámetro enlazado (enum = text no existe en PG).

import { prisma } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { type Insight } from "@/lib/bi/insights";
import { redondear1 } from "@/lib/bi/pulso";

// ─── Contrato expuesto al panel de vigilancia ────────────────────────────────
export interface VigilanciaData {
    cicloVida: {
        /** Embudo por estado actual del enum EstadoReporte de PI. */
        etapas: { etapa: string; total: number; horasMedias: number | null }[];
        /** REVISION_MANUAL quietos más de `bi.vigilancia.atascado_dias` días. */
        atascados: number;
    };
    motorCaido: {
        sospecha: boolean;
        /** ISO de la última ClasificacionIA; null si jamás se clasificó. */
        ultimaClasificacionEn: string | null;
        /** Reportes de las últimas 48 h sin ClasificacionIA. */
        colaSinClasificar: number;
    };
    comercial: {
        /** Suscripciones ACTIVA con fechaFin en (ahora, +7 días]. */
        vencen7d: number;
        /** Suscripciones ACTIVA con fechaFin en (+7, +15 días]. */
        vencen15d: number;
        /** Suscripciones ACTIVA con fechaFin en (+15, +30 días]. */
        vencen30d: number;
        /** ACTIVA + tipoTitular PADRE + esFreemium. */
        freemiumActivo: number;
        /** ACTIVA + tipoTitular PADRE + no freemium. */
        premiumActivo: number;
    };
    antifraude: {
        /** Reportes esRafaga en las últimas `bi.analitica.rafaga_horas` h. */
        rafagas48h: number;
        /** Reportes en estado POSIBLE_SPAM de los últimos 7 días. */
        spamSemana: number;
        /** false si FuenteReporte está vacía (demo): la UI lo muestra honesto. */
        fuenteReporteConDatos: boolean;
    };
}

// ─── Claves de bi_config (B3) y defaults documentados ────────────────────────
const CLAVE_ATASCADO_DIAS = "bi.vigilancia.atascado_dias";
const CLAVE_MOTOR_CAIDO_HORAS = "bi.vigilancia.motor_caido_horas";
const CLAVE_ATASCADOS_ALERTA = "bi.vigilancia.atascados_alerta";
// Ventana de ráfagas: REUSA la clave ya existente del detector de /analitica.
const CLAVE_RAFAGA_HORAS = "bi.analitica.rafaga_horas";

const DEFAULT_ATASCADO_DIAS = 3;
const DEFAULT_MOTOR_CAIDO_HORAS = 6;
const DEFAULT_ATASCADOS_ALERTA = 5;
const DEFAULT_RAFAGA_HORAS = 48;

// Ventanas fijas del contrato (definidas por el brief, no son umbral de negocio).
const VENTANA_COLA_HORAS = 48;
const VENTANA_SPAM_DIAS = 7;

const MS_HORA = 3_600_000;
const MS_DIA = 86_400_000;

/** Orden canónico del embudo (enum EstadoReporte de PI). Estados con 0
 *  reportes aparecen igual (el cero es un dato real); estados no listados
 *  (enum futuro) se anexan al final en orden alfabético. */
const ORDEN_ETAPAS = [
    "PENDIENTE",
    "PROCESANDO",
    "REVISION_MANUAL",
    "REQUIERE_ANONIMIZACION",
    "CLASIFICADO",
    "CORREGIDO",
    "DUPLICADO",
    "POSIBLE_SPAM",
];

/** Entero positivo desde bi_config; valor ausente/roto → default (B3). */
function enteroPositivo(valor: string | null, defecto: number): number {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : defecto;
}

// ─── Filas del ResultSet ─────────────────────────────────────────────────────
interface FilaEtapa {
    etapa: string;
    total: number;
}
interface FilaPaso {
    etapa: string;
    horas_medias: number | null;
}
interface FilaConteo {
    total: number;
}
interface FilaUltimaClasificacion {
    ultima: Date | null;
}
interface FilaComercial {
    vencen_7d: number;
    vencen_15d: number;
    vencen_30d: number;
    freemium_activo: number;
    premium_activo: number;
}
interface FilaAntifraude {
    rafagas: number;
    spam: number;
    fuente_filas: number;
}

/**
 * Marco de vigilancia: ejecuta las consultas de los cuatro monitores y
 * devuelve el contrato VigilanciaData. Si la réplica está caída la promesa
 * rechaza: el panel muestra su estado de error (nunca cifras fabricadas).
 */
export async function getVigilancia(): Promise<VigilanciaData> {
    const [vAtascadoDias, vMotorHoras, vRafagaHoras] = await Promise.all([
        getConfig(CLAVE_ATASCADO_DIAS),
        getConfig(CLAVE_MOTOR_CAIDO_HORAS),
        getConfig(CLAVE_RAFAGA_HORAS),
    ]);
    const atascadoDias = enteroPositivo(vAtascadoDias, DEFAULT_ATASCADO_DIAS);
    const motorCaidoHoras = enteroPositivo(vMotorHoras, DEFAULT_MOTOR_CAIDO_HORAS);
    const rafagaHoras = enteroPositivo(vRafagaHoras, DEFAULT_RAFAGA_HORAS);

    const ahora = new Date();
    const limiteAtascado = new Date(ahora.getTime() - atascadoDias * MS_DIA);
    const desdeCola = new Date(ahora.getTime() - VENTANA_COLA_HORAS * MS_HORA);
    const desdeRafaga = new Date(ahora.getTime() - rafagaHoras * MS_HORA);
    const desdeSpam = new Date(ahora.getTime() - VENTANA_SPAM_DIAS * MS_DIA);
    const en7 = new Date(ahora.getTime() + 7 * MS_DIA);
    const en15 = new Date(ahora.getTime() + 15 * MS_DIA);
    const en30 = new Date(ahora.getTime() + 30 * MS_DIA);

    // (a1) Embudo por estado actual del reporte (bajas excluidas).
    const embudo = await prisma.$queryRaw<FilaEtapa[]>`
        SELECT "estado"::text AS etapa, COUNT(*)::int AS total
        FROM "Reporte"
        WHERE "eliminado" = false
        GROUP BY "estado"
    `;

    // (a2) Horas medias por paso: para cada transición, la duración del paso
    // es el tiempo desde el evento anterior del MISMO reporte (la transición
    // previa vía LAG, o la creación del reporte si es la primera). Se agrupa
    // por estado de llegada (estadoNuevo). Un estado sin transiciones no
    // aparece aquí: en el merge su horasMedias queda null (candado 9).
    const pasos = await prisma.$queryRaw<FilaPaso[]>`
        WITH pasos AS (
            SELECT t."reporteId",
                   t."estadoNuevo"::text AS etapa,
                   t."creadoEn",
                   LAG(t."creadoEn") OVER (
                       PARTITION BY t."reporteId" ORDER BY t."creadoEn"
                   ) AS previo
            FROM "TransicionReporte" t
        )
        SELECT p.etapa,
               AVG(EXTRACT(EPOCH FROM (p."creadoEn" - COALESCE(p.previo, r."creadoEn"))) / 3600.0)::float
                   AS horas_medias
        FROM pasos p
        JOIN "Reporte" r ON r."id" = p."reporteId"
        GROUP BY p.etapa
    `;

    // (a3) Atascados: REVISION_MANUAL cuyo último movimiento (o creación, si
    // nunca tuvo transición) supera el umbral de días quieto.
    const atascados = await prisma.$queryRaw<FilaConteo[]>`
        SELECT COUNT(*)::int AS total
        FROM "Reporte" r
        WHERE r."estado"::text = ${"REVISION_MANUAL"}
          AND r."eliminado" = false
          AND COALESCE(
                  (SELECT MAX(t."creadoEn") FROM "TransicionReporte" t
                    WHERE t."reporteId" = r."id"),
                  r."creadoEn"
              ) < ${limiteAtascado}
    `;

    // (b1) Última clasificación del motor IA (null si jamás clasificó).
    const ultima = await prisma.$queryRaw<FilaUltimaClasificacion[]>`
        SELECT MAX("creadoEn") AS ultima FROM "ClasificacionIA"
    `;

    // (b2) Cola: reportes recientes (48 h) sin ClasificacionIA.
    const cola = await prisma.$queryRaw<FilaConteo[]>`
        SELECT COUNT(*)::int AS total
        FROM "Reporte" r
        WHERE r."eliminado" = false
          AND r."creadoEn" >= ${desdeCola}
          AND NOT EXISTS (
              SELECT 1 FROM "ClasificacionIA" ci WHERE ci."reporteId" = r."id"
          )
    `;

    // (c) Comercial: ventanas de vencimiento sobre fechaFin y activos PADRE.
    const comercial = await prisma.$queryRaw<FilaComercial[]>`
        SELECT
            COUNT(*) FILTER (
                WHERE "estado"::text = ${"ACTIVA"}
                  AND "fechaFin" > ${ahora} AND "fechaFin" <= ${en7}
            )::int AS vencen_7d,
            COUNT(*) FILTER (
                WHERE "estado"::text = ${"ACTIVA"}
                  AND "fechaFin" > ${en7} AND "fechaFin" <= ${en15}
            )::int AS vencen_15d,
            COUNT(*) FILTER (
                WHERE "estado"::text = ${"ACTIVA"}
                  AND "fechaFin" > ${en15} AND "fechaFin" <= ${en30}
            )::int AS vencen_30d,
            COUNT(*) FILTER (
                WHERE "estado"::text = ${"ACTIVA"}
                  AND "tipoTitular"::text = ${"PADRE"}
                  AND "esFreemium" = true
            )::int AS freemium_activo,
            COUNT(*) FILTER (
                WHERE "estado"::text = ${"ACTIVA"}
                  AND "tipoTitular"::text = ${"PADRE"}
                  AND "esFreemium" = false
            )::int AS premium_activo
        FROM "Suscripcion"
    `;

    // (d) Antifraude: ráfagas en ventana configurada, spam de la semana y
    // filas reales de FuenteReporte (0 en demo → honesto).
    const antifraude = await prisma.$queryRaw<FilaAntifraude[]>`
        SELECT
            (SELECT COUNT(*) FROM "Reporte"
              WHERE "esRafaga" = true
                AND "eliminado" = false
                AND "creadoEn" >= ${desdeRafaga})::int AS rafagas,
            (SELECT COUNT(*) FROM "Reporte"
              WHERE "estado"::text = ${"POSIBLE_SPAM"}
                AND "eliminado" = false
                AND "creadoEn" >= ${desdeSpam})::int AS spam,
            (SELECT COUNT(*) FROM "FuenteReporte")::int AS fuente_filas
    `;

    // Merge del embudo con las horas medias por paso.
    const horasPorEtapa = new Map(pasos.map((p) => [p.etapa, p.horas_medias]));
    const totalPorEtapa = new Map(embudo.map((e) => [e.etapa, e.total]));
    const conocidas = new Set(ORDEN_ETAPAS);
    const extras = embudo
        .map((e) => e.etapa)
        .filter((e) => !conocidas.has(e))
        .sort();
    const etapas = [...ORDEN_ETAPAS, ...extras].map((etapa) => ({
        etapa,
        total: totalPorEtapa.get(etapa) ?? 0,
        horasMedias: (() => {
            const h = horasPorEtapa.get(etapa);
            return h === undefined || h === null ? null : redondear1(h);
        })(),
    }));

    // (b) Sospecha de motor caído: la última clasificación es más vieja que
    // el umbral (o no hay ninguna jamás) Y hay cola reciente sin clasificar.
    const ultimaClasificacion = ultima[0]?.ultima ?? null;
    const colaSinClasificar = cola[0]?.total ?? 0;
    const clasificacionVieja =
        ultimaClasificacion === null ||
        ahora.getTime() - ultimaClasificacion.getTime() >
            motorCaidoHoras * MS_HORA;
    const sospecha = clasificacionVieja && colaSinClasificar > 0;

    const c = comercial[0] ?? {
        vencen_7d: 0,
        vencen_15d: 0,
        vencen_30d: 0,
        freemium_activo: 0,
        premium_activo: 0,
    };
    const a = antifraude[0] ?? { rafagas: 0, spam: 0, fuente_filas: 0 };

    return {
        cicloVida: {
            etapas,
            atascados: atascados[0]?.total ?? 0,
        },
        motorCaido: {
            sospecha,
            ultimaClasificacionEn: ultimaClasificacion?.toISOString() ?? null,
            colaSinClasificar,
        },
        comercial: {
            vencen7d: c.vencen_7d,
            vencen15d: c.vencen_15d,
            vencen30d: c.vencen_30d,
            freemiumActivo: c.freemium_activo,
            premiumActivo: c.premium_activo,
        },
        antifraude: {
            rafagas48h: a.rafagas,
            spamSemana: a.spam,
            fuenteReporteConDatos: a.fuente_filas > 0,
        },
    };
}

// ─── Insights del marco de vigilancia ("BI detectó · sin que le preguntes") ──
// Reglas deterministas sobre el VigilanciaData:
//   · motor caído (sospecha)          → ambar  (atención operativa)
//   · atascados > umbral              → ambar
//   · ráfagas en la ventana           → ambar  (severidad máxima del contrato
//                                       Insight: no existe "rubí"; el detalle
//                                       lo dice con lenguaje de alerta)
//   · vencimientos en 15 días         → cielo  (llamar antes del vencimiento)
// Candado 9: si getVigilancia no puede leer la réplica NO se afirma nada → [].

const MAX_INSIGHTS_VIGILANCIA = 4;

/**
 * Insights generados por los monitores de vigilancia para el Pulso. Máximo 4,
 * ordenados por severidad (ambar → cielo) y orden fijo de regla dentro de la
 * misma severidad (determinista: mismos datos → mismo insight primero).
 */
export async function getInsightsVigilancia(): Promise<Insight[]> {
    let data: VigilanciaData;
    let atascadosAlerta: number;
    let rafagaHoras: number;
    try {
        const [vigilancia, vAlerta, vRafaga] = await Promise.all([
            getVigilancia(),
            getConfig(CLAVE_ATASCADOS_ALERTA),
            getConfig(CLAVE_RAFAGA_HORAS),
        ]);
        data = vigilancia;
        atascadosAlerta = enteroPositivo(vAlerta, DEFAULT_ATASCADOS_ALERTA);
        rafagaHoras = enteroPositivo(vRafaga, DEFAULT_RAFAGA_HORAS);
    } catch (error) {
        console.warn(
            `[Vigilancia] Insights sin resultado: la réplica no respondió — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }

    const insights: Insight[] = [];

    // ambar 1 · motor de clasificación posiblemente detenido (SÍNTOMA).
    if (data.motorCaido.sospecha) {
        const cuando =
            data.motorCaido.ultimaClasificacionEn === null
                ? "no hay ninguna clasificación registrada"
                : `última clasificación: ${data.motorCaido.ultimaClasificacionEn.slice(0, 16).replace("T", " ")} UTC`;
        insights.push({
            severidad: "ambar",
            titulo: "El motor de clasificación podría estar detenido",
            detalle: `${data.motorCaido.colaSinClasificar} reportes de las últimas ${VENTANA_COLA_HORAS} h siguen sin clasificar y ${cuando}. Es un síntoma en los datos, no una certeza: verificar worker y Ollama en PI.`,
            accion: { etiqueta: "Ver operación →", href: "/operacion" },
        });
    }

    // ambar 2 · reportes atascados en revisión manual por encima del umbral.
    if (data.cicloVida.atascados > atascadosAlerta) {
        insights.push({
            severidad: "ambar",
            titulo: `${data.cicloVida.atascados} reportes atascados en revisión manual`,
            detalle: `Llevan más del umbral de días sin movimiento. Umbral de alerta configurado: ${atascadosAlerta}.`,
            accion: { etiqueta: "Ver operación →", href: "/operacion" },
        });
    }

    // ambar 3 · ráfagas recientes (posible abuso coordinado).
    if (data.antifraude.rafagas48h > 0) {
        insights.push({
            severidad: "ambar",
            titulo: `${data.antifraude.rafagas48h} ${data.antifraude.rafagas48h === 1 ? "ráfaga" : "ráfagas"} en las últimas ${rafagaHoras} h`,
            detalle: "Reportes marcados como ráfaga por PI: posible abuso coordinado o campaña. Conviene revisarlos antes de que inflen las agregaciones.",
            accion: { etiqueta: "Ver operación →", href: "/operacion" },
        });
    }

    // cielo · suscripciones que vencen en los próximos 15 días: llamar.
    const vencen15 = data.comercial.vencen7d + data.comercial.vencen15d;
    if (vencen15 > 0) {
        insights.push({
            severidad: "cielo",
            titulo: `${vencen15} ${vencen15 === 1 ? "suscripción vence" : "suscripciones vencen"} en 15 días`,
            detalle: `${data.comercial.vencen7d} en los próximos 7 días y ${data.comercial.vencen15d} entre 8 y 15. Llamar antes del vencimiento, no después.`,
            accion: { etiqueta: "Llamar esta semana →", href: "/operacion" },
        });
    }

    const orden: Record<Insight["severidad"], number> = { ambar: 0, cielo: 1, pino: 2 };
    return insights
        .sort((a, b) => orden[a.severidad] - orden[b.severidad])
        .slice(0, MAX_INSIGHTS_VIGILANCIA);
}

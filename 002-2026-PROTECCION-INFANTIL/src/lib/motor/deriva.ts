/**
 * SPEC-172 (Pilar D.5) — Deriva del motor de clasificación en producción.
 *
 * Qué mide: por categoría y semana operativa (lunes-domingo, America/Bogota),
 * la TASA DE CORRECCIÓN sobre lo revisado (correcciones humanas confirmadas /
 * clasificaciones de producción) comparada con el error del banco curado
 * (1 − recall por categoría del último SimulacionRun COMPLETADA). NO es un
 * error absoluto: es la señal de que el motor está rindiendo peor en
 * producción que en el banco.
 *
 * Fórmula fijada por ZEUS (puntos porcentuales):
 *   brechaPp = (tasaCorreccion − (1 − accuracyBanco)) × 100
 *
 * Solo LEE SimulacionRun/ClasificacionIA/CorreccionAdmin y ESCRIBE el snapshot
 * (DerivaMotorSnapshot). Nunca toca el motor, la rúbrica ni textos de reportes.
 *
 * Ojo (frontera DAL, Q-3): el import de prisma es RELATIVO a propósito — el
 * alias "@/lib/prisma" está prohibido fuera de src/lib/dal/ (eslint
 * no-restricted-imports + scripts/arch/dal-frontera.test.ts).
 */
import { Prisma } from "@prisma/client";
import type { DerivaMotorSnapshot } from "@prisma/client";
import { prisma } from "../prisma";
import { getParametroSistema } from "../parametros";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Parámetros (ParametroSistema, sembrados en prisma/seed.ts)
// ---------------------------------------------------------------------------

const PARAM_KEYS = {
    enabled: "motor.deriva.enabled",
    umbralPp: "motor.deriva.umbral_pp",
    minMuestra: "motor.deriva.min_muestra",
    ventanaDias: "motor.deriva.ventana_dias",
    destinatarios: "motor.deriva.email.destinatarios",
    emailSiempre: "motor.deriva.email.siempre",
} as const;

export interface ParametrosDeriva {
    enabled: boolean;
    umbralPp: number;
    minMuestra: number;
    ventanaDias: number;
    destinatarios: string[];
    emailSiempre: boolean;
}

/** Defaults idénticos a los del seed: el servicio debe funcionar sin filas. */
export const DEFAULTS_DERIVA: ParametrosDeriva = {
    enabled: true,
    umbralPp: 15,
    minMuestra: 20,
    ventanaDias: 7,
    destinatarios: [],
    emailSiempre: false,
};

function numeroParametro(valor: string | null | undefined, porDefecto: number): number {
    const n = Number(valor);
    return Number.isFinite(n) && n >= 0 ? n : porDefecto;
}

export async function leerParametrosDeriva(): Promise<ParametrosDeriva> {
    const [enabled, umbral, minMuestra, ventana, destinatarios, siempre] = await Promise.all([
        getParametroSistema(PARAM_KEYS.enabled),
        getParametroSistema(PARAM_KEYS.umbralPp),
        getParametroSistema(PARAM_KEYS.minMuestra),
        getParametroSistema(PARAM_KEYS.ventanaDias),
        getParametroSistema(PARAM_KEYS.destinatarios),
        getParametroSistema(PARAM_KEYS.emailSiempre),
    ]);
    return {
        // Sin fila el default es true (así lo siembra el seed).
        enabled: enabled?.valor !== "false",
        umbralPp: numeroParametro(umbral?.valor, DEFAULTS_DERIVA.umbralPp),
        minMuestra: Math.floor(numeroParametro(minMuestra?.valor, DEFAULTS_DERIVA.minMuestra)),
        ventanaDias: Math.max(1, Math.floor(numeroParametro(ventana?.valor, DEFAULTS_DERIVA.ventanaDias))),
        destinatarios: (destinatarios?.valor ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        emailSiempre: siempre?.valor === "true",
    };
}

// ---------------------------------------------------------------------------
// Baseline del banco curado (SimulacionRun COMPLETADA más reciente)
// ---------------------------------------------------------------------------

export interface BaselineBanco {
    /** recall por categoría (0..1), tal como lo calcula src/lib/simulacion/metricas.ts. */
    porCategoria: Map<string, number>;
    fechaFin: Date;
    runId: string;
}

function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Extrae `porCategoria[cat].recall` del metricasJson con type guards (strict,
 * sin any). Devuelve null si la forma no es la del banco; un mapa vacío es
 * válido (run sin métricas por categoría: equivale a "sin baseline usable").
 */
export function parsearRecallPorCategoria(metricasJson: unknown): Map<string, number> | null {
    if (!esObjetoPlano(metricasJson)) return null;
    const porCategoria = metricasJson.porCategoria;
    if (!esObjetoPlano(porCategoria)) return null;
    const mapa = new Map<string, number>();
    for (const [categoria, metricas] of Object.entries(porCategoria)) {
        if (esObjetoPlano(metricas) && typeof metricas.recall === "number" && Number.isFinite(metricas.recall)) {
            mapa.set(categoria, metricas.recall);
        }
    }
    return mapa;
}

/**
 * Última SimulacionRun COMPLETADA con métricas (fechaFin desc). Null si no hay
 * banco curado todavía → la deriva se mide igual, pero sin brecha (nulls).
 */
export async function obtenerBaselineBanco(): Promise<BaselineBanco | null> {
    const run = await prisma.simulacionRun.findFirst({
        where: {
            estado: "COMPLETADA",
            fechaFin: { not: null },
            metricasJson: { not: Prisma.DbNull },
        },
        orderBy: { fechaFin: "desc" },
        select: { id: true, fechaFin: true, metricasJson: true },
    });
    if (!run || !run.fechaFin) return null;
    const porCategoria = parsearRecallPorCategoria(run.metricasJson);
    if (!porCategoria) return null;
    return { porCategoria, fechaFin: run.fechaFin, runId: run.id };
}

// ---------------------------------------------------------------------------
// Semana operativa en America/Bogota (UTC-5 fijo, sin DST; sin librerías)
// ---------------------------------------------------------------------------

/** America/Bogota es UTC-5 todo el año (Colombia no usa horario de verano). */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface SemanaBogota {
    /** Lunes 00:00 -05:00 de la semana medida (inclusive). */
    desde: Date;
    /** Lunes 00:00 -05:00 de la semana siguiente (exclusive). */
    hasta: Date;
    /** = desde; la clave de partición del snapshot. */
    semanaInicio: Date;
}

/** Componentes de fecha/hora "de pared" en Bogotá leídos como si fueran UTC. */
function partesBogota(ahora: Date): { anio: number; mes: number; dia: number; diaSemana: number } {
    const pared = new Date(ahora.getTime() - OFFSET_BOGOTA_MS);
    return {
        anio: pared.getUTCFullYear(),
        mes: pared.getUTCMonth(),
        dia: pared.getUTCDate(),
        diaSemana: pared.getUTCDay(), // 0=domingo … 1=lunes
    };
}

/** Instante real de las 00:00:00 Bogotá del día dado (offset -05:00 explícito). */
function medianocheBogota(anio: number, mes: number, dia: number): Date {
    const iso = `${anio}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return new Date(`${iso}T00:00:00.000-05:00`);
}

/** Lunes 00:00 -05:00 de la semana (lunes-domingo) que contiene `ahora`. */
export function lunesSemanaBogota(ahora: Date = new Date()): Date {
    const { anio, mes, dia, diaSemana } = partesBogota(ahora);
    const diasDesdeLunes = (diaSemana + 6) % 7; // lunes=0, domingo=6
    const medianocheHoy = medianocheBogota(anio, mes, dia);
    return new Date(medianocheHoy.getTime() - diasDesdeLunes * DIA_MS);
}

/**
 * La semana operativa ANTERIOR completa: [lunes pasado 00:00, lunes actual
 * 00:00) en America/Bogota. Es la ventana que mide el cron de los lunes 07:00.
 */
export function semanaAnteriorBogota(ahora: Date = new Date()): SemanaBogota {
    const hasta = lunesSemanaBogota(ahora);
    const desde = new Date(hasta.getTime() - 7 * DIA_MS);
    return { desde, hasta, semanaInicio: desde };
}

// ---------------------------------------------------------------------------
// Cálculo y persistencia del snapshot
// ---------------------------------------------------------------------------

export interface FilaDeriva {
    categoria: string;
    total: number;
    correcciones: number;
    tasaCorreccion: number;
    accuracyBanco: number | null;
    brechaPp: number | null;
    alertada: boolean;
    muestraInsuficiente: boolean;
}

/**
 * Calcula la deriva por categoría en la ventana [desde, hasta) y persiste el
 * snapshot con upsert por (semanaInicio, categoria) (recalcular no duplica).
 *
 * - total: ClasificacionIA de producción con creadoEn en la ventana.
 * - correcciones: CorreccionAdmin confirmada=true con creadoEn en la ventana,
 *   agrupadas por categoriaOriginal (la que asignó el motor).
 * - brechaPp solo si el banco tiene recall para esa categoría (null si no).
 * - alertada = brechaPp > umbral_pp AND total >= min_muestra.
 *
 * Devuelve las filas calculadas (ordenadas por categoría).
 */
export async function calcularDeriva(desde: Date, hasta: Date, semanaInicio: Date): Promise<FilaDeriva[]> {
    const [params, baseline, totales, correcciones] = await Promise.all([
        leerParametrosDeriva(),
        obtenerBaselineBanco(),
        prisma.clasificacionIA.groupBy({
            by: ["categoria"],
            where: { creadoEn: { gte: desde, lt: hasta } },
            _count: { _all: true },
        }),
        prisma.correccionAdmin.groupBy({
            by: ["categoriaOriginal"],
            where: { confirmada: true, creadoEn: { gte: desde, lt: hasta } },
            _count: { _all: true },
        }),
    ]);

    const totalPorCategoria = new Map<string, number>(totales.map((g) => [g.categoria as string, g._count._all]));
    const correccionesPorCategoria = new Map<string, number>(
        correcciones.map((g) => [g.categoriaOriginal as string, g._count._all])
    );
    const categorias = [...new Set([...totalPorCategoria.keys(), ...correccionesPorCategoria.keys()])].sort();

    const filas: FilaDeriva[] = categorias.map((categoria) => {
        const total = totalPorCategoria.get(categoria) ?? 0;
        const corregidas = correccionesPorCategoria.get(categoria) ?? 0;
        const tasaCorreccion = total > 0 ? corregidas / total : 0;
        const accuracyBanco = baseline?.porCategoria.get(categoria) ?? null;
        // Fórmula exacta (ZEUS): brecha en puntos porcentuales vs el error del banco.
        const brechaPp = accuracyBanco !== null ? (tasaCorreccion - (1 - accuracyBanco)) * 100 : null;
        const muestraInsuficiente = total < params.minMuestra;
        const alertada = brechaPp !== null && brechaPp > params.umbralPp && !muestraInsuficiente;
        return {
            categoria,
            total,
            correcciones: corregidas,
            tasaCorreccion,
            accuracyBanco,
            brechaPp,
            alertada,
            muestraInsuficiente,
        };
    });

    if (filas.length > 0) {
        await prisma.$transaction(
            filas.map((fila) =>
                prisma.derivaMotorSnapshot.upsert({
                    where: { semanaInicio_categoria: { semanaInicio, categoria: fila.categoria } },
                    update: {
                        total: fila.total,
                        correcciones: fila.correcciones,
                        tasaCorreccion: fila.tasaCorreccion,
                        accuracyBanco: fila.accuracyBanco,
                        brechaPp: fila.brechaPp,
                        alertada: fila.alertada,
                    },
                    create: {
                        semanaInicio,
                        categoria: fila.categoria,
                        total: fila.total,
                        correcciones: fila.correcciones,
                        tasaCorreccion: fila.tasaCorreccion,
                        accuracyBanco: fila.accuracyBanco,
                        brechaPp: fila.brechaPp,
                        alertada: fila.alertada,
                    },
                })
            )
        );
    }

    const alertadas = filas.filter((f) => f.alertada).length;
    logger.info(
        `[MotorDeriva] Cálculo de deriva: ok — ${filas.length} categorías (${alertadas} alertadas), ` +
            `ventana ${desde.toISOString().slice(0, 10)}→${hasta.toISOString().slice(0, 10)}, ` +
            `baseline=${baseline ? baseline.runId : "sin banco"}`
    );
    return filas;
}

// ---------------------------------------------------------------------------
// Lectura del snapshot para el tablero (GET /api/admin/motor/deriva)
// ---------------------------------------------------------------------------

/**
 * Última semana medida con todas sus filas (el tablero solo lee el snapshot;
 * cero groupBys por carga). Null si el job aún no ha corrido nunca.
 */
export async function obtenerUltimoSnapshot(): Promise<{ semanaInicio: Date; filas: DerivaMotorSnapshot[] } | null> {
    const ultimo = await prisma.derivaMotorSnapshot.findFirst({
        orderBy: { semanaInicio: "desc" },
        select: { semanaInicio: true },
    });
    if (!ultimo) return null;
    const filas = await prisma.derivaMotorSnapshot.findMany({
        where: { semanaInicio: ultimo.semanaInicio },
        orderBy: { categoria: "asc" },
    });
    return { semanaInicio: ultimo.semanaInicio, filas };
}

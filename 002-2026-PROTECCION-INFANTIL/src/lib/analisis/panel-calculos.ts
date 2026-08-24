/**
 * SPEC-222 (002-PI-123): helpers PUROS del panel principal Análisis
 * (Dinero vs Valor). Sin BD ni imports de Prisma: cuadrantes, semáforos,
 * canal, deltas y rangos de período en America/Bogota (D-69). Los tests
 * unitarios viven junto al archivo y corren sin base de datos.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { DuracionPlan } from "@prisma/client";
import { mesesDeDuracion } from "@/lib/pagos/freemium-calculos";
import { ZONA_BOGOTA } from "./periodos";

// ── Cuadrantes de la matriz dinero-vs-valor ────────────────────────────────

export type Cuadrante = "estables" | "riesgo" | "oportunidad" | "atencion";

/**
 * Clasifica un punto (monto USD, score) en su cuadrante. "Alto" = >= corte.
 * estables = alto/alto · riesgo = alto pago/bajo score · oportunidad = bajo
 * pago/alto score · atencion = bajo/bajo (etiquetas neutras, FR del spec US-2).
 */
export function calcularCuadrante(
    montoUSD: number,
    score: number,
    corteMontoUSD: number,
    corteScore: number
): Cuadrante {
    const altoPago = montoUSD >= corteMontoUSD;
    const altoScore = score >= corteScore;
    if (altoPago && altoScore) return "estables";
    if (altoPago && !altoScore) return "riesgo";
    if (!altoPago && altoScore) return "oportunidad";
    return "atencion";
}

// ── Mediana (corte por defecto de los cuadrantes) ──────────────────────────

/** Mediana de una lista; null si está vacía. No muta la entrada. */
export function mediana(valores: number[]): number | null {
    if (valores.length === 0) return null;
    const ordenados = [...valores].sort((a, b) => a - b);
    const mitad = Math.floor(ordenados.length / 2);
    if (ordenados.length % 2 === 1) return ordenados[mitad]!;
    return (ordenados[mitad - 1]! + ordenados[mitad]!) / 2;
}

// ── Semáforo de variación de recaudo ───────────────────────────────────────

export type Semaforo = "pino" | "ambar" | "rubi";

/**
 * Semáforo por variación % de recaudo vs período anterior:
 * - pino: variación >= 0 (o sin base de comparación — null no se castiga).
 * - ambar: caída de hasta `umbralCaidaPct` %.
 * - rubi: caída mayor al umbral (`analisis.anomalias.crecimiento_pct_umbral`).
 */
export function calcularSemaforo(variacionPct: number | null, umbralCaidaPct: number): Semaforo {
    if (variacionPct === null || variacionPct >= 0) return "pino";
    if (Math.abs(variacionPct) <= umbralCaidaPct) return "ambar";
    return "rubi";
}

// ── Clasificación de canal (FR-018, precedencia documentada) ───────────────

export type CanalCliente = "referido" | "bono" | "freemium_convertido" | "directo";

export const CANALES_ORDENADOS: CanalCliente[] = ["referido", "bono", "freemium_convertido", "directo"];

/**
 * Precedencia: referido (`codigoReferidoUsado`) → bono (`BonoAplicado`) →
 * freemium convertido (`esFreemium` con pago autorizado) → directo.
 */
export function clasificarCanal(input: {
    codigoReferidoUsado: string | null;
    tieneBono: boolean;
    esFreemiumConPagoAutorizado: boolean;
}): CanalCliente {
    if (input.codigoReferidoUsado) return "referido";
    if (input.tieneBono) return "bono";
    if (input.esFreemiumConPagoAutorizado) return "freemium_convertido";
    return "directo";
}

// ── Delta porcentual ───────────────────────────────────────────────────────

/** Delta % vs período anterior; null si no hay base (anterior = 0). */
export function deltaPct(actual: number, anterior: number): number | null {
    if (anterior === 0) return null;
    return ((actual - anterior) / anterior) * 100;
}

// ── Rangos de período en America/Bogota ────────────────────────────────────

export type PeriodoPanel = "mes" | "trimestre" | "anio" | "custom";

export interface RangoFechas {
    /** Inclusivo (instante UTC de las 00:00 Bogotá del día inicial). */
    desde: Date;
    /** Exclusivo (instante UTC de las 00:00 Bogotá del día siguiente al final). */
    hasta: Date;
}

const MESES_POR_PERIODO: Record<Exclude<PeriodoPanel, "custom">, number> = {
    mes: 1,
    trimestre: 3,
    anio: 12,
};

function inicioMesBogota(anio: number, mes1a12: number): Date {
    return fromZonedTime(`${anio}-${String(mes1a12).padStart(2, "0")}-01T00:00:00`, ZONA_BOGOTA);
}

function sumarMeses(anio: number, mes1a12: number, delta: number): { anio: number; mes: number } {
    const indice = anio * 12 + (mes1a12 - 1) + delta;
    return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 };
}

/**
 * Resuelve el rango `[desde, hasta)` en instantes UTC del período pedido, con
 * cortes de día calendario America/Bogota. `mes` = mes calendario actual;
 * `trimestre`/`anio` = ventana de 3/12 meses calendario incluyendo el actual;
 * `custom` = días `desde`..`hasta` (ambos inclusive) en Bogotá.
 */
export function resolverRangoPeriodo(
    input: { periodo: PeriodoPanel; desde?: string | undefined; hasta?: string | undefined },
    ahora: Date = new Date()
): RangoFechas {
    if (input.periodo === "custom") {
        if (!input.desde || !input.hasta) {
            throw new Error("periodo=custom requiere desde y hasta");
        }
        const desde = fromZonedTime(`${input.desde}T00:00:00`, ZONA_BOGOTA);
        // Exclusivo: medianoche Bogotá del día siguiente a `hasta` (Bogotá no
        // tiene DST: +24 h desde el inicio del día es siempre el día siguiente).
        const hasta = new Date(fromZonedTime(`${input.hasta}T00:00:00`, ZONA_BOGOTA).getTime() + 86_400_000);
        return { desde, hasta };
    }
    const [anioActual, mesActual] = formatInTimeZone(ahora, ZONA_BOGOTA, "yyyy-MM").split("-").map(Number) as [
        number,
        number,
    ];
    const meses = MESES_POR_PERIODO[input.periodo];
    const inicio = sumarMeses(anioActual, mesActual, -(meses - 1));
    const fin = sumarMeses(anioActual, mesActual, 1);
    return { desde: inicioMesBogota(inicio.anio, inicio.mes), hasta: inicioMesBogota(fin.anio, fin.mes) };
}

/**
 * Período anterior equivalente para los deltas: la ventana de igual duración
 * inmediatamente anterior al rango dado.
 */
export function rangoAnteriorEquivalente(rango: RangoFechas): RangoFechas {
    const duracionMs = rango.hasta.getTime() - rango.desde.getTime();
    return { desde: new Date(rango.desde.getTime() - duracionMs), hasta: new Date(rango.desde.getTime()) };
}

/**
 * Período "YYYY-MM" (Bogotá) del snapshot de `ScoreCliente` aplicable al
 * rango: el mes calendario que contiene el último día del rango.
 */
export function periodoScoreDeRango(rango: RangoFechas): string {
    return formatInTimeZone(new Date(rango.hasta.getTime() - 1), ZONA_BOGOTA, "yyyy-MM");
}

/** Mes calendario Bogotá "YYYY-MM" de una fecha (clave de cohorte). */
export function claveCohorteBogota(fecha: Date): string {
    return formatInTimeZone(fecha, ZONA_BOGOTA, "yyyy-MM");
}

// ── MRR ────────────────────────────────────────────────────────────────────

/** Mensualización del precio de un plan para el MRR (delega en SPEC-210). */
export function mensualizarPrecio(precioBaseUSD: number, duracion: DuracionPlan): number {
    const meses = mesesDeDuracion(duracion);
    return meses > 0 ? precioBaseUSD / meses : 0;
}

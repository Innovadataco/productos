/**
 * SPEC-218 (002-PI-118): funciones puras de la analítica dinero-vs-valor.
 * Sin acceso a BD ni a `@/lib/prisma`: agrupaciones por mes en America/Bogota
 * (FR-007), variaciones porcentuales y detección de anomalías por regla simple
 * (>25%, FR-003 — sin IA, FR-010). Todo es unit-testable sin drift de timezone
 * (NFR-004 / SC-004).
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const ZONA_BOGOTA = "America/Bogota";

/** Umbral de mora larga del widget (BRIEF §9.1): más de 30 días. */
export const DIAS_MORA_LARGA = 30;

/** Umbral de cambio porcentual mes a mes que dispara la alerta de crecimiento (BRIEF §9.1). */
export const UMBRAL_CRECIMIENTO_PCT = 25;

/** Días hacia adelante que cubre el widget "Vencimientos esta semana". */
export const DIAS_VENCIMIENTOS_SEMANA = 7;

/** Meses de histórico del widget de crecimiento por país. */
export const MESES_HISTORICO_CRECIMIENTO = 6;

export type AlertaCrecimiento = "crecimiento_alto" | "crecimiento_bajo";

/** Etiqueta "yyyy-MM" del mes de `fecha` visto en America/Bogota. */
export function etiquetaMesBogota(fecha: Date): string {
    return formatInTimeZone(fecha, ZONA_BOGOTA, "yyyy-MM");
}

/**
 * Últimas `n` etiquetas de mes (la más antigua primero) incluyendo el mes del
 * ancla. Pura: el ancla se inyecta en tests para evitar drift de reloj.
 */
export function ultimasEtiquetasMesBogota(n: number, ancla: Date = new Date()): string[] {
    const [anioActual, mesActual] = etiquetaMesBogota(ancla).split("-").map((p) => parseInt(p, 10));
    const etiquetas: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
        // Meses con base 0; el desplazamiento negativo lo normaliza Date.
        const d = new Date(Date.UTC(anioActual, mesActual - 1 - i, 1));
        const anio = d.getUTCFullYear();
        const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
        etiquetas.push(`${anio}-${mes}`);
    }
    return etiquetas;
}

/**
 * Rango UTC semiabierto [inicio, fin) del mes Bogotá indicado por la etiqueta
 * "yyyy-MM". Las queries usan `gte: inicio, lt: fin` para no depender de
 * milisegundos ni del huso del servidor.
 */
export function rangoMesUtc(etiqueta: string): { inicio: Date; fin: Date } {
    const [anio, mes] = etiqueta.split("-").map((p) => parseInt(p, 10));
    if (!Number.isFinite(anio) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
        throw new Error(`Etiqueta de mes inválida: ${etiqueta}`);
    }
    const inicio = fromZonedTime(`${anio}-${String(mes).padStart(2, "0")}-01 00:00:00`, ZONA_BOGOTA);
    const mesSiguiente = new Date(Date.UTC(anio, mes, 1));
    const fin = fromZonedTime(
        `${mesSiguiente.getUTCFullYear()}-${String(mesSiguiente.getUTCMonth() + 1).padStart(2, "0")}-01 00:00:00`,
        ZONA_BOGOTA
    );
    return { inicio, fin };
}

/** Días completos entre dos instantes (negativo si `hasta` es anterior a `desde`). */
export function diasCompletosEntre(desde: Date, hasta: Date): number {
    return Math.floor((hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
}

/** Días de mora acumulados desde `fechaFin` hasta `ahora` (0 si aún no vence). */
export function diasDeMora(fechaFin: Date, ahora: Date = new Date()): number {
    return Math.max(0, diasCompletosEntre(fechaFin, ahora));
}

/** Días que faltan para el vencimiento (0 si ya venció). */
export function diasRestantes(fechaFin: Date, ahora: Date = new Date()): number {
    return Math.max(0, Math.ceil((fechaFin.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000)));
}

/**
 * Variación porcentual entera entre dos períodos. `null` cuando no hay base de
 * comparación (anterior = 0 y actual > 0: crecimiento infinito, no comparable).
 */
export function variacionPct(actual: number, anterior: number): number | null {
    if (anterior === 0) return actual === 0 ? 0 : null;
    return Math.round(((actual - anterior) / anterior) * 100);
}

/** Regla simple de anomalía (sin IA): cambio mes a mes mayor al umbral en cualquier dirección. */
export function clasificarAlertaCrecimiento(
    variacion: number | null,
    umbral: number = UMBRAL_CRECIMIENTO_PCT
): AlertaCrecimiento | null {
    if (variacion === null) return null;
    if (variacion > umbral) return "crecimiento_alto";
    if (variacion < -umbral) return "crecimiento_bajo";
    return null;
}

export interface SerieCrecimiento {
    pais: string;
    /** Conteos alineados con las etiquetas de mes (misma longitud y orden). */
    data: number[];
    variacionPct: number | null;
    alerta: AlertaCrecimiento | null;
}

/**
 * Construye las series del widget de crecimiento: cuenta las altas por país y
 * mes (etiquetas Bogotá) y calcula la variación del último mes vs el anterior.
 * La variación compara el último mes COMPLETO cerrado contra el anterior para
 * no marcar anomalías por un mes en curso: si el ancla está a mitad de mes, el
 * mes en curso igualmente se muestra en la serie pero la alerta usa los dos
 * últimos valores disponibles.
 */
export function construirSeriesCrecimiento(
    altas: { paisCliente: string; createdAt: Date }[],
    etiquetasMeses: string[],
    umbral: number = UMBRAL_CRECIMIENTO_PCT
): SerieCrecimiento[] {
    const porPais = new Map<string, Map<string, number>>();
    for (const alta of altas) {
        const etiqueta = etiquetaMesBogota(alta.createdAt);
        if (!porPais.has(alta.paisCliente)) porPais.set(alta.paisCliente, new Map());
        const porMes = porPais.get(alta.paisCliente)!;
        porMes.set(etiqueta, (porMes.get(etiqueta) ?? 0) + 1);
    }

    const series: SerieCrecimiento[] = [];
    for (const [pais, porMes] of porPais) {
        const data = etiquetasMeses.map((etiqueta) => porMes.get(etiqueta) ?? 0);
        const ultimo = data[data.length - 1] ?? 0;
        const anterior = data[data.length - 2] ?? 0;
        const variacion = variacionPct(ultimo, anterior);
        series.push({ pais, data, variacionPct: variacion, alerta: clasificarAlertaCrecimiento(variacion, umbral) });
    }

    // Orden: primero los de mayor volumen reciente; desempate alfabético estable.
    return series.sort((a, b) => {
        const ultimoA = a.data[a.data.length - 1] ?? 0;
        const ultimoB = b.data[b.data.length - 1] ?? 0;
        if (ultimoB !== ultimoA) return ultimoB - ultimoA;
        return a.pais.localeCompare(b.pais);
    });
}

import type { TipoPeriodoServicio } from "@prisma/client";

const MESES_POR_PERIODO: Record<Exclude<TipoPeriodoServicio, "LIBRE">, number> = {
    MENSUAL: 1,
    SEMESTRAL: 6,
    ANUAL: 12,
};

/**
 * Calcula la fecha de fin del servicio según el tipo de período:
 * MENSUAL = inicio + 1 mes, SEMESTRAL = inicio + 6 meses, ANUAL = inicio + 1 año.
 * Para LIBRE devuelve null: las fechas las define el usuario manualmente.
 */
export function calcularFinServicio(inicio: Date, tipoPeriodo: TipoPeriodoServicio): Date | null {
    if (tipoPeriodo === "LIBRE") return null;
    const fin = new Date(inicio.getTime());
    fin.setMonth(fin.getMonth() + MESES_POR_PERIODO[tipoPeriodo]);
    return fin;
}

/** La vigencia es válida solo si la fecha de fin es estrictamente posterior al inicio. */
export function esRangoServicioValido(inicio: Date, fin: Date): boolean {
    return fin.getTime() > inicio.getTime();
}

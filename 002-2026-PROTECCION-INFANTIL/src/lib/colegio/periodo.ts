import type { TipoPeriodoServicio } from "@prisma/client";
import { addMonths } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const ZONA_BOGOTA = "America/Bogota";

const MESES_POR_PERIODO: Record<Exclude<TipoPeriodoServicio, "LIBRE">, number> = {
    MENSUAL: 1,
    SEMESTRAL: 6,
    ANUAL: 12,
};

/**
 * Calcula la fecha de fin del servicio según el tipo de período:
 * MENSUAL = inicio + 1 mes, SEMESTRAL = inicio + 6 meses, ANUAL = inicio + 1 año.
 * Para LIBRE devuelve null: las fechas las define el usuario manualmente.
 *
 * SPEC-795: la suma de meses va en el día calendario **Bogotá** y CLAMPA al último día del mes
 * destino (date-fns `addMonths`), NUNCA desborda. El `Date.setMonth` nativo anterior DESBORDABA
 * (31-ene + 1 mes → 3-mar en vez de 28-feb) regalando días; y sumar sobre el instante UTC crudo
 * recortaba en el calendario equivocado cerca de fin de mes. `toZonedTime → addMonths → fromZonedTime`
 * cierra ambas puertas — el mismo método Bogotá-aware del hermano freemium (FR-003).
 */
export function calcularFinServicio(inicio: Date, tipoPeriodo: TipoPeriodoServicio): Date | null {
    if (tipoPeriodo === "LIBRE") return null;
    return fromZonedTime(
        addMonths(toZonedTime(inicio, ZONA_BOGOTA), MESES_POR_PERIODO[tipoPeriodo]),
        ZONA_BOGOTA,
    );
}

/** La vigencia es válida solo si la fecha de fin es estrictamente posterior al inicio. */
export function esRangoServicioValido(inicio: Date, fin: Date): boolean {
    return fin.getTime() > inicio.getTime();
}

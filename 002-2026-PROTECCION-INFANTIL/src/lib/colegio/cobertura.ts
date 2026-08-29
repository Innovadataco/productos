/**
 * SPEC-169 (Fase G): servicio de cobertura de identificadores por tipo de sujeto.
 * Expone el DTO que consumen los anillos de cobertura de la home del rector.
 */
import { CoberturaRepository, type CoberturaColegio } from "@/lib/dal/repositories/cobertura";

export type { CoberturaColegio } from "@/lib/dal/repositories/cobertura";

/**
 * Devuelve el porcentaje y conteos de estudiantes, profesores y acudientes
 * con al menos un identificador activo.
 */
export async function calcularCobertura(colegioId: string): Promise<CoberturaColegio> {
    return new CoberturaRepository().calcular(colegioId);
}

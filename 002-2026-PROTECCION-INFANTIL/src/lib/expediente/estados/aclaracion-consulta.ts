/**
 * SPEC-236 (002-PI-mega-cola): consulta de aclaraciones del expediente para
 * los guards de la máquina de estados.
 *
 * SPEC-238 (002-PI-mega-cola): implementación real sobre el modelo
 * `AclaracionExpediente` (el stub original devolvía 0 hasta que existiera la
 * tabla). Frontera DAL (Q-3): la query vive en `AclaracionRepository`; este
 * módulo solo adapta la firma que los guards ya consumían.
 */
import { AclaracionRepository } from "@/lib/dal/repositories/aclaracion-repository";

export type EstadoAclaracionConsulta = "PENDIENTE" | "RESPONDIDA" | "CERRADA_FORZOSAMENTE";

export async function contarAclaracionesPorEstado(
    expedienteId: string,
    estado: EstadoAclaracionConsulta
): Promise<number> {
    return new AclaracionRepository().contarPorExpedienteYEstado(expedienteId, estado);
}

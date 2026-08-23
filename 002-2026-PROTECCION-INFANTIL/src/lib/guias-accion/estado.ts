/**
 * SPEC-235 (002-PI-135): máquina de estados de GuiaAccionCategoria.
 * Centraliza las transiciones válidas y los mensajes de error.
 */
import { EstadoGuiaAccion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";

export const ESTADOS_GUIA_ACCION = Object.values(EstadoGuiaAccion);

const TRANSICIONES_PERMITIDAS: Record<EstadoGuiaAccion, EstadoGuiaAccion[]> = {
    [EstadoGuiaAccion.BORRADOR]: [
        EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE,
    ],
    [EstadoGuiaAccion.PENDIENTE_APROBACION_COMITE]: [
        EstadoGuiaAccion.ACTIVA,
        EstadoGuiaAccion.BORRADOR,
    ],
    [EstadoGuiaAccion.ACTIVA]: [EstadoGuiaAccion.REEMPLAZADA],
    [EstadoGuiaAccion.REEMPLAZADA]: [],
};

export function esTransicionValida(
    estadoActual: EstadoGuiaAccion,
    estadoNuevo: EstadoGuiaAccion
): boolean {
    if (estadoActual === estadoNuevo) return true;
    return TRANSICIONES_PERMITIDAS[estadoActual]?.includes(estadoNuevo) ?? false;
}

export function assertTransicionValida(
    estadoActual: EstadoGuiaAccion,
    estadoNuevo: EstadoGuiaAccion
): void {
    if (!esTransicionValida(estadoActual, estadoNuevo)) {
        throw new AppError(
            `Transición no permitida: ${estadoActual} → ${estadoNuevo}`,
            ERROR_CODES.CONFLICT,
            409
        );
    }
}

export function puedeEditarContenido(estado: EstadoGuiaAccion): boolean {
    return estado === EstadoGuiaAccion.BORRADOR;
}

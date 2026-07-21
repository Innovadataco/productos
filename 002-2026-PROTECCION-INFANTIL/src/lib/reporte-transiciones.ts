import { prisma } from "./prisma";
import { AppError, ERROR_CODES } from "./errors";
import type { EstadoReporte, Prisma, ResponsableTransicion } from "@prisma/client";

export interface RegistrarTransicionParams {
    reporteId: string;
    estadoAnterior: EstadoReporte;
    estadoNuevo: EstadoReporte;
    responsableTipo: ResponsableTransicion;
    responsableId?: string | null;
    motivo?: string | null;
    metadatos?: Record<string, unknown> | null;
    tx?: Prisma.TransactionClient;
}

/**
 * Registra una transición de estado de un reporte en la tabla TransicionReporte.
 *
 * Invariantes:
 * - `estadoAnterior` debe coincidir con el estado actual del reporte.
 * - La tabla es append-only; no se permite modificar ni borrar transiciones.
 * - `responsableId` solo tiene sentido cuando el tipo de responsable es un usuario.
 */
export async function registrarTransicion(params: RegistrarTransicionParams) {
    const db = params.tx ?? prisma;

    const reporte = await db.reporte.findUnique({
        where: { id: params.reporteId },
        select: { id: true, estado: true },
    });

    if (!reporte) {
        throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    if (reporte.estado !== params.estadoAnterior) {
        throw new AppError(
            `El estado actual del reporte (${reporte.estado}) no coincide con el estado anterior esperado (${params.estadoAnterior})`,
            ERROR_CODES.CONFLICT,
            409
        );
    }

    return db.transicionReporte.create({
        data: {
            reporteId: params.reporteId,
            estadoAnterior: params.estadoAnterior,
            estadoNuevo: params.estadoNuevo,
            responsableTipo: params.responsableTipo,
            responsableId: params.responsableId ?? null,
            motivo: params.motivo ?? null,
            metadatos: params.metadatos ? (params.metadatos as never) : undefined,
        },
    });
}

export function responsableTipoFromRol(rol: string): ResponsableTransicion | null {
    if (rol === "ADMIN") return "ADMIN";
    if (rol === "OPERADOR") return "OPERADOR";
    if (rol === "COMITE_VALIDACION") return "COMITE";
    return null;
}

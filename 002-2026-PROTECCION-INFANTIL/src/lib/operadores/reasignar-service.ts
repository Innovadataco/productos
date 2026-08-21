import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { EstadoReporte, RolUsuario } from "@prisma/client";

export type ReasignarReporteInput = {
    reporteId: string;
    operadorDestinoId: string;
    motivo: string;
    adminId: string;
    request?: Request;
};

export type ReasignarReporteResult = {
    id: string;
    operadorId: string;
    estado: EstadoReporte;
    actualizadoEn: Date;
};

function extractClientInfo(request?: Request): { ipAddress: string; userAgent: string } {
    return {
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    };
}

export async function reasignarReporte(input: ReasignarReporteInput): Promise<ReasignarReporteResult> {
    const { reporteId, operadorDestinoId, motivo, adminId, request } = input;

    const reporte = await prisma.reporte.findUnique({
        where: { id: reporteId },
        select: { id: true, estado: true, operadorId: true, actualizadoEn: true },
    });

    if (!reporte) {
        throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (reporte.estado !== "REVISION_MANUAL") {
        throw new AppError("El reporte no está en revisión manual", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const operadorActual = reporte.operadorId;
    if (!operadorActual) {
        throw new AppError("El reporte no tiene operador asignado", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (operadorActual === operadorDestinoId) {
        throw new AppError("El operador destino debe ser diferente al operador actual", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const destino = await prisma.usuario.findUnique({
        where: { id: operadorDestinoId },
        select: { id: true, rol: true, estado: true },
    });

    if (!destino) {
        throw new AppError("Operador destino no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }
    if (destino.rol !== RolUsuario.OPERADOR) {
        throw new AppError("El usuario destino no tiene rol de operador", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    if (destino.estado !== "activo") {
        throw new AppError("El operador destino no está activo", ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const { ipAddress, userAgent } = extractClientInfo(request);

    const actualizado = await prisma.$transaction(async (tx) => {
        const resultado = await tx.reporte.updateMany({
            where: { id: reporteId, operadorId: operadorActual },
            data: { operadorId: operadorDestinoId },
        });

        if (resultado.count === 0) {
            throw new AppError("El reporte fue modificado concurrentemente", ERROR_CODES.CONFLICT, 409);
        }

        await tx.transicionReporte.create({
            data: {
                reporteId,
                estadoAnterior: "REVISION_MANUAL",
                estadoNuevo: "REVISION_MANUAL",
                responsableTipo: "ADMIN",
                responsableId: adminId,
                motivo,
                metadatos: {
                    tipo: "REPORTE_REASIGNADO_MANUAL",
                    operador_anterior: operadorActual,
                    operador_nuevo: operadorDestinoId,
                    admin_id: adminId,
                },
            },
        });

        await logAudit({
            accion: "REPORTE_REASIGNADO_MANUAL",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ operadorId: operadorActual }),
            valorNuevo: JSON.stringify({ operadorId: operadorDestinoId }),
            ipAddress,
            userAgent,
            metadatos: {
                motivo,
                operador_anterior: operadorActual,
                operador_nuevo: operadorDestinoId,
            },
            tx,
        });

        return tx.reporte.findUniqueOrThrow({
            where: { id: reporteId },
            select: { id: true, operadorId: true, estado: true, actualizadoEn: true },
        });
    });

    if (!actualizado.operadorId) {
        throw new AppError("El reporte quedó sin operador tras la reasignación", ERROR_CODES.INTERNAL_ERROR, 500);
    }

    return {
        id: actualizado.id,
        operadorId: actualizado.operadorId,
        estado: actualizado.estado,
        actualizadoEn: actualizado.actualizadoEn,
    };
}

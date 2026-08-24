/**
 * SPEC-211 (002-PI-111): cancelación de la suscripción por el propio cliente
 * (rector/padre). Preserva todos los datos (borrado lógico: estado CANCELADA)
 * y registra AuditLog (AS-006, FR-011).
 */
import { EstadoSuscripcion } from "@prisma/client";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { verificarTitularidad, type UsuarioTitular } from "./suscripcion-vista.service";

export interface CancelacionInput {
    suscripcionId: string;
    motivo?: string | undefined;
    usuario: UsuarioTitular;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface CancelacionResultado {
    estado: EstadoSuscripcion;
    canceladaEn: Date;
}

export async function cancelarSuscripcionCliente(input: CancelacionInput): Promise<CancelacionResultado> {
    const { usuario } = input;
    const repo = new PagosRepository();

    const suscripcion = await verificarTitularidad(input.suscripcionId, usuario);
    if (!suscripcion) {
        throw new AppError("Suscripción no encontrada o no pertenece al usuario", ERROR_CODES.NOT_FOUND, 404);
    }

    if (suscripcion.estado === EstadoSuscripcion.CANCELADA) {
        throw new AppError("La suscripción ya está cancelada", ERROR_CODES.CONFLICT, 409);
    }

    const canceladaEn = new Date();
    const actualizada = await repo.actualizarSuscripcion(suscripcion.id, {
        estado: EstadoSuscripcion.CANCELADA,
        canceladaEn,
        canceladaPorUsuario: true,
        motivoCancelacion: input.motivo ?? null,
    });

    await logAudit({
        accion: "SUSCRIPCION_CANCELADA",
        tipoRecurso: "Suscripcion",
        recursoId: suscripcion.id,
        usuarioId: usuario.id,
        colegioId: suscripcion.colegioId ?? undefined,
        valorAnterior: JSON.stringify({ estado: suscripcion.estado }),
        valorNuevo: JSON.stringify({
            estado: EstadoSuscripcion.CANCELADA,
            motivoCancelacion: input.motivo ?? null,
        }),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });

    return { estado: actualizada.estado, canceladaEn };
}

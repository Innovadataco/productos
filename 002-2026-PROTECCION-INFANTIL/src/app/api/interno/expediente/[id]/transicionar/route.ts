import { NextResponse } from "next/server";
import { z } from "zod";
import { EstadoExpediente } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { verificarWorkerSecret } from "@/lib/worker-auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";
import { aplicarTransicion, type ActorTransicion } from "@/lib/expediente/estados/aplicar-transicion";

/**
 * POST /api/interno/expediente/[id]/transicionar — SPEC-236 (FR-020/FR-021).
 *
 * Acceso:
 * - Cuenta de servicio: header `X-Worker-Secret` válido (worker del motor).
 * - Usuario ADMIN (cookie de sesión).
 * - Usuario PARENT: solo la reapertura v1 `CERRADO → ESCALADO` sobre su
 *   propio expediente (US5.2); cualquier otra combinación recibe 403.
 */

const bodySchema = z.object({
    estadoDestino: z.nativeEnum(EstadoExpediente),
    motivo: z.string().max(500).optional(),
});

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const { id } = await context.params;
        const body = bodySchema.parse(await request.json());

        let actor: ActorTransicion;
        const workerAuth = verificarWorkerSecret(request);
        if (workerAuth.ok) {
            actor = { id: "worker-expediente-motor", tipo: "service-account" };
        } else {
            const usuario = await verifyAuth();
            if (usuario.rol === "PARENT") {
                // Reapertura v1: solo CERRADO → ESCALADO sobre expediente propio.
                if (body.estadoDestino !== EstadoExpediente.ESCALADO) {
                    throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
                }
                const padreUsuarioId = await new ExpedienteMotorRepository().obtenerPadreUsuarioId(id);
                if (!padreUsuarioId) {
                    throw new AppError("Expediente no encontrado", ERROR_CODES.NOT_FOUND, 404);
                }
                if (padreUsuarioId !== usuario.id) {
                    throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
                }
                actor = { id: usuario.id, tipo: "usuario", rol: usuario.rol };
            } else if (usuario.rol !== "ADMIN") {
                throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
            } else {
                actor = { id: usuario.id, tipo: "usuario", rol: usuario.rol };
            }
        }

        const expediente = await aplicarTransicion({
            expedienteId: id,
            estadoDestino: body.estadoDestino,
            motivo: body.motivo,
            actor,
        });

        return NextResponse.json({ expediente });
    } catch (error) {
        return errorToResponse(error, "[INTERNO/EXPEDIENTE/TRANSICIONAR]");
    }
}

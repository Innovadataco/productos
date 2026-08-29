import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { padreIdParamsSchema, padreVigenciaBodySchema } from "@/lib/schemas";
import { esRangoServicioValido } from "@/lib/colegio/periodo";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * PATCH /api/admin/padres/[id]/vigencia (spec 119)
 * Ve, fija, extiende o limpia la ventana de servicio de un padre (cliente de pago).
 * Campo ausente = conservar; null = limpiar (sin vigencia = acceso); ISO = fijar.
 * Solo metadatos de cuenta: nunca toca reportes ni datos del usuario.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "padres");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(padreIdParamsSchema)(await params);
        const body = await withValidation.body(padreVigenciaBodySchema)(request);

        // E-8: la lectura/escritura vive en el repo; la ruta no toca prisma.
        const padre = await new UsuarioRepository().findPadreVigencia(id);
        if (!padre) {
            return NextResponse.json(
                { error: { message: "Cuenta de padre no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const resuelveFecha = (valor: string | null | undefined, actual: Date | null): Date | null =>
            valor === undefined ? actual : valor ? new Date(valor) : null;

        const inicio = resuelveFecha(body.inicioServicio, padre.inicioServicio);
        const fin = resuelveFecha(body.finServicio, padre.finServicio);

        if (inicio && fin && !esRangoServicioValido(inicio, fin)) {
            throw new AppError(
                "La fecha de fin del servicio debe ser posterior a la fecha de inicio",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        const actualizado = await new UsuarioRepository().actualizarVigenciaServicio(id, {
            inicioServicio: inicio,
            finServicio: fin,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({
                inicioServicio: padre.inicioServicio,
                finServicio: padre.finServicio,
            }),
            valorNuevo: JSON.stringify({
                inicioServicio: actualizado.inicioServicio,
                finServicio: actualizado.finServicio,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ padre: actualizado });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

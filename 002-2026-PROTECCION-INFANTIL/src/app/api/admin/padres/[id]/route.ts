import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { padreIdParamsSchema } from "@/lib/schemas";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

// E-8: la lectura vive en el repo; la ruta no toca prisma.
async function getPadre(id: string) {
    return new UsuarioRepository().findPadreById(id);
}

/**
 * DELETE /api/admin/padres/[id] (spec 117, I-37)
 * Desactiva la cuenta de un padre (idempotente). Patrón de operadores.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const padre = await getPadre(id);
        if (!padre) {
            return NextResponse.json(
                { error: { message: "Cuenta de padre no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (padre.estado === "inactivo") {
            return NextResponse.json({ padre });
        }

        await new UsuarioRepository().actualizar(id, { estado: "inactivo" });
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ estado: padre.estado }),
            valorNuevo: JSON.stringify({ estado: "inactivo" }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ padre: { ...padre, estado: "inactivo" } });
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

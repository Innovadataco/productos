import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { padreIdParamsSchema } from "@/lib/schemas";
import { randomBytes } from "crypto";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

/**
 * POST /api/admin/padres/[id]/restablecer-password (spec 117, I-37)
 * Restablece la contraseña de un padre: genera una temporal, la devuelve UNA sola vez
 * en la respuesta y fuerza el cambio en el próximo login. El admin nunca ve la
 * contraseña anterior (solo existe el hash). Patrón de operadores/regenerar-password.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const padre = await prisma.usuario.findFirst({
            where: { id, rol: "PARENT" },
            select: { id: true, email: true, nombre: true, estado: true, debeCambiarPassword: true },
        });
        if (!padre) {
            return NextResponse.json(
                { error: { message: "Cuenta de padre no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // La contraseña temporal solo se devuelve en esta respuesta (una sola vez):
        // nunca se persiste en claro ni se registra en logs/auditoría.
        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);

        await prisma.usuario.update({
            where: { id },
            data: { passwordHash, debeCambiarPassword: true },
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ debeCambiarPassword: padre.debeCambiarPassword }),
            valorNuevo: JSON.stringify({ debeCambiarPassword: true }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({
            padre: { ...padre, debeCambiarPassword: true },
            passwordTemporal: password,
            mensaje: "Contraseña temporal restablecida. Muéstrela una vez al usuario; deberá cambiarla al iniciar sesión.",
        });
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

import { NextResponse } from "next/server";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { colegioIdParamsSchema } from "@/lib/schemas";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { randomBytes } from "crypto";
import { enviarEmailCambioPassword } from "@/lib/email";
import { logger } from "@/lib/logger";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "colegios_gestion");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = withValidation.params(colegioIdParamsSchema)(await params);

        // E-8: las lecturas/escrituras viven en los repos; la ruta no toca prisma.
        const colegio = await new ColegioRepository().findParaRegenerarPassword(id);
        if (!colegio) {
            return NextResponse.json(
                { error: { message: "Colegio no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        if (!colegio.admin) {
            return NextResponse.json(
                { error: { message: "El colegio no tiene un administrador asignado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // La contraseña temporal solo se devuelve en esta respuesta (una sola vez):
        // nunca se persiste en claro ni se registra en logs/auditoría.
        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);

        await new UsuarioRepository().actualizar(colegio.admin.id, { passwordHash, debeCambiarPassword: true });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_PASSWORD_REGENERADA",
            tipoRecurso: "Colegio",
            recursoId: colegio.id,
            usuarioId: admin.id,
            colegioId: colegio.id,
            valorAnterior: JSON.stringify({ debeCambiarPassword: colegio.admin.debeCambiarPassword }),
            valorNuevo: JSON.stringify({ debeCambiarPassword: true, email: colegio.admin.email }),
            ipAddress,
            userAgent,
        });

        // SPEC-322 (camino 6): aviso al rector cuando un admin le regenera la clave.
        // El rector es el dueño de la cuenta; sin este aviso no se enteraría del cambio.
        try {
            await enviarEmailCambioPassword(colegio.admin.email);
        } catch (error) {
            // SPEC-415: sigue sin bloquear —el cambio de clave ya ocurrió— pero
            // deja de ser MUDO. Este es un aviso de seguridad: si el proveedor
            // está caído (I-283), nadie le dijo al dueño de la cuenta que se la
            // cambiaron, y sin esta línea tampoco quedaba rastro para saberlo.
            logger.error(
                "[Seguridad] No se pudo avisar el cambio de clave (ADMIN regenera la clave del rector)",
                error,
            );
        }

        return NextResponse.json({
            colegio: { id: colegio.id, nombre: colegio.nombre },
            admin: { id: colegio.admin.id, email: colegio.admin.email, debeCambiarPassword: true },
            passwordTemporal: password,
            mensaje: "Contraseña temporal regenerada. Muéstrela una vez al administrador del colegio.",
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

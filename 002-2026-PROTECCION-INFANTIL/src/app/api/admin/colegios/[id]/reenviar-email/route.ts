import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { enviarEmailBienvenidaColegio } from "@/lib/email";
import { withValidation } from "@/lib/validation";
import { colegioIdParamsSchema } from "@/lib/schemas";
import { ColegioRepository } from "@/lib/dal/repositories/colegio";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { randomBytes } from "crypto";

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
        const colegio = await new ColegioRepository().findParaReenviarEmail(id);
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

        // El sistema no puede leer la contraseña actual (hash); se genera una nueva
        // temporal para incluir en el email. Solo se expone en la respuesta si el
        // envío falla (copia manual); nunca se persiste en claro ni se loguea.
        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);

        await new UsuarioRepository().actualizar(colegio.admin.id, { passwordHash, debeCambiarPassword: true });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_EMAIL_REENVIADO",
            tipoRecurso: "Colegio",
            recursoId: colegio.id,
            usuarioId: admin.id,
            colegioId: colegio.id,
            valorNuevo: JSON.stringify({ email: colegio.admin.email }),
            ipAddress,
            userAgent,
        });

        let emailEnviado = false;
        try {
            await enviarEmailBienvenidaColegio(colegio.admin.email, password);
            emailEnviado = true;
        } catch (err) {
            logger.error("[COLEGIOS] Error reenviando email de bienvenida al colegio", err);
        }

        return NextResponse.json({
            colegio: { id: colegio.id, nombre: colegio.nombre },
            admin: { id: colegio.admin.id, email: colegio.admin.email, debeCambiarPassword: true },
            emailEnviado,
            passwordTemporal: emailEnviado ? undefined : password,
            mensaje: emailEnviado
                ? "Email de credenciales reenviado al administrador del colegio."
                : "No se pudo enviar el email. Copie la contraseña temporal y compártala manualmente (se muestra una sola vez).",
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

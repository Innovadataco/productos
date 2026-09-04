/**
 * SPEC-435 · POST `.../verificadores/[id]/reenviar-email`.
 *
 * Contrato Jelkin: «reenviar por email NUNCA devuelve la contraseña» cuando el
 * correo se encoló bien. Único fallback: si ni siquiera se pudo encolar, la
 * clave viaja como copia manual (el admin no queda atascado).
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { withValidation } from "@/lib/validation";
import { verificadorIdParamsSchema } from "@/lib/schemas/verificador";
import { VerificadorService } from "@/lib/dal/services/verificadores";
import { enviarEmailBienvenidaOperador } from "@/lib/email";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "verificadores_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers },
            );
        }
        const { id } = withValidation.params(verificadorIdParamsSchema)(await params);

        const { email, password } = await new VerificadorService().prepararReenvioEmail(id, admin.id, getClientInfo(request));

        let emailEnviado = false;
        try {
            await enviarEmailBienvenidaOperador(email, password);
            emailEnviado = true;
        } catch (err) {
            logger.error("[ADMIN/VERIFICADORES] error al reenviar bienvenida", err);
        }

        return NextResponse.json({
            emailEnviado,
            // SPEC-435 · contrato Jelkin: reenviar NUNCA devuelve la clave si se encoló;
            // si el envío falló, cae al fallback (copia manual) para no atascar al admin.
            passwordTemporal: emailEnviado ? undefined : password,
            mensaje: emailEnviado
                ? "Email de bienvenida reenviado al verificador."
                : "No se pudo reenviar el email. Copie la contraseña temporal mostrada arriba.",
        });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}

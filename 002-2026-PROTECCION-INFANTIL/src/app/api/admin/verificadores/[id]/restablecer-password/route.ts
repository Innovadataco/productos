/**
 * SPEC-435 · POST `.../verificadores/[id]/restablecer-password`.
 *
 * Contrato Jelkin: `restablecer` SIEMPRE devuelve la contraseña temporal en la
 * respuesta (`passwordTemporal`). No hay envío por correo en este botón — para
 * eso está `reenviar-email`. El candado permanente
 * `credencial-siempre-visible.candado.test.ts` (SPEC-421) barre esta ruta.
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
import { enviarEmailCambioPassword } from "@/lib/email";

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

        const { email, password } = await new VerificadorService().restablecerPassword(id, admin.id);

        // Aviso de seguridad al dueño de la cuenta (SPEC-322/415 — no bloquea el flujo).
        try {
            await enviarEmailCambioPassword(email);
        } catch (err) {
            logger.error("[Seguridad] Aviso de cambio de clave falló (ADMIN restablece a un VERIFICADOR)", err);
        }

        // SPEC-435 · contrato Jelkin: passwordTemporal SIEMPRE en la respuesta.
        return NextResponse.json({
            passwordTemporal: password,
            mensaje: "Contraseña temporal regenerada. Muéstrela una vez al verificador.",
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

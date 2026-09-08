/**
 * SPEC-598 (08-09-2026) — POST /api/auth/crear-password/codigo.
 *
 * Envía a SU correo el código de un solo uso que habilita «Crear contraseña»
 * en cuentas OAuth (Google) sin clave local (SPEC-587: su passwordHash es
 * aleatorio; SPEC-598: passwordCreadaEn == null). El email ya está verificado
 * —vino de Google—; el código confirma posesión del correo. Mismo patrón que
 * el step-up por email (SPEC-592): token firmado con vigencia de 10 minutos,
 * sin tabla de estado en servidor.
 *
 * Fail-closed: si el motor no tiene regla activa para el evento, se lanza — la
 * ruta responde error y el usuario no queda con la expectativa de un correo
 * que jamás sale (mismo patrón que `enviarCodigoVerificacion`, SPEC-296).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { requireEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { programar } from "@/lib/notificaciones";
import { firmarCodigoCrearPassword, VIGENCIA_CODIGO_STEPUP_EMAIL_MIN } from "@/lib/routing/stepup-sello";

const EVENTO_CREAR_PASSWORD_CODIGO = "auth.crear_password.codigo";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth();

        // Solo cuentas OAuth SIN contraseña propia: las que ya tienen clave usan
        // «Cambiar contraseña» (que pide la actual) y las de email+contraseña
        // nunca llegan acá.
        if (usuario.googleSub === null || usuario.passwordCreadaEn !== null) {
            return NextResponse.json(
                { error: { message: "Tu cuenta ya tiene contraseña. Usa «Cambiar contraseña».", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const rate = await checkRateLimit(request, "crear_password_codigo", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const codigo = firmarCodigoCrearPassword(usuario.id, requireEnv("JWT_SECRET", 32));

        const resultado = await programar({
            evento: EVENTO_CREAR_PASSWORD_CODIGO,
            sujetoTipo: "Usuario",
            sujetoId: usuario.id,
            destinatarios: [
                {
                    usuarioId: usuario.id,
                    rol: usuario.rol,
                    variables: {
                        codigo,
                        vigenciaMinutos: VIGENCIA_CODIGO_STEPUP_EMAIL_MIN,
                    },
                },
            ],
        });
        if (resultado.programadas === 0) {
            throw new AppError("No pudimos enviar el código. Intenta de nuevo.", ERROR_CODES.BAD_GATEWAY, 502);
        }

        return NextResponse.json({ enviado: true, vigenciaMinutos: VIGENCIA_CODIGO_STEPUP_EMAIL_MIN });
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

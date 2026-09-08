/**
 * SPEC-592 (2026-09-08) — POST /api/padre/step-up/codigo.
 *
 * Alternativa al step-up por contraseña para cuentas OAuth (Google): el padre
 * NO tiene contraseña que revalidar, así que le enviamos un código temporal a
 * SU correo. El código es un token firmado con vigencia de 10 minutos
 * (`firmarCodigoStepUpEmail`): la posesión del correo es el factor, sin tabla
 * de estado en servidor.
 *
 * Fail-closed: si el motor no tiene regla activa para el evento, se lanza — la
 * ruta responde error y el padre no queda con la expectativa de un correo que
 * jamás sale (mismo patrón que `enviarCodigoVerificacion`, SPEC-296).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { requireEnv } from "@/lib/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { programar } from "@/lib/notificaciones";
import { firmarCodigoStepUpEmail, VIGENCIA_CODIGO_STEPUP_EMAIL_MIN } from "@/lib/routing/stepup-sello";

const EVENTO_STEPUP_CODIGO = "padre.stepup.codigo";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");

        // Solo cuentas OAuth: las que tienen contraseña usan el camino de siempre.
        if (usuario.googleSub === null) {
            return NextResponse.json(
                { error: { message: "Tu cuenta tiene contraseña. Confírmala para continuar.", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const rate = await checkRateLimit(request, "acceso_codigo", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const codigo = firmarCodigoStepUpEmail(usuario.id, requireEnv("JWT_SECRET", 32));

        const resultado = await programar({
            evento: EVENTO_STEPUP_CODIGO,
            sujetoTipo: "Usuario",
            sujetoId: usuario.id,
            destinatarios: [
                {
                    usuarioId: usuario.id,
                    rol: "PARENT",
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

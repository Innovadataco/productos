/**
 * SPEC-606 (2026-09-09) — POST /api/padre/step-up/codigo.
 *
 * Paso 1 del step-up del texto sensible: envía al correo del padre un código
 * de 6 dígitos (CSPRNG; en BD solo su sha-256, vigencia `padre.texto.codigo_minutos`,
 * un solo código vigente por usuario, cooldown de reenvío de 60 s). Vale para
 * TODA cuenta PARENT — con o sin contraseña (deroga el candado "solo OAuth" de
 * SPEC-592 y reemplaza el step-up por contraseña de SPEC-340, ya eliminado).
 *
 * Fail-closed: si el motor no tiene regla activa para el evento, se lanza — la
 * ruta responde 502 y el padre no queda con la expectativa de un correo que
 * jamás sale (mismo patrón que `enviarCodigoVerificacion`, SPEC-296).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { solicitarCodigoStepUp } from "@/lib/dal/services/stepup-codigo";

export async function POST(request: Request) {
    try {
        const usuario = await verifyAuth("PARENT");

        const rate = await checkRateLimit(request, "stepup_codigo", { identifier: usuario.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const resultado = await solicitarCodigoStepUp({
            usuarioId: usuario.id,
            email: usuario.email,
            ip: getClientIp(request),
        });

        if (resultado.estado === "cooldown") {
            return NextResponse.json(
                {
                    error: {
                        message: `Ya te enviamos un código. Puedes pedir otro en ${resultado.reintentaEnSegundos} segundos.`,
                        code: ERROR_CODES.RATE_LIMITED,
                        reintentaEnSegundos: resultado.reintentaEnSegundos,
                        correoEnmascarado: resultado.correoEnmascarado,
                    },
                },
                { status: 429 }
            );
        }

        return NextResponse.json({
            enviado: true,
            vigenciaMinutos: resultado.vigenciaMinutos,
            cooldownSegundos: resultado.cooldownSegundos,
            correoEnmascarado: resultado.correoEnmascarado,
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

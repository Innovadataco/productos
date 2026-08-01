import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { enviarTokenRecuperacion } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { recuperarSolicitarSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";

function buildRateLimitResponse(retryAfter: number, headers: Record<string, string>) {
    return NextResponse.json(
        {
            message: MENSAJE_EXITO,
            emailSent: false,
            error: { message: "Demasiadas solicitudes. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter },
        },
        { status: 429, headers }
    );
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = recuperarSolicitarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const email = parsed.data.email.toLowerCase().trim();

        // Rate limit por IP
        const rateIp = await checkRateLimit(request, "recuperar_solicitar");
        if (!rateIp.allowed) {
            const retryAfter = Math.ceil((rateIp.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateIp.headers);
        }

        // Rate limit por email (identificador)
        const rateEmail = await checkRateLimit(request, "recuperar_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            const retryAfter = Math.ceil((rateEmail.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateEmail.headers);
        }

        // SPEC-053: usuario, límite de solicitudes y creación del token viven en el DAL;
        // la ruta no toca prisma. El envío del email queda en su adaptador (src/lib/email.ts).
        const resultado = await new AutenticacionService().solicitarRecuperacion(email);

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Límite de solicitudes excedido. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        if (resultado.tipo === "sin_usuario") {
            // Email no registrado: respuesta idéntica para evitar enumeración
            return NextResponse.json({ message: MENSAJE_EXITO, emailSent: false }, { status: 200 });
        }

        const token = resultado.token;
        let emailSent = false;
        let emailError: string | null = null;
        try {
            await enviarTokenRecuperacion(email, token);
            emailSent = true;
        } catch (err) {
            const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
            emailError = err instanceof Error ? err.message : String(err);
            logger.error(`[RECUPERAR] Envío de email de recuperación: fallido — ${masked}: ${emailError}`);
        }

        const response: Record<string, unknown> = {
            message: MENSAJE_EXITO,
            emailSent,
        };

        // BL-3 (002-PI-052): el token de desarrollo NUNCA se expone en producción
        // (toma de cuenta). Solo en entornos no productivos, cuando el email falla;
        // en prod el email falla = fail-closed, sin token en el body.
        if (!emailSent && process.env.NODE_ENV !== "production") {
            response.devToken = token;
        }
        return NextResponse.json(response, { status: 200 });
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

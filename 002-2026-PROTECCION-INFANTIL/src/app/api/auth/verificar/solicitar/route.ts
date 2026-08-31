import { NextResponse } from "next/server";
import { enviarCodigoVerificacion, enviarEmailCuentaExistente } from "@/lib/email";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { verificarSolicitarSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

const MENSAJE_EXITO = "Si el email es válido, recibirás un código de verificación.";

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
        // SPEC-125: esquema Zod; el mensaje es contrato del frontend (registro/page.tsx).
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = verificarSolicitarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const email = parsed.data.email;

        // Rate limit por IP
        const rateIp = await checkRateLimit(request, "verificacion_solicitar");
        if (!rateIp.allowed) {
            const retryAfter = Math.ceil((rateIp.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateIp.headers);
        }

        // Rate limit por email (identificador)
        const rateEmail = await checkRateLimit(request, "verificacion_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            const retryAfter = Math.ceil((rateEmail.resetAt - Date.now()) / 1000);
            return buildRateLimitResponse(retryAfter, rateEmail.headers);
        }

        // SPEC-053: usuario existente, límite de códigos y creación viven en el DAL;
        // la ruta no toca prisma. El envío del email queda en su adaptador.
        const resultado = await new AutenticacionService().solicitarCodigo(email);

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Límite de solicitudes excedido", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        if (resultado.tipo === "existente") {
            // SPEC-338 (I-226): el correo ya tiene cuenta. La respuesta en pantalla
            // NO revela nada (anti-enumeración); el aviso "ya tenés una cuenta" va al
            // buzón. Fire-and-forget con fallo silencioso, igual que el envío del código.
            try {
                await enviarEmailCuentaExistente(email);
            } catch {
                const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
                logger.error(`[VERIFICAR] Aviso cuenta-existente: envío fallido — ${masked}`);
            }
            return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
        }

        const code = resultado.code;
        let emailSent = false;
        let emailError: string | null = null;
        try {
            await enviarCodigoVerificacion(email, code);
            emailSent = true;
        } catch (err) {
            const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
            emailError = err instanceof Error ? err.message : String(err);
            logger.error(`[VERIFICAR] Envío de email de verificación: fallido — ${masked}: ${emailError}`);
        }

        // BL-3 (002-PI-052): el código de desarrollo NUNCA se expone en producción
        // (toma de cuenta). Solo en entornos no productivos, cuando el email falla;
        // en prod el email falla = fail-closed, sin código en el body.
        const esProduccion = process.env.NODE_ENV === "production";
        const response: Record<string, unknown> = {
            message: emailSent
                ? MENSAJE_EXITO
                : esProduccion
                    ? "El servicio de email no está disponible en este momento; intenta de nuevo más tarde."
                    : "El servicio de email no está disponible; usa el código mostrado para continuar.",
            emailSent,
        };

        // Si no se pudo enviar el email, exponemos el código para que el usuario pueda continuar
        // (útil en entornos sin Resend configurado o en modo desarrollo).
        // Nunca exponemos el mensaje de error del proveedor de email.
        if (!emailSent && !esProduccion) {
            response.devCode = code;
        }

        return NextResponse.json(response, { status: 202 });
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

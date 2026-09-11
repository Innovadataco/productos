import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { enviarTokenRecuperacion } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { recuperarSolicitarSchema } from "@/lib/validators";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

/**
 * SPEC-630 (I-377) — POST /api/auth/recuperar/solicitar SIN enumeración, por el CUERPO y por el TIEMPO.
 *
 * La respuesta 200 es IDÉNTICA para todo correo: `{ message }` constante. Antes el cuerpo delataba
 * existencia (emailSent=true solo con cuenta-con-clave; metodo="google"+mensaje propio para solo_google)
 * y el tiempo también (solo el camino con-clave AWAITaba el envío del correo tras un hashToken lento —
 * un oráculo de decenas-cientos de ms, por encima del jitter).
 *
 * Cierre POR CONSTRUCCIÓN (no por margen tolerante, que sería ciego, [[ceo-candado-umbral-con-holgura-cruzar-el-vivo]]):
 * en producción TODO el trabajo caso-dependiente (lookup + hashToken + token + envío) se DESPACHA fuera
 * del camino síncrono; la respuesta mide idéntico en los 3 casos (sin_usuario / solo_google / con_clave).
 * Los fallos de envío se loguean — no hay canal al usuario sin delatar existencia; el mensaje ya es
 * condicional («si el email está registrado…»).
 *
 * NO-PROD es camino síncrono con `devToken` en fallo de envío: el arnés no puede leer el correo y no es
 * la superficie de amenaza (BL-3: en prod, jamás token en el cuerpo). El candado de enumeración fuerza
 * NODE_ENV=production para medir el camino real.
 */
const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";
const CUERPO_EXITO = { message: MENSAJE_EXITO } as const;

function buildRateLimitResponse(retryAfter: number, headers: Record<string, string>) {
    // El 429 es del rate limit (por IP y por email) — no distingue existencia: el mismo correo tecleado
    // choca el límite exista o no la cuenta. Sin `emailSent` (SPEC-630: fuera del cuerpo en todo caso).
    return NextResponse.json(
        {
            message: MENSAJE_EXITO,
            error: { message: "Demasiadas solicitudes. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED, retryAfter },
        },
        { status: 429, headers }
    );
}

/**
 * Trabajo caso-dependiente COMPLETO. En prod se despacha sin await; en no-prod se espera para el arnés.
 * Devuelve el token (o null si no hay nada que enviar) y si el correo llegó a salir.
 */
async function ejecutarRecuperacion(email: string): Promise<{ token: string | null; enviado: boolean }> {
    const resultado = await new AutenticacionService().solicitarRecuperacion(email);
    // sin_usuario / solo_google / limite → no hay token ni correo. La respuesta ya salió (constante).
    if (!resultado.ok || resultado.tipo !== "ok") return { token: null, enviado: false };

    try {
        await enviarTokenRecuperacion(email, resultado.token);
        return { token: resultado.token, enviado: true };
    } catch (err) {
        const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
        logger.error(`[RECUPERAR] Envío de email de recuperación: fallido — ${masked}: ${err instanceof Error ? err.message : String(err)}`);
        return { token: resultado.token, enviado: false };
    }
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

        // Rate limit por IP y por email (identificador). No distingue existencia.
        const rateIp = await checkRateLimit(request, "recuperar_solicitar");
        if (!rateIp.allowed) {
            return buildRateLimitResponse(Math.ceil((rateIp.resetAt - Date.now()) / 1000), rateIp.headers);
        }
        const rateEmail = await checkRateLimit(request, "recuperar_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            return buildRateLimitResponse(Math.ceil((rateEmail.resetAt - Date.now()) / 1000), rateEmail.headers);
        }

        if (process.env.NODE_ENV !== "production") {
            // NO-PROD (arnés): camino SÍNCRONO. Cuerpo = message + devToken SOLO si el correo no salió
            // (el arnés fuerza el fallo para leer el token). No es la superficie de amenaza.
            const { token, enviado } = await ejecutarRecuperacion(email);
            const devBody: Record<string, unknown> = { ...CUERPO_EXITO };
            if (token && !enviado) devBody.devToken = token;
            return NextResponse.json(devBody, { status: 200 });
        }

        // PROD: cierre de enumeración por CONSTRUCCIÓN. Se despacha el trabajo caso-dependiente SIN await
        // (fire-and-forget sobre el servidor Node persistente) y se responde YA con el cuerpo constante.
        // El tiempo medido y el cuerpo son idénticos para existente / inexistente / solo-Google.
        void ejecutarRecuperacion(email).catch((err) => {
            logger.error(`[RECUPERAR] Proceso de recuperación (async): ${err instanceof Error ? err.message : String(err)}`);
        });
        return NextResponse.json(CUERPO_EXITO, { status: 200 });
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

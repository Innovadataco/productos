import { NextResponse } from "next/server";
import { enviarCodigoVerificacion, enviarEmailCuentaExistente } from "@/lib/email";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { verificarSolicitarSchema } from "@/lib/validators";
import { logger } from "@/lib/logger";
import { AutenticacionService } from "@/lib/dal/services/autenticacion";

/**
 * SPEC-641 (I-377 · gemelo de SPEC-630) — POST /api/auth/verificar/solicitar SIN enumeración, por el
 * CUERPO y por el TIEMPO.
 *
 * La respuesta 202 delataba existencia por DOS canales:
 * - FORMA: la clave `emailSent` estaba AUSENTE en el camino `existente` y PRESENTE en el de correo
 *   nuevo. Mensajes iguales, formas distintas → la PRESENCIA de la clave delata (no su valor).
 * - TIEMPO: el correo nuevo corre `bcrypt.hash(code, 12)` (oráculo CPU de cientos de ms) antes de
 *   awaitar el envío; el existente no. Cronometrás y sabés cuál existe.
 *
 * Cierre POR CONSTRUCCIÓN (no por margen tolerante, ciego al bcrypt — [[ceo-candado-umbral-con-holgura-cruzar-el-vivo]]):
 * en producción el cuerpo 202 es `{ message }` constante en los dos casos y TODO el trabajo
 * caso-dependiente (lookup + bcrypt + código + AMBOS envíos, incluido el aviso «ya tenés cuenta» de
 * SPEC-338/I-226) se despacha fuera del camino síncrono → tiempo plano. Esto además apaga el borde del
 * `limite` (que devolvía 429 solo para correo nuevo) → 202 constante.
 *
 * NO-PROD: camino síncrono con `devCode` en fallo de envío (el arnés no lee el correo; BL-3: en prod
 * jamás el código en el cuerpo). El candado de enumeración fuerza NODE_ENV=production.
 */
const MENSAJE_EXITO = "Si el email es válido, recibirás un código de verificación.";
const CUERPO_EXITO = { message: MENSAJE_EXITO } as const;

function buildRateLimitResponse(retryAfter: number, headers: Record<string, string>) {
    // 429 del rate limit por IP/email — no distingue existencia. Sin `emailSent` (SPEC-641: fuera del cuerpo).
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
 * Devuelve el código (o null si no hay nada que enviar: existente/limite) y si el correo llegó a salir.
 */
async function ejecutarVerificacion(email: string): Promise<{ code: string | null; enviado: boolean }> {
    const resultado = await new AutenticacionService().solicitarCodigo(email);

    if (resultado.ok && resultado.tipo === "existente") {
        // SPEC-338 (I-226): el correo ya tiene cuenta → aviso «ya tenés una cuenta» al buzón. La
        // pantalla NO lo revela; el aviso va por el motor de notificaciones. Fallo silencioso (logueado).
        try {
            await enviarEmailCuentaExistente(email);
        } catch {
            const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
            logger.error(`[VERIFICAR] Aviso cuenta-existente: envío fallido — ${masked}`);
        }
        return { code: null, enviado: false };
    }

    // limite u otro !ok → no hay código que enviar (la respuesta ya salió constante).
    if (!resultado.ok || resultado.tipo !== "ok") return { code: null, enviado: false };

    try {
        await enviarCodigoVerificacion(email, resultado.code);
        return { code: resultado.code, enviado: true };
    } catch (err) {
        const masked = email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
        logger.error(`[VERIFICAR] Envío de email de verificación: fallido — ${masked}: ${err instanceof Error ? err.message : String(err)}`);
        return { code: resultado.code, enviado: false };
    }
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

        const rateIp = await checkRateLimit(request, "verificacion_solicitar");
        if (!rateIp.allowed) {
            return buildRateLimitResponse(Math.ceil((rateIp.resetAt - Date.now()) / 1000), rateIp.headers);
        }
        const rateEmail = await checkRateLimit(request, "verificacion_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            return buildRateLimitResponse(Math.ceil((rateEmail.resetAt - Date.now()) / 1000), rateEmail.headers);
        }

        if (process.env.NODE_ENV !== "production") {
            // NO-PROD (arnés): camino SÍNCRONO. Cuerpo = message + devCode SOLO si el correo no salió.
            const { code, enviado } = await ejecutarVerificacion(email);
            const devBody: Record<string, unknown> = { ...CUERPO_EXITO };
            if (code && !enviado) devBody.devCode = code;
            return NextResponse.json(devBody, { status: 202 });
        }

        // PROD: cierre de enumeración por CONSTRUCCIÓN. Se despacha el trabajo caso-dependiente SIN await
        // y se responde YA con el cuerpo constante: tiempo y cuerpo idénticos para existente / nuevo.
        void ejecutarVerificacion(email).catch((err) => {
            logger.error(`[VERIFICAR] Proceso de verificación (async): ${err instanceof Error ? err.message : String(err)}`);
        });
        return NextResponse.json(CUERPO_EXITO, { status: 202 });
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

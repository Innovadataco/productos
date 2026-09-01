/**
 * SPEC-339 (A-67 §2.1) — POST /api/auth/registro/completar.
 *
 * El padre abrió el enlace y eligió su contraseña (dos veces, 8 caracteres).
 * Acá: se consume el token, se crea la cuenta, se inicia la sesión, se SELLA la
 * cookie de estado (para caer directo en el Paso 1 del camino sin rebote) y se
 * manda el correo de bienvenida.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createToken, setSessionCookie } from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { registroCompletarSchema } from "@/lib/validators";
import { enviarBienvenidaPadre } from "@/lib/email";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";

export async function POST(request: Request) {
    try {
        const rate = await checkRateLimit(request, "register");
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiados intentos. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = registroCompletarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: parsed.error.issues[0]?.message ?? "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resultado = await new RegistroEnlaceService().completar(parsed.data.token, parsed.data.password);

        if (!resultado.ok) {
            // La pantalla ofrece pedir un enlace nuevo en todos los casos; los
            // mensajes son serenos, sin jerga (§3 del brief).
            if (resultado.tipo === "email_existente") {
                return NextResponse.json(
                    { error: { message: "Este correo ya tiene una cuenta. Entra con tu correo y tu clave.", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
            return NextResponse.json(
                { error: { message: "Este enlace ya no sirve. Pide uno nuevo y te lo enviamos al correo.", code: ERROR_CODES.AUTH_EXPIRED } },
                { status: 410 }
            );
        }

        const { user } = resultado;

        const sessionToken = await createToken({ sub: user.id, rol: user.rol });
        await setSessionCookie(request, sessionToken);

        const res = NextResponse.json(
            { user: { id: user.id, email: user.email, rol: user.rol } },
            { status: 201 }
        );

        // Sella el estado con el paso pendiente (será "permiso"): el padre cae
        // directo en el Paso 1 sin pasar por el rebote. Fallo silencioso — la
        // cuenta ya existe; en el peor caso el rebote lo sella en el primer
        // intento de navegar.
        await sellarCookieSesionEstado(res, user.id);

        // T080: la bienvenida es cortesía; su fallo no deshace nada.
        try {
            await enviarBienvenidaPadre(user.email);
        } catch (err) {
            logger.error(`[REGISTRO] Bienvenida: envío fallido — ${err instanceof Error ? err.message : String(err)}`);
        }

        return res;
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

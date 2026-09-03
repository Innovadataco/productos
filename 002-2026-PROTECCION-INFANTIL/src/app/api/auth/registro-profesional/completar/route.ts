/**
 * SPEC-391 (A-75 · L1b · §2.1) — POST /api/auth/registro-profesional/completar.
 *
 * El profesional abrió el enlace y elige su contraseña. Se consume el token,
 * se crea la cuenta con rol PROFESIONAL, se inicia sesión y se envía la
 * bienvenida. `RegistroEnlaceService.completar(rolEsperado="PROFESIONAL")` es
 * el candado espejo (SPEC-344 · OBS-1 auditoría #222): un enlace de padre no
 * se consume por acá.
 *
 * NO se sella la cookie de estado (esa es del camino guiado del padre). El
 * profesional cae en /perfil-profesional/completar por decisión de UI.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createToken, setSessionCookie } from "@/lib/auth";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { registroCompletarSchema } from "@/lib/validators";
import { enviarBienvenidaProfesional } from "@/lib/email";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";

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

        const resultado = await new RegistroEnlaceService().completar(
            parsed.data.token,
            parsed.data.password,
            "PROFESIONAL"
        );

        if (!resultado.ok) {
            if (resultado.tipo === "email_existente") {
                return NextResponse.json(
                    { error: { message: "Este correo ya tiene una cuenta. Entra con tu correo y tu clave.", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
            if (resultado.tipo === "rol_incorrecto") {
                return NextResponse.json(
                    { error: { message: "Este enlace no es de registro profesional.", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }
            return NextResponse.json(
                { error: { message: "El enlace no es válido o ya venció. Pide uno nuevo.", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const sessionToken = await createToken({ sub: resultado.user.id, rol: resultado.user.rol });
        await setSessionCookie(request, sessionToken);
        const respuesta = NextResponse.json({ user: resultado.user }, { status: 201 });

        try {
            await enviarBienvenidaProfesional(resultado.user.email);
        } catch (err) {
            logger.error(`[REGISTRO_PROFESIONAL_COMPLETAR] bienvenida no enviada: ${String(err)}`);
        }

        return respuesta;
    } catch (err) {
        logger.error(`[REGISTRO_PROFESIONAL_COMPLETAR] Error inesperado: ${String(err)}`);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

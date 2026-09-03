/**
 * SPEC-391 (A-75 · L1b · §2.1) — POST /api/auth/registro-profesional/solicitar.
 *
 * Mismo patrón que /api/auth/registro/solicitar (padre): el profesional deja
 * SOLO su correo y recibe un ENLACE (no un código que transcribe). Reusa
 * `RegistroEnlaceService` con `rol: PROFESIONAL` — SPEC-344 ya parametrizó
 * el servicio por rol, no toco nada del núcleo.
 *
 * Anti-enumeración (SPEC-338): la respuesta hacia la pantalla es idéntica
 * exista o no el correo; el aviso real viaja al buzón — el enlace si es nuevo,
 * el aviso «ya tenés cuenta» si no.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { registroSolicitarSchema } from "@/lib/validators";
import { enviarEnlaceRegistroProfesional, enviarEmailCuentaExistente } from "@/lib/email";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";

const MENSAJE_EXITO = "Si el correo es válido, te enviamos un enlace para crear tu contraseña.";

function maskEmail(email: string): string {
    return email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
}

export async function POST(request: Request) {
    try {
        const bodyRaw = await request.json().catch(() => undefined);
        const parsed = registroSolicitarSchema.safeParse(bodyRaw);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const email = parsed.data.email;

        const rateIp = await checkRateLimit(request, "verificacion_solicitar");
        if (!rateIp.allowed) {
            return NextResponse.json(
                { message: MENSAJE_EXITO, error: { message: "Demasiadas solicitudes. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rateIp.headers }
            );
        }
        const rateEmail = await checkRateLimit(request, "verificacion_solicitar", { identifier: email });
        if (!rateEmail.allowed) {
            return NextResponse.json(
                { message: MENSAJE_EXITO, error: { message: "Demasiadas solicitudes. Intenta más tarde.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rateEmail.headers }
            );
        }

        const resultado = await new RegistroEnlaceService().solicitarEnlace(email, "PROFESIONAL");

        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Límite de solicitudes excedido", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        try {
            if (resultado.tipo === "ok") {
                await enviarEnlaceRegistroProfesional(email, resultado.token);
            } else {
                // Correo ya registrado: aviso al buzón existente sin filtrar rol
                // (SPEC-338: la pantalla ve la misma respuesta neutral).
                await enviarEmailCuentaExistente(email);
            }
        } catch (err) {
            logger.error(`[REGISTRO_PROFESIONAL] Error al enviar correo a ${maskEmail(email)}: ${String(err)}`);
        }

        return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
    } catch (err) {
        logger.error(`[REGISTRO_PROFESIONAL] Error inesperado: ${String(err)}`);
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

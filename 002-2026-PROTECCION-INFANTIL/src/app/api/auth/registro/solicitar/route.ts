/**
 * SPEC-339 (A-67 §2.1) — POST /api/auth/registro/solicitar.
 *
 * El padre deja SOLO su correo y recibe un ENLACE (no un código que transcribe).
 * Anti-enumeración (SPEC-338): la respuesta hacia la pantalla es IDÉNTICA exista
 * o no el correo; el feedback real viaja al buzón — el enlace si es nuevo, el
 * aviso "ya tienes una cuenta" si no.
 *
 * El registro de colegio NO pasa por acá: sigue en /api/auth/verificar/* con su
 * código de 6 dígitos, intacto.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { registroSolicitarSchema } from "@/lib/validators";
import { enviarEnlaceRegistro, enviarEmailCuentaExistente } from "@/lib/email";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";

// Contrato del frontend (registro/page.tsx). NUNCA cambia según exista el correo.
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

        // Mismos límites que el registro por código: por dirección y por correo.
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

        const resultado = await new RegistroEnlaceService().solicitarEnlace(email);

        if (!resultado.ok) {
            // Límite de enlaces vivos: mismo mensaje neutro, código de límite.
            return NextResponse.json(
                { error: { message: "Límite de solicitudes excedido", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }

        if (resultado.tipo === "existente") {
            // SPEC-338: el aviso va SOLO al buzón. Fallo de envío silencioso.
            try {
                await enviarEmailCuentaExistente(email);
            } catch {
                logger.error(`[REGISTRO] Aviso cuenta-existente: envío fallido — ${maskEmail(email)}`);
            }
            return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
        }

        // T080 (Calidad · R2-11): el token YA quedó creado. Si el correo falla,
        // el padre puede pedir el enlace de nuevo — el fallo del proveedor no le
        // cuesta nada. La respuesta no cambia (anti-enumeración).
        try {
            await enviarEnlaceRegistro(email, resultado.token);
        } catch (err) {
            logger.error(
                `[REGISTRO] Envío del enlace: fallido — ${maskEmail(email)}: ${err instanceof Error ? err.message : String(err)}`
            );
        }

        return NextResponse.json({ message: MENSAJE_EXITO }, { status: 202 });
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

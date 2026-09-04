/**
 * SPEC-421 · POST /api/admin/profesionales/solicitudes/reenviar
 *
 * Con el correo caído, la cadena `RegistroEnlaceService.crear()` se corta antes
 * de que exista la cuenta — el token en claro solo viaja en el email. Este
 * endpoint le da al admin la salida manual: emite un nuevo enlace, intenta
 * enviarlo, y **si el correo no salió**, devuelve la URL en la respuesta para
 * entregarla en pantalla (una sola vez) al profesional. Mismo criterio que
 * `restablecer-password`: si el correo salió, no se muestra.
 *
 * Nunca persiste el token en claro ni lo loguea.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { RegistroEnlaceService } from "@/lib/dal/services/registro-enlace";
import { enviarEnlaceRegistroProfesional } from "@/lib/email";
import { baseUrl } from "@/lib/email";

const reenviarSchema = z.object({ email: z.string().email() });

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "profesionales_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const parsed = reenviarSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Email inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const { email } = parsed.data;

        // Reusa el servicio de padres/profesionales — anti-enumeración incluida
        // (SPEC-338): si el email ya tiene cuenta, no se emite token nuevo.
        const resultado = await new RegistroEnlaceService().solicitarEnlace(email, "PROFESIONAL");
        if (!resultado.ok) {
            return NextResponse.json(
                { error: { message: "Se alcanzó el máximo de enlaces por hora para este correo.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429 }
            );
        }
        if (resultado.tipo === "existente") {
            // Ya hay Usuario con ese email — el admin debe usar
            // `restablecer-password` sobre la cuenta ya creada.
            return NextResponse.json({
                emailEnviado: false,
                enlace: undefined,
                mensaje: "El correo ya tiene una cuenta creada. Buscá al profesional en la lista y use 'Restablecer contraseña'.",
                yaExiste: true,
            });
        }

        const token = resultado.token;
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "CODE_REQUEST",
            tipoRecurso: "TokenRegistro:PROFESIONAL",
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ email, motivo: "SPEC-421 admin reenvía enlace" }),
            ipAddress,
            userAgent,
        });

        let emailEnviado = false;
        try {
            await enviarEnlaceRegistroProfesional(email, token);
            emailEnviado = true;
        } catch (err) {
            logger.error("[PROFESIONALES/SOLICITUDES] Error enviando enlace de registro", err);
        }

        // SPEC-423 (I-298): el enlace SIEMPRE viaja en la respuesta —
        // `emailEnviado` mide encolado, no entrega real. Nunca se persiste en
        // claro (el token solo vive hashed en TokenRegistro).
        const enlace = `${baseUrl()}/registro-profesional/crear-clave/${token}`;

        return NextResponse.json({
            encolado: emailEnviado,
            enlace,
            mensaje: emailEnviado
                ? "Enlace de registro generado. Envío por correo al profesional encolado — puede no llegar (proveedor asíncrono). El enlace está abajo (se muestra una sola vez)."
                : "Enlace de registro generado. No se pudo encolar el envío por correo. Copie el enlace y compártalo manualmente (se muestra una sola vez).",
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES/SOLICITUDES/REENVIAR]");
    }
}

/**
 * SPEC-421 · POST /api/admin/profesionales/[id]/restablecer-password
 *
 * Espejo EXACTO de `/api/admin/padres/[id]/restablecer-password:80` (orden CEO
 * 20:5x): genera una temporal, hashea, marca `debeCambiarPassword=true`, intenta
 * enviar por email. **Si el correo no salió**, la clave viaja en la respuesta
 * como `passwordTemporal` y se muestra al admin UNA SOLA VEZ; si salió, no
 * viaja. Nunca se persiste en claro ni se loguea.
 *
 * Con el correo caído por cuota, es lo único que le permite al admin entregarle
 * hoy una cuenta al profesional para que pueda entrar.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { hashPassword, verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import { ProfesionalesAdminService } from "@/lib/dal/services/profesionales-admin";
import { enviarBienvenidaProfesional } from "@/lib/email";
import { randomBytes } from "crypto";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const { id } = await params;
        const service = new ProfesionalesAdminService();
        const profesional = await service.obtener(id);
        if (!profesional) {
            return NextResponse.json({ error: { message: "Profesional no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        // Clave temporal: solo viaja en esta respuesta si el email falla. Nunca
        // se persiste en claro ni se registra en logs/auditoría (patrón padres).
        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);
        await new UsuarioRepository().actualizar(id, { passwordHash, debeCambiarPassword: true });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario:PROFESIONAL",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ debeCambiarPassword: profesional.debeCambiarPassword }),
            valorNuevo: JSON.stringify({ debeCambiarPassword: true }),
            ipAddress,
            userAgent,
        });

        let emailEnviado = false;
        try {
            await enviarBienvenidaProfesional(profesional.email);
            emailEnviado = true;
        } catch (err) {
            logger.error("[PROFESIONALES] Error enviando bienvenida al profesional", err);
        }

        return NextResponse.json({
            profesional: { ...profesional, debeCambiarPassword: true },
            emailEnviado,
            passwordTemporal: emailEnviado ? undefined : password,
            mensaje: emailEnviado
                ? "Contraseña temporal restablecida y enviada por email al usuario."
                : "No se pudo enviar el email. Copie la contraseña temporal y compártala manualmente (se muestra una sola vez).",
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES/RESTABLECER]");
    }
}

/**
 * SPEC-423 · POST /api/admin/profesionales/[id]/reenviar-email
 *
 * Segunda acción del par (con `restablecer-password`): regenera + encola envío
 * del correo de bienvenida al profesional. La temporal SIEMPRE viaja en la
 * respuesta como respaldo — el sistema no sabe si el correo llegó.
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
        const profesional = await new ProfesionalesAdminService().obtener(id);
        if (!profesional) {
            return NextResponse.json({ error: { message: "Profesional no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);
        await new UsuarioRepository().actualizar(id, { passwordHash, debeCambiarPassword: true });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario:PROFESIONAL",
            recursoId: id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ debeCambiarPassword: true, motivo: "SPEC-423 reenviar-email profesionales" }),
            ipAddress,
            userAgent,
        });

        let encolado = false;
        try {
            await enviarBienvenidaProfesional(profesional.email);
            encolado = true;
        } catch (err) {
            logger.error("[PROFESIONALES] Error encolando bienvenida al profesional", err);
        }

        return NextResponse.json({
            profesional: { ...profesional, debeCambiarPassword: true },
            passwordTemporal: password,
            encolado,
            mensaje: encolado
                ? "Contraseña temporal regenerada. Envío por correo encolado — puede no llegar (proveedor asíncrono). La temporal está abajo por si necesita compartirla a mano (se muestra una sola vez)."
                : "Contraseña temporal regenerada. No se pudo encolar el envío por correo. Copie la temporal y compártala manualmente (se muestra una sola vez).",
        });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES/REENVIAR]");
    }
}

/**
 * SPEC-423 · POST /api/admin/padres/[id]/reenviar-email
 *
 * Segunda acción del par (con `restablecer-password`): regenera la contraseña
 * temporal Y encola el envío por correo. **Ambas cosas ocurren**; el sistema
 * NO afirma que el correo llegó — solo que se encoló. La credencial siempre
 * viaja en la respuesta como respaldo (I-298 · CEO 22:0x).
 *
 * Diseño (CEO 22:1x, patrón colegios): dos acciones separadas, cada una
 * explícita. El admin decide el canal — el sistema no adivina.
 */
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth, hashPassword } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { enviarEmailCredencialesPadre } from "@/lib/email";
import { withValidation } from "@/lib/validation";
import { padreIdParamsSchema } from "@/lib/schemas";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
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
        await assertModulo(admin, "padres");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = withValidation.params(padreIdParamsSchema)(await params);
        const padre = await new UsuarioRepository().findPadreById(id);
        if (!padre) {
            return NextResponse.json(
                { error: { message: "Cuenta de padre no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        // Regenerar temporal (el sistema no puede leer la anterior — solo hash).
        const password = randomBytes(6).toString("hex");
        const passwordHash = await hashPassword(password);
        await new UsuarioRepository().actualizar(id, { passwordHash, debeCambiarPassword: true });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "USER_UPDATE",
            tipoRecurso: "Usuario",
            recursoId: id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ debeCambiarPassword: true, motivo: "SPEC-423 reenviar-email padres" }),
            ipAddress,
            userAgent,
        });

        // Encolamos el envío. Encolar SIEMPRE funciona con el motor de notif
        // (SPEC-201/296): no confundir con "correo entregado". Nunca afirmamos
        // que el correo llegó — la credencial de respaldo viaja siempre para
        // que el admin pueda decidir.
        let encolado = false;
        try {
            await enviarEmailCredencialesPadre(padre.email, password);
            encolado = true;
        } catch (err) {
            logger.error("[PADRES] Error encolando credenciales del padre", err);
        }

        return NextResponse.json({
            padre: { ...padre, debeCambiarPassword: true },
            // Contrato Jelkin (dos botones): «reenviar» NUNCA devuelve la
            // contraseña cuando el envío se encoló bien — para eso está el
            // botón «restablecer», que sí SIEMPRE la muestra en pantalla.
            // Único fallback: si ni siquiera se pudo encolar, devolvemos la
            // temporal para que el admin no quede atascado (copia manual).
            encolado,
            passwordTemporal: encolado ? undefined : password,
            mensaje: encolado
                ? "Envío por correo encolado — puede no llegar (proveedor asíncrono). Para ver la contraseña, use el botón «Restablecer contraseña»."
                : "No se pudo encolar el envío por correo. Copie la contraseña temporal y compártala manualmente (se muestra una sola vez).",
        });
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

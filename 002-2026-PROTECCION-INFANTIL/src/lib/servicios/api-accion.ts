/**
 * SPEC-291 (002-PI-191) — Handler compartido de POST /api/admin/servicios/<nombre>/<cmd>.
 * Aísla la lógica común: verifyAuth, assertModulo("sistema_admin"), header
 * X-Confirm-Action, adapter, AuditLog. Cada endpoint solo instancia con su cmd.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ejecutarAccionDocker, type ComandoServicio } from "@/lib/servicios/docker-adapter";

export async function handlerAccionServicio(
    request: Request,
    cmd: ComandoServicio,
    params: Promise<{ nombre: string }>,
): Promise<Response> {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "sistema_admin");
        if (request.headers.get("x-confirm-action") !== "yes") {
            throw new AppError(
                "Falta header X-Confirm-Action: yes (anti-click accidental)",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        const { nombre } = await params;
        await ejecutarAccionDocker(cmd, nombre);
        await logAudit({
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "Servicio",
            recursoId: nombre,
            usuarioId: user.id,
            ipAddress: request.headers.get("x-forwarded-for") ?? "unknown",
            userAgent: request.headers.get("user-agent") ?? "unknown",
            metadatos: { tipo: `servicio_${cmd}`, servicio: nombre },
        });
        return NextResponse.json({ estado: "pending", servicio: nombre, cmd }, { status: 202 });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 },
        );
    }
}

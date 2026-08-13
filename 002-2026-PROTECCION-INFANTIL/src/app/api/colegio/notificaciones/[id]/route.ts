import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { z } from "zod";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { NotificacionInAppRepository } from "@/lib/dal/repositories/notificacion-in-app";

const notificacionIdParamsSchema = z.object({ id: cuidIdSchema });

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function verificarAccesoColegio(request: Request, scope: "admin_read" | "admin_write") {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_notificaciones");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return { error: NextResponse.json({ error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    const rate = await checkRateLimit(request, scope, { identifier: user.id });
    if (!rate.allowed) {
        return {
            error: NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            ),
        };
    }

    if (!user.colegioId) {
        return { error: NextResponse.json({ error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } }, { status: 403 }) };
    }

    return { user, colegioId: user.colegioId };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const acceso = await verificarAccesoColegio(request, "admin_write");
        if ("error" in acceso) return acceso.error;

        const { id } = withValidation.params(notificacionIdParamsSchema)(await params);

        const repo = new NotificacionInAppRepository();
        const afectadas = await repo.marcarLeida(acceso.colegioId, acceso.user.id, id);
        if (afectadas === 0) {
            return NextResponse.json({ error: { message: "Notificación no encontrada", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_NOTIFICACION_LEIDA",
            tipoRecurso: "NotificacionInApp",
            recursoId: id,
            usuarioId: acceso.user.id,
            colegioId: acceso.colegioId,
            valorNuevo: JSON.stringify({ leidaEn: new Date().toISOString() }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/NOTIFICACIONES/ID]");
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const acceso = await verificarAccesoColegio(request, "admin_write");
        if ("error" in acceso) return acceso.error;

        const { id } = withValidation.params(notificacionIdParamsSchema)(await params);

        const repo = new NotificacionInAppRepository();
        const afectadas = await repo.archivar(acceso.colegioId, acceso.user.id, id);
        if (afectadas === 0) {
            return NextResponse.json({ error: { message: "Notificación no encontrada", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_NOTIFICACION_ARCHIVADA",
            tipoRecurso: "NotificacionInApp",
            recursoId: id,
            usuarioId: acceso.user.id,
            colegioId: acceso.colegioId,
            valorNuevo: JSON.stringify({ archivadaEn: new Date().toISOString() }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/NOTIFICACIONES/ID]");
    }
}

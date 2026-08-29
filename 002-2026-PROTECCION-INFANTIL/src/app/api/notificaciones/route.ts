import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { withValidation } from "@/lib/validation";
import { notificacionFiltroSchema } from "@/lib/schemas";
import { NotificacionUsuarioBandejaService } from "@/lib/notificaciones/bandeja-usuario";
import { actualizarPreferencia } from "@/lib/notificaciones/preferencias";
import { z } from "zod";

const preferenciaBodySchema = z.object({
    eventoRegla: z.string().min(1).max(120),
    habilitado: z.boolean(),
});

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request) {
    try {
        const user = await verifyAuth();
        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { searchParams } = new URL(request.url);
        const filtros = withValidation.params(notificacionFiltroSchema)({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
            soloNoLeidas: searchParams.get("soloNoLeidas") ?? undefined,
        });

        const resultado = await new NotificacionUsuarioBandejaService().listar(
            user.id,
            filtros.page,
            filtros.pageSize,
            filtros.soloNoLeidas
        );
        return NextResponse.json(resultado);
    } catch (error) {
        return errorToResponse(error, "[NOTIFICACIONES]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const service = new NotificacionUsuarioBandejaService();
        const afectadas = await service.marcarTodasLeidas(user.id);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "NOTIFICACION_USUARIO_LEIDA",
            tipoRecurso: "Notificacion",
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ marcarTodas: true, afectadas }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ afectadas });
    } catch (error) {
        return errorToResponse(error, "[NOTIFICACIONES/MARCAR-LEIDAS]");
    }
}

export async function PATCH(request: Request) {
    try {
        const user = await verifyAuth();
        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await withValidation.body(preferenciaBodySchema)(request);
        const resultado = await actualizarPreferencia(user.id, user.rol, body.eventoRegla, body.habilitado);

        if (!resultado.ok) {
            return NextResponse.json({ error: resultado.error }, { status: 400 });
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "NOTIFICACION_PREFERENCIA_ACTUALIZADA",
            tipoRecurso: "NotificacionPreferencia",
            usuarioId: user.id,
            valorNuevo: JSON.stringify({ eventoRegla: body.eventoRegla, habilitado: body.habilitado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorToResponse(error, "[NOTIFICACIONES/PREFERENCIA]");
    }
}

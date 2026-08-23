import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { withValidation } from "@/lib/validation";
import { pagosExtenderBodySchema } from "@/lib/schemas/pagos";
import { getClientInfo } from "@/lib/pagos/api-helpers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(z.object({ id: z.string().cuid() }))(await params);
        const body = await withValidation.body(pagosExtenderBodySchema)(request);

        const repo = new PagosRepository();
        const suscripcion = await repo.obtenerSuscripcionPorId(id);
        if (!suscripcion) throw new AppError("Suscripción no encontrada", ERROR_CODES.NOT_FOUND, 404);

        const nuevaFechaFin = new Date(body.nuevaFechaFin);
        if (nuevaFechaFin <= suscripcion.fechaFin) {
            throw new AppError("La nueva fecha de fin debe ser posterior a la actual", ERROR_CODES.VALIDATION_ERROR, 400);
        }

        const actualizado = await repo.actualizarSuscripcion(id, {
            fechaFin: nuevaFechaFin,
            fechaCorteProgramado: nuevaFechaFin,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "SUSCRIPCION_EXTENSION_MANUAL",
            tipoRecurso: "Suscripcion",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ fechaFin: suscripcion.fechaFin.toISOString() }),
            valorNuevo: JSON.stringify({ fechaFin: actualizado.fechaFin.toISOString(), motivo: body.motivo }),
            metadatos: { suscripcionId: id },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ suscripcion: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CLIENTE/EXTENDER]");
    }
}

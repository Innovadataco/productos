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
import { pagosPlanUpdateSchema } from "@/lib/schemas/pagos";
import { getClientInfo } from "@/lib/pagos/api-helpers";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const body = await withValidation.body(pagosPlanUpdateSchema)(request);

        const repo = new PagosRepository();
        const plan = await repo.obtenerPlanPorId(id);
        if (!plan) throw new AppError("Plan no encontrado", ERROR_CODES.NOT_FOUND, 404);

        const data: Parameters<typeof repo.actualizarPlan>[1] = {};
        if (body.precioBaseUSD !== undefined) data.precioBaseUSD = body.precioBaseUSD;
        if (body.descuentoAnualPct !== undefined) data.descuentoAnualPct = body.descuentoAnualPct;

        const actualizado = await repo.actualizarPlan(id, data);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "PLAN_ACTUALIZADO",
            tipoRecurso: "Plan",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ precioBaseUSD: plan.precioBaseUSD, descuentoAnualPct: plan.descuentoAnualPct }),
            valorNuevo: JSON.stringify({ precioBaseUSD: actualizado.precioBaseUSD, descuentoAnualPct: actualizado.descuentoAnualPct }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ plan: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PLANES/ID]");
    }
}

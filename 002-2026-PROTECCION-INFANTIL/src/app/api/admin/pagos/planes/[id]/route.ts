import { NextResponse } from "next/server";
import { AccionAudit } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { pagosPlanUpdateSchema } from "@/lib/schemas/pagos";
import { getClientInfo } from "@/lib/pagos/api-helpers";
import { withValidation } from "@/lib/validation";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
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

        const { id } = await context.params;
        const body = await withValidation.body(pagosPlanUpdateSchema)(request);

        const repo = new PagosRepository();
        const actual = await repo.obtenerPlanPorId(id);
        if (!actual) {
            throw new AppError("Plan no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const esFreemiumEfectivo = body.esFreemium ?? actual.esFreemium;
        const precioEfectivo = body.precioBaseCOP ?? actual.precioBaseCOP ?? 0;

        if (esFreemiumEfectivo && precioEfectivo > 0) {
            throw new AppError(
                "Plan freemium requiere precio 0. Desactive freemium o cambie el precio.",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }
        if (!esFreemiumEfectivo && precioEfectivo === 0) {
            throw new AppError(
                "Plan pago requiere precio mayor a 0. Marque freemium o suba el precio.",
                ERROR_CODES.VALIDATION_ERROR,
                400
            );
        }

        if (body.nombre && body.nombre !== actual.nombre) {
            const existenteNombre = await repo.obtenerPlanPorNombreYTipoTitular(body.nombre, actual.tipoTitular);
            if (existenteNombre && existenteNombre.id !== id) {
                throw new AppError("Ya existe un plan con este nombre para el rol destino", ERROR_CODES.CONFLICT, 409);
            }
        }

        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(body)) {
            if (value !== undefined) updateData[key] = value;
        }

        const plan = await repo.actualizarPlan(id, updateData as Parameters<typeof repo.actualizarPlan>[1]);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: AccionAudit.PLAN_UPDATE,
            tipoRecurso: "Plan",
            recursoId: plan.id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({
                nombre: actual.nombre,
                precioBaseCOP: actual.precioBaseCOP,
                precioBaseUSD: actual.precioBaseUSD,
                descuentoAnualPct: actual.descuentoAnualPct,
                descripcion: actual.descripcion,
                activo: actual.activo,
                usosMaximosPorCliente: actual.usosMaximosPorCliente,
                esFreemium: actual.esFreemium,
            }),
            valorNuevo: JSON.stringify({
                nombre: plan.nombre,
                precioBaseCOP: plan.precioBaseCOP,
                precioBaseUSD: plan.precioBaseUSD,
                descuentoAnualPct: plan.descuentoAnualPct,
                descripcion: plan.descripcion,
                activo: plan.activo,
                usosMaximosPorCliente: plan.usosMaximosPorCliente,
                esFreemium: plan.esFreemium,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ plan });
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
            return NextResponse.json(
                { error: { message: "Ya existe un plan con la misma clave (rol, duración y año)", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        return errorToResponse(error, "[ADMIN/PAGOS/PLANES/ID]");
    }
}

export async function DELETE(request: Request, context: RouteContext) {
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

        const { id } = await context.params;
        const repo = new PagosRepository();
        const actual = await repo.obtenerPlanPorId(id);
        if (!actual) {
            throw new AppError("Plan no encontrado", ERROR_CODES.NOT_FOUND, 404);
        }

        const tieneSuscripciones = await repo.existeSuscripcionActivaPorPlan(id);
        if (tieneSuscripciones) {
            throw new AppError(
                "El plan tiene suscripciones activas; desactívelo en lugar de eliminarlo",
                ERROR_CODES.CONFLICT,
                409
            );
        }

        const plan = await repo.desactivarPlan(id);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: AccionAudit.PLAN_TOGGLE,
            tipoRecurso: "Plan",
            recursoId: plan.id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ activo: actual.activo }),
            valorNuevo: JSON.stringify({ activo: plan.activo }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ plan });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PLANES/ID]");
    }
}

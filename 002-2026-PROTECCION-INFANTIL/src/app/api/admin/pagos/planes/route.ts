import { NextResponse } from "next/server";
import { AccionAudit } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { pagosPlanesQuerySchema, pagosPlanCreateSchema } from "@/lib/schemas/pagos";
import { paginatedResponse, getClientInfo } from "@/lib/pagos/api-helpers";
import { withValidation } from "@/lib/validation";

export async function GET(request: Request) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "pagos_admin");
        const rate = await checkRateLimit(request, "admin_read", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const url = new URL(request.url);
        const parsed = pagosPlanesQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, tipoTitular, anio } = parsed.data;
        const where: { tipoTitular?: "COLEGIO" | "PADRE"; anio?: number } = {};
        if (tipoTitular) where.tipoTitular = tipoTitular;
        if (anio !== undefined) where.anio = anio;

        const { items, total } = await new PagosRepository().listarPlanesPaginados(where, {
            skip: (page - 1) * pageSize,
            take: pageSize,
        });

        return NextResponse.json(paginatedResponse(items, page, pageSize, total));
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PLANES]");
    }
}

export async function POST(request: Request) {
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

        const body = await withValidation.body(pagosPlanCreateSchema)(request);

        const repo = new PagosRepository();
        const existenteNombre = await repo.obtenerPlanPorNombreYTipoTitular(body.nombre, body.tipoTitular);
        if (existenteNombre) {
            throw new AppError("Ya existe un plan con este nombre para el rol destino", ERROR_CODES.CONFLICT, 409);
        }

        const existenteClave = await repo.obtenerPlanPorClave(body.tipoTitular, body.duracion, body.anio);
        if (existenteClave) {
            throw new AppError("Ya existe un plan con la misma duración y año para este rol", ERROR_CODES.CONFLICT, 409);
        }

        const plan = await repo.crearPlan({
            nombre: body.nombre,
            precioBaseCOP: body.precioBaseCOP,
            precioBaseUSD: body.precioBaseUSD ?? 0,
            duracion: body.duracion,
            tipoTitular: body.tipoTitular,
            anio: body.anio,
            precio: 0, // legacy placeholder; la BD actual lo exige no nulo
            descripcion: body.descripcion ?? null,
            activo: body.activo,
            usosMaximosPorCliente: body.usosMaximosPorCliente ?? null,
            esFreemium: body.esFreemium,
            descuentoAnualPct: body.descuentoAnualPct ?? null,
            creadoPorAdminId: admin.id,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: AccionAudit.PLAN_CREATE,
            tipoRecurso: "Plan",
            recursoId: plan.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({
                nombre: plan.nombre,
                tipoTitular: plan.tipoTitular,
                duracion: plan.duracion,
                anio: plan.anio,
                precioBaseCOP: plan.precioBaseCOP,
                esFreemium: plan.esFreemium,
                usosMaximosPorCliente: plan.usosMaximosPorCliente,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ plan }, { status: 201 });
    } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
            return NextResponse.json(
                { error: { message: "Ya existe un plan con la misma clave (rol, duración y año)", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }
        return errorToResponse(error, "[ADMIN/PAGOS/PLANES]");
    }
}

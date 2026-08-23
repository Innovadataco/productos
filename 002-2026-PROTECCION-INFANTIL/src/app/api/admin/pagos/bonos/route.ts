import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { withValidation } from "@/lib/validation";
import { pagosQuerySchema, pagosBonoBodySchema } from "@/lib/schemas/pagos";
import { paginatedResponse, getClientInfo } from "@/lib/pagos/api-helpers";

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
        const parsed = pagosQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()));
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Parámetros de consulta inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }

        const { page, pageSize, q } = parsed.data;
        const activo = q === "activo" ? true : q === "inactivo" ? false : undefined;
        const { items, total } = await new PagosRepository().listarBonos(
            { activo },
            { skip: (page - 1) * pageSize, take: pageSize }
        );

        return NextResponse.json(paginatedResponse(items, page, pageSize, total));
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/BONOS]");
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

        const body = await withValidation.body(pagosBonoBodySchema)(request);
        const repo = new PagosRepository();
        const bono = await repo.crearBonoPromocional({
            nombre: body.nombre,
            tipo: body.tipo,
            valor: body.valor,
            vigenciaInicio: body.vigenciaInicio,
            vigenciaFin: body.vigenciaFin,
            usosMaximosTotales: body.usosMaximosTotales === undefined ? null : body.usosMaximosTotales,
            usosMaximosPorCliente: body.usosMaximosPorCliente,
            aplicaANuevos: body.aplicaANuevos,
            aplicaARenovaciones: body.aplicaARenovaciones,
            aplicaSoloA: body.aplicaSoloA === undefined ? null : body.aplicaSoloA,
            combinableConCodigoPersonal: body.combinableConCodigoPersonal,
            descripcion: body.descripcion === undefined ? null : body.descripcion,
            creadoPorAdminId: admin.id,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "BONO_CREADO",
            tipoRecurso: "BonoPromocional",
            recursoId: bono.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify({ nombre: bono.nombre, tipo: bono.tipo, valor: bono.valor }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ bono }, { status: 201 });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/BONOS]");
    }
}

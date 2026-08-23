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
import { pagosBonoUpdateSchema } from "@/lib/schemas/pagos";
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
        const body = await withValidation.body(pagosBonoUpdateSchema)(request);

        const repo = new PagosRepository();
        const bono = await repo.obtenerBonoPromocionalPorId(id);
        if (!bono) throw new AppError("Bono no encontrado", ERROR_CODES.NOT_FOUND, 404);

        const data: Parameters<typeof repo.actualizarBonoPromocional>[1] = {};
        if (body.nombre !== undefined) data.nombre = body.nombre;
        if (body.tipo !== undefined) data.tipo = body.tipo;
        if (body.valor !== undefined) data.valor = body.valor;
        if (body.vigenciaInicio !== undefined) data.vigenciaInicio = new Date(body.vigenciaInicio);
        if (body.vigenciaFin !== undefined) data.vigenciaFin = new Date(body.vigenciaFin);
        if (body.usosMaximosTotales !== undefined) data.usosMaximosTotales = body.usosMaximosTotales;
        if (body.usosMaximosPorCliente !== undefined) data.usosMaximosPorCliente = body.usosMaximosPorCliente;
        if (body.aplicaANuevos !== undefined) data.aplicaANuevos = body.aplicaANuevos;
        if (body.aplicaARenovaciones !== undefined) data.aplicaARenovaciones = body.aplicaARenovaciones;
        if (body.aplicaSoloA !== undefined) data.aplicaSoloA = body.aplicaSoloA;
        if (body.combinableConCodigoPersonal !== undefined) data.combinableConCodigoPersonal = body.combinableConCodigoPersonal;
        if (body.descripcion !== undefined) data.descripcion = body.descripcion;

        const actualizado = await repo.actualizarBonoPromocional(id, data);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "BONO_ACTUALIZADO",
            tipoRecurso: "BonoPromocional",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ nombre: bono.nombre, activo: bono.activo, valor: bono.valor }),
            valorNuevo: JSON.stringify({ nombre: actualizado.nombre, activo: actualizado.activo, valor: actualizado.valor }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ bono: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/BONOS/ID]");
    }
}

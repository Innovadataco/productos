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

        const repo = new PagosRepository();
        const bono = await repo.obtenerBonoPromocionalPorId(id);
        if (!bono) throw new AppError("Bono no encontrado", ERROR_CODES.NOT_FOUND, 404);

        const actualizado = await repo.actualizarBonoPromocional(id, { activo: false });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "BONO_DESACTIVADO",
            tipoRecurso: "BonoPromocional",
            recursoId: id,
            usuarioId: admin.id,
            valorAnterior: JSON.stringify({ activo: bono.activo }),
            valorNuevo: JSON.stringify({ activo: actualizado.activo }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ bono: actualizado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/BONOS/DESACTIVAR]");
    }
}

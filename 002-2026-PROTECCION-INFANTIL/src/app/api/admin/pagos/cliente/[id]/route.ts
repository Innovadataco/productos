import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { withValidation } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const { id } = withValidation.params(z.object({ id: z.string().cuid() }))(await params);
        const ficha = await new PagosRepository().obtenerFichaCliente(id);
        if (!ficha.suscripcion) throw new AppError("Suscripción no encontrada", ERROR_CODES.NOT_FOUND, 404);

        return NextResponse.json(ficha);
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/CLIENTE]");
    }
}

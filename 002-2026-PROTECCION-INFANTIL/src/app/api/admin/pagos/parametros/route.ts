import { NextResponse } from "next/server";
import { AccionAudit } from "@prisma/client";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { pagosParametrosUpdateSchema } from "@/lib/schemas/pagos";
import { getClientInfo } from "@/lib/pagos/api-helpers";
import { withValidation } from "@/lib/validation";
import { PagosParametrosService } from "@/lib/dal/services/pagos-parametros.service";

export async function PATCH(request: Request) {
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

        const body = await withValidation.body(pagosParametrosUpdateSchema)(request);
        const { antes, despues } = await new PagosParametrosService().actualizarBatch(admin.id, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: AccionAudit.PARAM_UPDATE,
            tipoRecurso: "ParametroSistema",
            usuarioId: admin.id,
            valorAnterior: JSON.stringify(antes),
            valorNuevo: JSON.stringify(despues),
            metadatos: { claves: Object.keys(body) },
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ parametros: despues });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PAGOS/PARAMETROS]");
    }
}

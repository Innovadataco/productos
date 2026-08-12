import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { alertaIdParamsSchema, alertaAsignarSchema } from "@/lib/schemas";
import { asignarAlerta } from "@/lib/colegio/alertas";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegio(user.id);
        if (!vigencia.vigente) {
            return NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = withValidation.params(alertaIdParamsSchema)(await params);
        const body = await withValidation.body(alertaAsignarSchema)(request);
        const asignadoAId = body.asignadoAId === "" ? null : body.asignadoAId ?? null;

        const alerta = await asignarAlerta(user.colegioId, id, asignadoAId, user.id, request);

        return NextResponse.json({ alerta: { id: alerta.id, asignadoAId: alerta.asignadoAId } });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/ALERTAS/ASIGNAR]");
    }
}

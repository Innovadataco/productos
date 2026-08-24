import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { verificarWorkerSecret } from "@/lib/worker-auth";
import { errorToResponse } from "@/lib/api-handler";
import type { ActorTransicion } from "@/lib/expediente/estados/aplicar-transicion";
import { cerrarForzosamente } from "@/lib/dal/services/aclaracion-expediente";

/**
 * POST /api/padre/expediente/[id]/cerrar-forzoso — SPEC-238 (US3, FR-005).
 *
 * Acceso:
 * - Padre titular (cookie de sesión, rol PARENT).
 * - Cuenta de servicio: header `X-Worker-Secret` válido (worker post-SLA).
 *
 * Requiere expediente en EN_APROBACION_PADRE con aclaración RESPONDIDA o
 * CERRADA_FORZOSAMENTE; transita el expediente a CERRADO y marca la
 * aclaración CERRADA_FORZOSAMENTE. Idempotente (D-5): una segunda llamada
 * devuelve 200 sin cambios.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        let actor: ActorTransicion;
        let ipAddress: string | undefined;
        let userAgent: string | undefined;

        const workerAuth = verificarWorkerSecret(request);
        if (workerAuth.ok) {
            actor = { id: "worker-expediente-motor", tipo: "worker" };
            ipAddress = "worker";
            userAgent = "expediente-motor/worker";
        } else {
            const user = await verifyAuth();
            if (user.rol !== "PARENT") {
                return NextResponse.json(
                    { error: { message: "Solo el padre titular puede cerrar el expediente", code: "FORBIDDEN" } },
                    { status: 403 }
                );
            }
            actor = { id: user.id, tipo: "usuario", rol: user.rol };
            ipAddress = request.headers.get("x-forwarded-for") ?? undefined;
            userAgent = request.headers.get("user-agent") ?? undefined;
        }

        const resultado = await cerrarForzosamente({ expedienteId: id, actor, ipAddress, userAgent });

        return NextResponse.json({
            expedienteId: resultado.expedienteId,
            estadoExpediente: resultado.estadoExpediente,
            aclaracionEstado: resultado.aclaracionEstado,
            yaCerrado: resultado.yaCerrado,
        });
    } catch (error) {
        return errorToResponse(error, "[PADRE/EXPEDIENTE/CERRAR-FORZOSO]");
    }
}

/**
 * SPEC-692 (I-417) · POST /api/admin/profesionales/[id]/levantar-suspension —
 * el administrador saca al profesional del estado SUSPENDIDO del perfil (→ ACTIVO
 * si la verificación de Ley 2375 sigue vigente; → VENCIDO si venció). Exige
 * `motivo` escrito (lo valida el service) y deja auditoría con quién/cuándo/por qué.
 * Mismo módulo y permiso que la desactivación de cuenta (`profesionales_admin`):
 * no se inventa un permiso nuevo. El botón lo da Diseño; esta es la API.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { ProfesionalesAdminService } from "@/lib/dal/services/profesionales-admin";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        await assertModulo(admin, "profesionales_admin");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;
        const body = (await request.json().catch(() => undefined)) as { motivo?: unknown } | undefined;
        const motivo = typeof body?.motivo === "string" ? body.motivo : "";
        const service = new ProfesionalesAdminService();
        const { estado } = await service.levantarSuspension(id, { id: admin.id, ...getClientInfo(request) }, motivo);
        return NextResponse.json({ estado });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES/LEVANTAR-SUSPENSION]");
    }
}

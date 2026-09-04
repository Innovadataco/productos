/**
 * SPEC-421 · POST /api/admin/profesionales/[id]/reactivar — vuelve a activo.
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
        const service = new ProfesionalesAdminService();
        const profesional = await service.obtener(id);
        if (!profesional) {
            return NextResponse.json({ error: { message: "Profesional no encontrado", code: ERROR_CODES.NOT_FOUND } }, { status: 404 });
        }
        await service.reactivar(profesional, { id: admin.id, ...getClientInfo(request) });
        return NextResponse.json({ profesional: { ...profesional, estado: "activo" } });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/PROFESIONALES/REACTIVAR]");
    }
}

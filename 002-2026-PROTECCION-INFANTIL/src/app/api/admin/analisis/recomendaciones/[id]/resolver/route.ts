import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { errorToResponse } from "@/lib/api-handler";
import { parseBody } from "@/lib/validation";
import { resolverRecomendacion } from "@/lib/analisis/reglas/resolver";

/**
 * SPEC-221 (002-PI-122): resolución humana de una recomendación del motor de
 * reglas. Única vía de transición manual: PENDIENTE → APLICADA | IGNORADA
 * (EXPIRADA es exclusiva del worker). Restringido a ADMIN; registra AuditLog
 * (RECOMENDACION_RESUELTA) en cada resolución exitosa.
 */

const bodySchema = z.object({
    estado: z.enum(["APLICADA", "IGNORADA"], {
        message: "estado debe ser APLICADA u IGNORADA",
    }),
    motivo: z.string().max(500, "motivo no puede superar 500 caracteres").optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const { id } = await params;
        const body = await parseBody(request, bodySchema);

        const recomendacion = await resolverRecomendacion({
            id,
            estado: body.estado,
            motivo: body.motivo ?? null,
            adminId: admin.id,
            ipAddress: request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? undefined,
            userAgent: request.headers.get("user-agent") ?? undefined,
        });

        return NextResponse.json({ recomendacion });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/ANALISIS/RECOMENDACIONES/RESOLVER]");
    }
}

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
 *
 * SPEC-222 (002-PI-123, FR-004): el body acepta además `accion` (contrato del
 * panel Dinero vs Valor) como alias de `estado`; exactamente uno de los dos.
 */

const accionSchema = z.enum(["APLICADA", "IGNORADA"], {
    message: "debe ser APLICADA u IGNORADA",
});

const bodySchema = z
    .object({
        estado: accionSchema.optional(),
        accion: accionSchema.optional(),
        motivo: z.string().max(500, "motivo no puede superar 500 caracteres").optional(),
    })
    .refine((val) => (val.estado ? !val.accion : !!val.accion), {
        message: "envía exactamente uno de: estado, accion",
        path: ["accion"],
    });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const { id } = await params;
        const body = await parseBody(request, bodySchema);
        const estado = body.estado ?? body.accion!;

        const recomendacion = await resolverRecomendacion({
            id,
            estado,
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

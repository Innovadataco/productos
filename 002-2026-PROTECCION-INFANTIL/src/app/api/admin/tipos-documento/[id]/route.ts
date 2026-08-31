/**
 * SPEC-320 (§2.3): edición de un tipo de documento del catálogo (ADMIN).
 * Permite renombrar, cambiar categoría y activar/desactivar. Desactivar oculta el
 * tipo de los formularios nuevos pero conserva los registros que ya lo usaban.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";

const actualizarSchema = z
    .object({
        nombre: z.string().min(1).max(100).optional(),
        categoria: z.string().min(1).max(50).optional(),
        esActiva: z.boolean().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, { message: "Debe enviar al menos un campo para actualizar", path: ["root"] });

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const admin = await verifyAuth("ADMIN");
        const rate = await checkRateLimit(request, "admin_write", { identifier: admin.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }
        const { id } = await params;
        const parsed = actualizarSchema.safeParse(await request.json());
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }
        const tipo = await new TipoDocumentoRepository().actualizar(id, parsed.data);
        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "ADMIN_TIPO_DOCUMENTO_EDITADO",
            tipoRecurso: "TipoDocumento",
            recursoId: tipo.id,
            usuarioId: admin.id,
            valorNuevo: JSON.stringify(parsed.data),
            ipAddress,
            userAgent,
        });
        return NextResponse.json({ tipo });
    } catch (error) {
        return errorToResponse(error, "[ADMIN/TIPOS-DOCUMENTO]");
    }
}

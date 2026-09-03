/**
 * SPEC-380 (PR B · C4) — PATCH /api/colegio/comite/integrantes/[id]/identificadores/[identificadorId].
 *
 * Cambia el estado (activo|inactivo) del identificador. No hay DELETE: soft
 * delete por estado (patrón del resto — nada se borra en la operación diaria).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { IdentificadorIntegranteComiteRepository } from "@/lib/dal/repositories/identificador-integrante-comite";
import { logAudit } from "@/lib/audit";

const patchSchema = z.object({
    estado: z.enum(["activo", "inactivo"]),
});

async function resolverColegioId(user: { rol: string; colegioId?: string | null; comiteColegioId?: string | null }): Promise<string | null> {
    if (user.rol === "SCHOOL_ADMIN") return user.colegioId ?? null;
    if (user.rol === "COMITE_CONVIVENCIA") return user.comiteColegioId ?? null;
    return null;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; identificadorId: string }> }
) {
    try {
        const user = await verifyAuth();
        const colegioId = await resolverColegioId(user);
        if (!colegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta sin colegio vinculado.", code: ERROR_CODES.FORBIDDEN } },
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

        const { identificadorId } = withValidation.params(
            z.object({ id: cuidIdSchema, identificadorId: cuidIdSchema })
        )(await params);
        const body = await withValidation.body(patchSchema)(request);

        const actualizado = await new IdentificadorIntegranteComiteRepository().cambiarEstado(
            colegioId,
            identificadorId,
            body.estado
        );

        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            accion: "COLEGIO_ALERTA_ESTADO",
            tipoRecurso: "IdentificadorIntegranteComite",
            recursoId: identificadorId,
            usuarioId: user.id,
            colegioId,
            valorNuevo: JSON.stringify({ estado: body.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: actualizado });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/COMITE/INTEGRANTES/IDENTIFICADORES/PATCH]");
    }
}

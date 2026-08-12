/**
 * SPEC-164: cambio de estado de un identificador de profesor.
 * PATCH /api/colegio/identificadores-profesor/[id]/estado
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { IdentificadorProfesorRepository } from "@/lib/dal/repositories/identificador-profesor";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { identificadorProfesorIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";
import { verificarPropiedadIdentificadorProfesor } from "@/lib/colegio/permisos";
import type { EstadoActivo } from "@/lib/dal/repositories/curso";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

function accionAuditPorEstado(estado: EstadoActivo): "COLEGIO_IDENTIFICADOR_PROFESOR_REACTIVADO" | "COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO" {
    return estado === "activo" ? "COLEGIO_IDENTIFICADOR_PROFESOR_REACTIVADO" : "COLEGIO_IDENTIFICADOR_PROFESOR_DESACTIVADO";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const { id: identificadorId } = withValidation.params(identificadorProfesorIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);
        const identificador = await verificarPropiedadIdentificadorProfesor(user.id, identificadorId);

        const actualizado = await new IdentificadorProfesorRepository().cambiarEstado(identificador.colegioId, identificadorId, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: accionAuditPorEstado(body),
            tipoRecurso: "IdentificadorProfesor",
            recursoId: identificadorId,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: identificador.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Identificador no encontrado") {
            return NextResponse.json(
                { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/IDENTIFICADORES-PROFESOR/ESTADO]");
    }
}

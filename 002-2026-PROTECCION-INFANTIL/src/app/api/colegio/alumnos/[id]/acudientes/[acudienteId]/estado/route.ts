/**
 * SPEC-163: cambio de estado de un acudiente.
 * PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]/estado
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AcudienteEstudianteRepository, type EstadoAcudiente } from "@/lib/dal/repositories/acudiente-estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { acudienteIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";
import { verificarPropiedadAcudiente } from "@/lib/colegio/permisos";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

function accionAuditPorEstado(estado: EstadoAcudiente): "COLEGIO_ACUDIENTE_REACTIVADO" | "COLEGIO_ACUDIENTE_DESACTIVADO" {
    return estado === "activo" ? "COLEGIO_ACUDIENTE_REACTIVADO" : "COLEGIO_ACUDIENTE_DESACTIVADO";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; acudienteId: string }> }) {
    try {
        const user = await verifyAuth("SCHOOL_ADMIN");
        await assertModulo(user, "colegios_gestion");
        const vigencia = await verificarVigenciaColegioSalvoCamino(user.id);
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

        const { id: estudianteId, acudienteId } = withValidation.params(acudienteIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);
        const acudiente = await verificarPropiedadAcudiente(user.id, acudienteId, estudianteId);

        const actualizado = await new AcudienteEstudianteRepository().cambiarEstado(acudiente.colegioId, acudienteId, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: accionAuditPorEstado(body),
            tipoRecurso: "AcudienteEstudiante",
            recursoId: acudienteId,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: acudiente.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ acudiente: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Acudiente no encontrado") {
            return NextResponse.json(
                { error: { message: "Acudiente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS/ACUDIENTES/ESTADO]");
    }
}

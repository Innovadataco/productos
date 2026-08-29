import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { estudianteIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";
import { verificarPropiedadEstudiante } from "@/lib/colegio/permisos";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
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

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);

        const estudiante = await verificarPropiedadEstudiante(user.id, id);
        if (estudiante.estado === body) {
            return NextResponse.json(
                { error: { message: `El alumno ya está ${body}`, code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const actualizado = await new EstudianteRepository().cambiarEstado(estudiante.colegioId, id, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_ALUMNO_DESACTIVADO",
            tipoRecurso: "Alumno",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: estudiante.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ alumno: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS]");
    }
}

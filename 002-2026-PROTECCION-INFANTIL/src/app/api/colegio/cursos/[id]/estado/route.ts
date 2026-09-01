import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { cursoIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";
import { verificarPropiedadCurso } from "@/lib/colegio/permisos";

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

        const { id } = withValidation.params(cursoIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);

        const curso = await verificarPropiedadCurso(user.id, id);
        if (curso.estado === body) {
            return NextResponse.json(
                { error: { message: `El curso ya está ${body}`, code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const actualizado = await new CursoRepository().cambiarEstado(curso.colegioId, id, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            // SPEC-176: la reactivación se audita como tal (antes ambas direcciones
            // quedaban como DESACTIVADO).
            accion: body === "activo" ? "COLEGIO_CURSO_ACTIVADO" : "COLEGIO_CURSO_DESACTIVADO",
            tipoRecurso: "Curso",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: curso.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ curso: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Curso no encontrado") {
            return NextResponse.json(
                { error: { message: "Curso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/CURSOS]");
    }
}

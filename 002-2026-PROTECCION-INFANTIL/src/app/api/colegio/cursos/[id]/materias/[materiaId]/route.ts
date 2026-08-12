/**
 * SPEC-162: desasigna una materia de un curso (soft delete).
 * DELETE /api/colegio/cursos/[id]/materias/[materiaId]
 * `id` es el curso; `materiaId` es el vínculo CursoMateria.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { CursoMateriaRepository } from "@/lib/dal/repositories/curso-materia";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cursoMateriaIdParamsSchema } from "@/lib/schemas";
import { verificarPropiedadCurso } from "@/lib/colegio/permisos";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; materiaId: string }> }) {
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

        const { id: cursoId, materiaId } = withValidation.params(cursoMateriaIdParamsSchema)(await params);
        const curso = await verificarPropiedadCurso(user.id, cursoId);

        const repo = new CursoMateriaRepository();
        const actual = await repo.obtenerPorId(curso.colegioId, materiaId);
        if (!actual || actual.cursoId !== cursoId) {
            return NextResponse.json(
                { error: { message: "Vínculo no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const desactivado = await repo.cambiarEstado(curso.colegioId, materiaId, "inactivo");

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_CURSO_MATERIA_DESACTIVADA",
            tipoRecurso: "CursoMateria",
            recursoId: materiaId,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: actual.estado }),
            valorNuevo: JSON.stringify({ estado: desactivado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ vinculo: desactivado });
    } catch (error) {
        if (error instanceof Error && error.message === "Curso no encontrado") {
            return NextResponse.json(
                { error: { message: "Curso no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/CURSO/MATERIAS]");
    }
}

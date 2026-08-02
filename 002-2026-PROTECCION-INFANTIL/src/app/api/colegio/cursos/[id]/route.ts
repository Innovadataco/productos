import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { CursoRepository } from "@/lib/dal/repositories/curso";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cursoIdParamsSchema, cursoUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadCurso } from "@/lib/colegio/permisos";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const rate = await checkRateLimit(request, "admin_read", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id } = withValidation.params(cursoIdParamsSchema)(await params);
        const curso = await verificarPropiedadCurso(user.id, id);

        return NextResponse.json({ curso });
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

        const { id } = withValidation.params(cursoIdParamsSchema)(await params);
        const body = await withValidation.body(cursoUpdateBodySchema)(request);

        const curso = await verificarPropiedadCurso(user.id, id);

        const nombre = body.nombre ?? curso.nombre;
        const grado = "grado" in body ? body.grado : curso.grado;
        const anioLectivo = "anioLectivo" in body ? body.anioLectivo : curso.anioLectivo;

        // SPEC-134 (E-1): duplicado y actualización viven en el repo (tenant obligatorio).
        const cursos = new CursoRepository();
        if (body.nombre !== undefined || body.grado !== undefined || body.anioLectivo !== undefined) {
            const duplicado = await cursos.buscarDuplicado(
                curso.colegioId,
                { nombre, grado: grado ?? null, anioLectivo: anioLectivo ?? null },
                id
            );
            if (duplicado) {
                return NextResponse.json(
                    { error: { message: "Ya existe un curso con ese nombre", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
        }

        const actualizado = await cursos.actualizar(curso.colegioId, id, {
            nombre: body.nombre ?? curso.nombre,
            grado: "grado" in body ? body.grado : curso.grado,
            anioLectivo: "anioLectivo" in body ? body.anioLectivo : curso.anioLectivo,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_CURSO_EDITADO",
            tipoRecurso: "Curso",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ nombre: curso.nombre, grado: curso.grado, anioLectivo: curso.anioLectivo }),
            valorNuevo: JSON.stringify({ nombre: actualizado.nombre, grado: actualizado.grado, anioLectivo: actualizado.anioLectivo }),
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

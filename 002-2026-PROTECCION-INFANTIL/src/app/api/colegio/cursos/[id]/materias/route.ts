/**
 * SPEC-162: materias asignadas a un curso.
 * GET /api/colegio/cursos/[id]/materias — lista activas.
 * POST /api/colegio/cursos/[id]/materias — asigna una materia al curso.
 * El segmento [id] es el identificador del curso.
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { CursoMateriaRepository } from "@/lib/dal/repositories/curso-materia";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation, ValidationError } from "@/lib/validation";
import { cursoMateriaParamsSchema, cursoMateriaBodySchema } from "@/lib/schemas";
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
        const vigencia = await verificarVigenciaColegioSalvoCamino(user.id);
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

        const { id: cursoId } = withValidation.params(cursoMateriaParamsSchema)(await params);
        const curso = await verificarPropiedadCurso(user.id, cursoId);

        const vinculos = await new CursoMateriaRepository().listarPorCurso(curso.colegioId, cursoId);
        return NextResponse.json({ materias: vinculos });
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const { id: cursoId } = withValidation.params(cursoMateriaParamsSchema)(await params);
        // SPEC-344 (D3): el 400 lleva el mensaje humano de la primera issue
        // ("Toda materia debe llevar un profesor a cargo"), no el genérico.
        const body = await withValidation.body(cursoMateriaBodySchema)(request).catch((error: unknown) => {
            if (error instanceof ValidationError) {
                throw new AppError(error.details[0]?.message ?? "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
            }
            throw error;
        });
        const curso = await verificarPropiedadCurso(user.id, cursoId);

        const vinculo = await new CursoMateriaRepository().crear(curso.colegioId, {
            cursoId,
            materiaId: body.materiaId,
            profesorId: body.profesorId,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_CURSO_MATERIA_CREADA",
            tipoRecurso: "CursoMateria",
            recursoId: vinculo.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({ cursoId, materiaId: body.materiaId, profesorId: body.profesorId ?? null }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ vinculo }, { status: 201 });
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

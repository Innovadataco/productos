import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AlumnoRepository } from "@/lib/dal/repositories/alumno";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { cursoIdParamsSchema, alumnoBodySchema } from "@/lib/schemas";
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

        // SPEC-134 (E-1): la consulta vive en el repo (SIEMPRE con tenant).
        const alumnos = await new AlumnoRepository().listarPorCurso(curso.colegioId, id);

        return NextResponse.json({ alumnos });
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const body = await withValidation.body(alumnoBodySchema)(request);

        const curso = await verificarPropiedadCurso(user.id, id);

        // SPEC-134 (E-1): duplicado y creación viven en el repo (SIEMPRE con tenant).
        const alumnos = new AlumnoRepository();
        const duplicado = await alumnos.buscarPorNombreEnCurso(curso.colegioId, id, body.nombre);
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Ya existe un alumno con ese nombre en este curso", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const alumno = await alumnos.crear(curso.colegioId, { cursoId: id, nombre: body.nombre });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_ALUMNO_CREADO",
            tipoRecurso: "Alumno",
            recursoId: alumno.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({ nombre: body.nombre, cursoId: id, colegioId: curso.colegioId }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ alumno }, { status: 201 });
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

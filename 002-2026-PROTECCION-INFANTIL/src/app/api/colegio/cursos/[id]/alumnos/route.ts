import { NextResponse } from "next/server";
import { sellarCookieSesionEstado } from "@/lib/routing/sellar-sesion-estado";
import { verifyAuth } from "@/lib/auth";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation, ValidationError } from "@/lib/validation";
import { cursoIdParamsSchema, estudianteBodySchema } from "@/lib/schemas";
import { TipoDocumentoRepository } from "@/lib/dal/repositories/tipo-documento";
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

        const { id } = withValidation.params(cursoIdParamsSchema)(await params);
        const curso = await verificarPropiedadCurso(user.id, id);

        // SPEC-134 (E-1): la consulta vive en el repo (SIEMPRE con tenant).
        const alumnos = await new EstudianteRepository().listarPorCurso(curso.colegioId, id);

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
        // SPEC-144 (FR-010): obligatorios solo nombre + apellidos; el 400 lleva el
        // mensaje humano de la primera issue ("Falta el apellido del estudiante",
        // "Máximo 2 acudientes por estudiante", tipo de documento inválido, …).
        const body = await withValidation.body(estudianteBodySchema)(request).catch((error: unknown) => {
            if (error instanceof ValidationError) {
                throw new AppError(error.details[0]?.message ?? "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
            }
            throw error;
        });

        const curso = await verificarPropiedadCurso(user.id, id);

        // SPEC-134 (E-1): duplicado y creación viven en el repo (SIEMPRE con tenant).
        // SPEC-144: el duplicado es por nombre + apellidos en el curso.
        const estudiantes = new EstudianteRepository();
        const duplicado = await estudiantes.buscarPorNombreEnCurso(curso.colegioId, id, body.nombre, body.apellidos);
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Ya existe un alumno con ese nombre en este curso", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // SPEC-320 (§2.2-bis): documento del alumno del catálogo + único por colegio.
        if (!(await new TipoDocumentoRepository().claveActiva(body.documentoTipo))) {
            return NextResponse.json(
                { error: { message: "Tipo de documento inválido o inactivo", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const docDuplicado = await estudiantes.buscarPorDocumentoEnColegio(curso.colegioId, body.documentoTipo, body.documentoNumero);
        if (docDuplicado) {
            return NextResponse.json(
                { error: { message: "Ya existe un alumno con ese documento en el colegio", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // D1: estudiante + acudientes en UNA escritura atómica (create anidado).
        const estudiante = await estudiantes.crear(curso.colegioId, {
            cursoId: id,
            nombre: body.nombre,
            apellidos: body.apellidos,
            documentoTipo: body.documentoTipo,
            documentoNumero: body.documentoNumero,
            acudientes: body.acudientes,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        // La acción y el tipoRecurso se CONSERVAN: el audit log es histórico e
        // inmutable (SPEC-144, contracts) — `valorNuevo` sí incluye apellidos.
        await logAudit({
            accion: "COLEGIO_ALUMNO_CREADO",
            tipoRecurso: "Alumno",
            recursoId: estudiante.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({ nombre: body.nombre, apellidos: body.apellidos, cursoId: id, colegioId: curso.colegioId }),
            ipAddress,
            userAgent,
        });

        // La clave `alumno` de la respuesta se conserva en esta SPEC (D2/contracts).
        const res = NextResponse.json({ alumno: estudiante }, { status: 201 });
        // SPEC-344 (A-69 · C1 · Phase 9-bis): sellar cookie — el primer
        // estudiante activo cierra el Paso 5 del camino colegio.
        await sellarCookieSesionEstado(res, user.id);
        return res;
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

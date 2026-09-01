import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { EstudianteRepository } from "@/lib/dal/repositories/estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { estudianteIdParamsSchema, estudianteUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadEstudiante } from "@/lib/colegio/permisos";

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

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const estudiante = await verificarPropiedadEstudiante(user.id, id);

        // La clave `alumno` de la respuesta se conserva en esta SPEC (D2/contracts).
        return NextResponse.json({ alumno: estudiante });
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

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const body = await withValidation.body(estudianteUpdateBodySchema)(request);

        const estudiante = await verificarPropiedadEstudiante(user.id, id);

        // SPEC-134 (E-1): duplicado y actualización viven en el repo (tenant obligatorio).
        // SPEC-144: el duplicado es por nombre + apellidos (combinando lo enviado con
        // lo ya persistido cuando solo se edita uno de los dos).
        const estudiantes = new EstudianteRepository();
        const nombreNuevo = body.nombre ?? estudiante.nombre;
        const apellidosNuevos = body.apellidos ?? estudiante.apellidos;
        if (body.nombre !== undefined || body.apellidos !== undefined) {
            const duplicado = await estudiantes.buscarDuplicadoEnCurso(
                estudiante.colegioId,
                estudiante.cursoId,
                nombreNuevo,
                apellidosNuevos,
                id
            );
            if (duplicado) {
                return NextResponse.json(
                    { error: { message: "Ya existe un alumno con ese nombre en este curso", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
        }

        const actualizado = await estudiantes.actualizar(estudiante.colegioId, id, {
            nombre: nombreNuevo,
            apellidos: apellidosNuevos,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_ALUMNO_EDITADO",
            tipoRecurso: "Alumno",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ nombre: estudiante.nombre, apellidos: estudiante.apellidos }),
            valorNuevo: JSON.stringify({ nombre: actualizado.nombre, apellidos: actualizado.apellidos }),
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

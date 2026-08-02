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
import { alumnoIdParamsSchema, alumnoUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadAlumno } from "@/lib/colegio/permisos";

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

        const { id } = withValidation.params(alumnoIdParamsSchema)(await params);
        const alumno = await verificarPropiedadAlumno(user.id, id);

        return NextResponse.json({ alumno });
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

        const { id } = withValidation.params(alumnoIdParamsSchema)(await params);
        const body = await withValidation.body(alumnoUpdateBodySchema)(request);

        const alumno = await verificarPropiedadAlumno(user.id, id);

        // SPEC-134 (E-1): duplicado y actualización viven en el repo (tenant obligatorio).
        const alumnos = new AlumnoRepository();
        if (body.nombre) {
            const duplicado = await alumnos.buscarDuplicadoEnCurso(alumno.colegioId, alumno.cursoId, body.nombre, id);
            if (duplicado) {
                return NextResponse.json(
                    { error: { message: "Ya existe un alumno con ese nombre en este curso", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
        }

        const actualizado = await alumnos.actualizar(alumno.colegioId, id, { nombre: body.nombre ?? alumno.nombre });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_ALUMNO_EDITADO",
            tipoRecurso: "Alumno",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ nombre: alumno.nombre }),
            valorNuevo: JSON.stringify({ nombre: actualizado.nombre }),
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

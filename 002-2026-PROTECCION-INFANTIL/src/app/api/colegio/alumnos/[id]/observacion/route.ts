import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { estudianteIdParamsSchema, observacionBodySchema } from "@/lib/schemas";
import { verificarPropiedadEstudiante } from "@/lib/colegio/permisos";
import {
    marcarObservacionEspecial,
    desmarcarObservacionEspecial,
    obtenerEstadoObservacion,
} from "@/lib/colegio/observacion";

/**
 * SPEC-150 (FR-002): observación especial del estudiante. Tenant-first: el
 * estudiante se resuelve SIEMPRE bajo el colegio del usuario (404 si es de
 * OTRO colegio — A/B). Marcar es idempotente (201 la primera vez, 200 con la
 * existente al re-marcar, nunca 409); desmarcar es soft delete que CONSERVA
 * la fila y el histórico (audit en ambas acciones, misma transacción).
 */

interface UsuarioColegio {
    id: string;
    colegioId: string | null;
}

async function verificarAcceso(request: Request, scope: "admin_read" | "admin_write") {
    const user = await verifyAuth("SCHOOL_ADMIN");
    await assertModulo(user, "colegios_gestion");
    const vigencia = await verificarVigenciaColegio(user.id);
    if (!vigencia.vigente) {
        return {
            error: NextResponse.json(
                { error: { message: vigencia.mensaje, code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            ),
        };
    }

    const rate = await checkRateLimit(request, scope, { identifier: user.id });
    if (!rate.allowed) {
        return {
            error: NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            ),
        };
    }

    if (!user.colegioId) {
        return {
            error: NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            ),
        };
    }

    return { user: user as UsuarioColegio & { colegioId: string } };
}

function esAlumnoNoEncontrado(error: unknown): boolean {
    return error instanceof Error && error.message === "Alumno no encontrado";
}

function respuestaNoEncontrado() {
    return NextResponse.json(
        { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
        { status: 404 }
    );
}

/** Estado actual + histórico completo de la observación (ficha del estudiante). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const acceso = await verificarAcceso(request, "admin_read");
        if ("error" in acceso) return acceso.error;

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const estudiante = await verificarPropiedadEstudiante(acceso.user.id, id);

        const observacion = await obtenerEstadoObservacion(estudiante.colegioId, id);
        return NextResponse.json({ observacion });
    } catch (error) {
        if (esAlumnoNoEncontrado(error)) return respuestaNoEncontrado();
        return errorToResponse(error, "[COLEGIO/ALUMNOS]");
    }
}

/** Marca la observación especial (idempotente: re-marca = 200 con la existente). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const acceso = await verificarAcceso(request, "admin_write");
        if ("error" in acceso) return acceso.error;

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const body = await withValidation.body(observacionBodySchema)(request);
        const estudiante = await verificarPropiedadEstudiante(acceso.user.id, id);

        const resultado = await marcarObservacionEspecial(estudiante.colegioId, id, acceso.user.id, body.motivo, request);
        return NextResponse.json(
            { observacion: resultado.observacion, creada: resultado.creada },
            { status: resultado.creada ? 201 : 200 }
        );
    } catch (error) {
        if (esAlumnoNoEncontrado(error)) return respuestaNoEncontrado();
        return errorToResponse(error, "[COLEGIO/ALUMNOS]");
    }
}

/** Desmarca con soft delete (fila e histórico CONSERVADOS). 404 si no hay activa. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const acceso = await verificarAcceso(request, "admin_write");
        if ("error" in acceso) return acceso.error;

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const estudiante = await verificarPropiedadEstudiante(acceso.user.id, id);

        const desactivada = await desmarcarObservacionEspecial(estudiante.colegioId, id, acceso.user.id, request);
        if (!desactivada) {
            return NextResponse.json(
                { error: { message: "El alumno no tiene una observación especial activa", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return NextResponse.json({ observacion: desactivada });
    } catch (error) {
        if (esAlumnoNoEncontrado(error)) return respuestaNoEncontrado();
        return errorToResponse(error, "[COLEGIO/ALUMNOS]");
    }
}

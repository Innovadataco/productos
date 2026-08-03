import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { ProfesorRepository } from "@/lib/dal/repositories/profesor";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES, AppError } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation, ValidationError } from "@/lib/validation";
import { profesorIdParamsSchema, profesorPatchSchema } from "@/lib/schemas";

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

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = withValidation.params(profesorIdParamsSchema)(await params);

        // SPEC-145 (E-1): 404 si no existe O es de OTRO colegio (tenant en el where).
        const profesor = await new ProfesorRepository().obtenerPorId(user.colegioId, id);
        if (!profesor) {
            return NextResponse.json(
                { error: { message: "Profesor no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        return NextResponse.json({ profesor });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/PROFESORES]");
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

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const { id } = withValidation.params(profesorIdParamsSchema)(await params);
        const body = await withValidation.body(profesorPatchSchema)(request).catch((error: unknown) => {
            if (error instanceof ValidationError) {
                throw new AppError(error.details[0]?.message ?? "Datos inválidos", ERROR_CODES.VALIDATION_ERROR, 400);
            }
            throw error;
        });

        // SPEC-145 (E-1): 404 si no existe O es de OTRO colegio (tenant en el where).
        const profesores = new ProfesorRepository();
        const profesor = await profesores.obtenerPorId(user.colegioId, id);
        if (!profesor) {
            return NextResponse.json(
                { error: { message: "Profesor no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const { estado, ...campos } = body;
        let actualizado = profesor;
        if (Object.values(campos).some((v) => v !== undefined)) {
            actualizado = await profesores.actualizar(user.colegioId, id, campos);
        }
        // Baja suave (estado "inactivo"): la fila NUNCA se borra (§7.2) y la
        // asignación de titular en los cursos se CONSERVA (CONDICIÓN 2/FR-014).
        if (estado !== undefined) {
            actualizado = await profesores.cambiarEstado(user.colegioId, id, estado);
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: estado === "inactivo" ? "COLEGIO_PROFESOR_DESACTIVADO" : "COLEGIO_PROFESOR_EDITADO",
            tipoRecurso: "Profesor",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ nombre: profesor.nombre, apellidos: profesor.apellidos, estado: profesor.estado }),
            valorNuevo: JSON.stringify({ nombre: actualizado.nombre, apellidos: actualizado.apellidos, estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ profesor: actualizado });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/PROFESORES]");
    }
}

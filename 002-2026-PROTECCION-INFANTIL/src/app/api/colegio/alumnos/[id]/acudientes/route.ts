/**
 * SPEC-163: acudientes de un estudiante.
 * GET /api/colegio/alumnos/[id]/acudientes — lista activos ordenados.
 * POST /api/colegio/alumnos/[id]/acudientes — crea un acudiente (máx 2 activos).
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AcudienteEstudianteRepository } from "@/lib/dal/repositories/acudiente-estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { estudianteIdParamsSchema, acudienteEstudianteBodySchema } from "@/lib/schemas";
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

        const acudientes = await new AcudienteEstudianteRepository().listarActivosPorEstudiante(estudiante.colegioId, id);
        return NextResponse.json({ acudientes });
    } catch (error) {
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS/ACUDIENTES]");
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

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const body = await withValidation.body(acudienteEstudianteBodySchema)(request);
        const estudiante = await verificarPropiedadEstudiante(user.id, id);

        const acudiente = await new AcudienteEstudianteRepository().crear(estudiante.colegioId, id, {
            orden: body.orden,
            nombre: body.nombre,
            relacion: body.relacion,
            telefono: body.telefono,
            email: body.email,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_ACUDIENTE_CREADO",
            tipoRecurso: "AcudienteEstudiante",
            recursoId: acudiente.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({
                estudianteId: id,
                orden: acudiente.orden,
                nombre: acudiente.nombre,
                relacion: acudiente.relacion,
                telefono: acudiente.telefono,
                email: acudiente.email,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ acudiente }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS/ACUDIENTES]");
    }
}

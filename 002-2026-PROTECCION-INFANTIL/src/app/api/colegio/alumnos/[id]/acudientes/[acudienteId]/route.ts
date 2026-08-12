/**
 * SPEC-163: edición de un acudiente.
 * PATCH /api/colegio/alumnos/[id]/acudientes/[acudienteId]
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { AcudienteEstudianteRepository } from "@/lib/dal/repositories/acudiente-estudiante";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { acudienteIdParamsSchema, acudienteUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadAcudiente } from "@/lib/colegio/permisos";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; acudienteId: string }> }) {
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

        const { id: estudianteId, acudienteId } = withValidation.params(acudienteIdParamsSchema)(await params);
        const body = await withValidation.body(acudienteUpdateBodySchema)(request);
        const acudiente = await verificarPropiedadAcudiente(user.id, acudienteId, estudianteId);

        const datos: Partial<import("@/lib/dal/repositories/acudiente-estudiante").DatosAcudiente> = {};
        if (body.nombre !== undefined) datos.nombre = body.nombre;
        if (body.relacion !== undefined) datos.relacion = body.relacion;
        if (body.telefono !== undefined) datos.telefono = body.telefono;
        if (body.email !== undefined) datos.email = body.email;

        const actualizado = await new AcudienteEstudianteRepository().actualizar(acudiente.colegioId, acudienteId, datos);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_ACUDIENTE_EDITADO",
            tipoRecurso: "AcudienteEstudiante",
            recursoId: acudienteId,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({
                nombre: acudiente.nombre,
                relacion: acudiente.relacion,
                telefono: acudiente.telefono,
                email: acudiente.email,
            }),
            valorNuevo: JSON.stringify({
                nombre: actualizado.nombre,
                relacion: actualizado.relacion,
                telefono: actualizado.telefono,
                email: actualizado.email,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ acudiente: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Acudiente no encontrado") {
            return NextResponse.json(
                { error: { message: "Acudiente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS/ACUDIENTES]");
    }
}

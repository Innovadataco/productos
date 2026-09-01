/**
 * SPEC-162: cambio de estado (activo/inactivo) de una materia del colegio.
 * PATCH /api/colegio/materias/[id]/estado
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { MateriaRepository } from "@/lib/dal/repositories/materia";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { materiaIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
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

        const { id } = withValidation.params(materiaIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const repo = new MateriaRepository();
        const actual = await repo.obtenerPorId(user.colegioId, id);
        if (!actual) {
            return NextResponse.json(
                { error: { message: "Materia no encontrada", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (actual.estado === body) {
            return NextResponse.json(
                { error: { message: `La materia ya está ${body}`, code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const actualizada = await repo.cambiarEstado(user.colegioId, id, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: body === "activo" ? "COLEGIO_MATERIA_REACTIVADA" : "COLEGIO_MATERIA_DESACTIVADA",
            tipoRecurso: "Materia",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: actual.estado }),
            valorNuevo: JSON.stringify({ estado: actualizada.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ materia: actualizada });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/MATERIAS]");
    }
}

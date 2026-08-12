/**
 * SPEC-163: cambio de estado de un identificador de acudiente.
 * PATCH /api/colegio/acudientes/[id]/identificadores/[identificadorId]/estado
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { IdentificadorAcudienteRepository } from "@/lib/dal/repositories/identificador-acudiente";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { identificadorAcudienteIdParamsSchema, estadoActivoSchema } from "@/lib/schemas";
import { verificarPropiedadAcudiente } from "@/lib/colegio/permisos";
import type { EstadoActivo } from "@/lib/dal/repositories/curso";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

function accionAuditPorEstado(estado: EstadoActivo): "COLEGIO_IDENTIFICADOR_ACUDIENTE_REACTIVADO" | "COLEGIO_IDENTIFICADOR_ACUDIENTE_DESACTIVADO" {
    return estado === "activo" ? "COLEGIO_IDENTIFICADOR_ACUDIENTE_REACTIVADO" : "COLEGIO_IDENTIFICADOR_ACUDIENTE_DESACTIVADO";
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; identificadorId: string }> }) {
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

        const { id: acudienteId, identificadorId } = withValidation.params(identificadorAcudienteIdParamsSchema)(await params);
        const body = await withValidation.body(estadoActivoSchema)(request);
        const acudiente = await verificarPropiedadAcudiente(user.id, acudienteId);

        const repo = new IdentificadorAcudienteRepository();
        const identificador = await repo.obtenerPorId(acudiente.colegioId, identificadorId);
        if (!identificador || identificador.acudienteId !== acudienteId) {
            return NextResponse.json(
                { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        const actualizado = await repo.cambiarEstado(acudiente.colegioId, identificadorId, body);

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: accionAuditPorEstado(body),
            tipoRecurso: "IdentificadorAcudiente",
            recursoId: identificadorId,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({ estado: identificador.estado }),
            valorNuevo: JSON.stringify({ estado: actualizado.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Acudiente no encontrado") {
            return NextResponse.json(
                { error: { message: "Acudiente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ACUDIENTES/IDENTIFICADORES/ESTADO]");
    }
}

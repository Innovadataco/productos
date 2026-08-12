/**
 * SPEC-164: edición de un identificador de profesor.
 * PATCH /api/colegio/identificadores-profesor/[id]
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { IdentificadorProfesorRepository } from "@/lib/dal/repositories/identificador-profesor";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { identificadorProfesorIdParamsSchema, identificadorProfesorUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadIdentificadorProfesor } from "@/lib/colegio/permisos";
import { normalizarIdentificador } from "@/lib/colegio/normalizacion";

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

        const { id: identificadorId } = withValidation.params(identificadorProfesorIdParamsSchema)(await params);
        const body = await withValidation.body(identificadorProfesorUpdateBodySchema)(request);
        const identificador = await verificarPropiedadIdentificadorProfesor(user.id, identificadorId);

        if (body.plataformaId) {
            const plataforma = await new PlataformaRepository().findById(body.plataformaId);
            if (!plataforma) {
                return NextResponse.json(
                    { error: { message: "Plataforma no encontrada", code: ERROR_CODES.NOT_FOUND } },
                    { status: 404 }
                );
            }
        }

        const tipo = body.tipo ?? identificador.tipo;
        const valor = body.valor ? normalizarIdentificador(body.valor, tipo) : identificador.valor;
        const plataformaId = "plataformaId" in body ? body.plataformaId : identificador.plataformaId;

        const repo = new IdentificadorProfesorRepository();
        if (body.tipo !== undefined || body.valor !== undefined || body.plataformaId !== undefined) {
            const duplicado = await repo.buscarDuplicado(
                identificador.colegioId,
                { profesorId: identificador.profesorId, tipo, valor, plataformaId: plataformaId ?? null },
                identificadorId
            );
            if (duplicado) {
                return NextResponse.json(
                    { error: { message: "Identificador duplicado para este profesor", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
        }

        const actualizado = await repo.actualizar(identificador.colegioId, identificadorId, {
            tipo,
            valor,
            plataformaId: plataformaId ?? null,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO",
            tipoRecurso: "IdentificadorProfesor",
            recursoId: identificadorId,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({
                tipo: identificador.tipo,
                valor: identificador.valor,
                plataformaId: identificador.plataformaId,
            }),
            valorNuevo: JSON.stringify({
                tipo: actualizado.tipo,
                valor: actualizado.valor,
                plataformaId: actualizado.plataformaId,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: actualizado });
    } catch (error) {
        if (error instanceof Error && error.message === "Identificador no encontrado") {
            return NextResponse.json(
                { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/IDENTIFICADORES-PROFESOR]");
    }
}

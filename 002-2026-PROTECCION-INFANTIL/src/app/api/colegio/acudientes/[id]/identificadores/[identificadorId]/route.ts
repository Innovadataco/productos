/**
 * SPEC-163: edición de un identificador de acudiente.
 * PATCH /api/colegio/acudientes/[id]/identificadores/[identificadorId]
 */
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { IdentificadorAcudienteRepository } from "@/lib/dal/repositories/identificador-acudiente";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { identificadorAcudienteIdParamsSchema, identificadorAcudienteUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadAcudiente } from "@/lib/colegio/permisos";
import { normalizarIdentificador } from "@/lib/colegio/normalizacion";
import { IdentificadorUnicidadService } from "@/lib/colegio/identificador-unicidad";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
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
        const body = await withValidation.body(identificadorAcudienteUpdateBodySchema)(request);
        const acudiente = await verificarPropiedadAcudiente(user.id, acudienteId);

        const repo = new IdentificadorAcudienteRepository();
        const identificador = await repo.obtenerPorId(acudiente.colegioId, identificadorId);
        if (!identificador || identificador.acudienteId !== acudienteId) {
            return NextResponse.json(
                { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

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

        if (body.tipo !== undefined || body.valor !== undefined || body.plataformaId !== undefined) {
            const duplicado = await repo.buscarDuplicado(
                acudiente.colegioId,
                { acudienteId, tipo, valor, plataformaId: plataformaId ?? null },
                identificadorId
            );
            if (duplicado) {
                return NextResponse.json(
                    { error: { message: "Identificador duplicado para este acudiente", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }

            // SPEC-320 (§2.1): acudiente no tiene caso duro (padre-de-dos-hijos legítimo);
            // todo cruce es warn-con-override.
            const colision = await new IdentificadorUnicidadService().clasificarColision(
                acudiente.colegioId,
                valor,
                "ACUDIENTE",
                { sujeto: "ACUDIENTE", sujetoId: acudienteId }
            );
            if (colision.warns.length > 0 && !body.confirmarCompartido) {
                return NextResponse.json(
                    {
                        aviso: {
                            code: "IDENTIFICADOR_EN_USO_EN_COLEGIO",
                            message: "Este identificador ya está registrado para otra persona del colegio.",
                            pertenece: colision.warns.map((d) => ({ nombre: d.nombre, rol: d.rol })),
                        },
                    },
                    { status: 200 }
                );
            }
        }

        const actualizado = await repo.actualizar(acudiente.colegioId, identificadorId, {
            tipo,
            valor,
            plataformaId: plataformaId ?? null,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_ACUDIENTE_EDITADO",
            tipoRecurso: "IdentificadorAcudiente",
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
        if (error instanceof Error && error.message === "Acudiente no encontrado") {
            return NextResponse.json(
                { error: { message: "Acudiente no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ACUDIENTES/IDENTIFICADORES]");
    }
}

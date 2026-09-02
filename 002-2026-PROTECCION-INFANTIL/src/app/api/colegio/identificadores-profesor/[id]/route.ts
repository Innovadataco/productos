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
import { verificarVigenciaColegioSalvoCamino } from "@/lib/colegio/vigencia-camino";
import { withValidation } from "@/lib/validation";
import { identificadorProfesorIdParamsSchema, identificadorProfesorUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadIdentificadorProfesor } from "@/lib/colegio/permisos";
import { normalizarIdentificador } from "@/lib/colegio/normalizacion";
import { IdentificadorUnicidadService } from "@/lib/dal/services/identificador-unicidad";

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

            // SPEC-320 (§2.1): clasificar la colisión cross-sujeto al editar.
            // profesor↔profesor = bloqueo duro (I-213); cross-sujeto = warn-override.
            const colision = await new IdentificadorUnicidadService().clasificarColision(
                identificador.colegioId,
                valor,
                "PROFESOR",
                { sujeto: "PROFESOR", sujetoId: identificador.profesorId }
            );
            if (colision.duros.length > 0) {
                return NextResponse.json(
                    {
                        error: {
                            message: `Este identificador ya pertenece a otro ${colision.duros[0].rol.toLowerCase()} de este colegio y no puede repetirse.`,
                            code: ERROR_CODES.CONFLICT,
                        },
                    },
                    { status: 409 }
                );
            }
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

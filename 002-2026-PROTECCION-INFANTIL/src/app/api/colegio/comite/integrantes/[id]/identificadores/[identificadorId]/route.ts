/**
 * SPEC-380 (PR B · C4) — PATCH /api/colegio/comite/integrantes/[id]/identificadores/[identificadorId].
 *
 * Cambia el estado (activo|inactivo) del identificador. No hay DELETE: soft
 * delete por estado (patrón del resto — nada se borra en la operación diaria).
 *
 * SPEC-932 · también EDITA (`{ valor, plataformaId? }`) — el comité gana «Editar» como los otros 3 sujetos
 * (componente único). Pertenencia: `colegioId` de la sesión + `integranteId` de la ruta. Plataforma validada
 * (antes un id inexistente reventaba la FK como 500). Duplicado dentro del integrante → 409.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { withValidation } from "@/lib/validation";
import { cuidIdSchema } from "@/lib/schemas";
import { IdentificadorIntegranteComiteRepository } from "@/lib/dal/repositories/identificador-integrante-comite";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { normalizarIdentificador, inferirTipoIdentificador } from "@/lib/colegio/normalizacion";
import { logAudit } from "@/lib/audit";

const estadoSchema = z.object({ estado: z.enum(["activo", "inactivo"]) }).strict();
const edicionSchema = z
    .object({
        valor: z.string().trim().min(1, "Escriba el identificador.").max(200),
        plataformaId: z.string().trim().optional().nullable(),
    })
    .strict();
const patchSchema = z.union([estadoSchema, edicionSchema]);

async function resolverColegioId(user: { rol: string; colegioId?: string | null; comiteColegioId?: string | null }): Promise<string | null> {
    if (user.rol === "SCHOOL_ADMIN") return user.colegioId ?? null;
    if (user.rol === "COMITE_CONVIVENCIA") return user.comiteColegioId ?? null;
    return null;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string; identificadorId: string }> }
) {
    try {
        const user = await verifyAuth();
        const colegioId = await resolverColegioId(user);
        if (!colegioId) {
            return NextResponse.json(
                { error: { message: "Cuenta sin colegio vinculado.", code: ERROR_CODES.FORBIDDEN } },
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

        const { id: integranteId, identificadorId } = withValidation.params(
            z.object({ id: cuidIdSchema, identificadorId: cuidIdSchema })
        )(await params);
        const body = await withValidation.body(patchSchema)(request);

        if ("valor" in body) {
            return await editar(request, user.id, colegioId, integranteId, identificadorId, body);
        }

        const actualizado = await new IdentificadorIntegranteComiteRepository().cambiarEstado(
            colegioId,
            identificadorId,
            body.estado
        );

        const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            accion: "COLEGIO_ALERTA_ESTADO",
            tipoRecurso: "IdentificadorIntegranteComite",
            recursoId: identificadorId,
            usuarioId: user.id,
            colegioId,
            valorNuevo: JSON.stringify({ estado: body.estado }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador: actualizado });
    } catch (error) {
        return errorToResponse(error, "[COLEGIO/COMITE/INTEGRANTES/IDENTIFICADORES/PATCH]");
    }
}

/** SPEC-932 · edición del identificador (valor + plataforma). Tipo inferido del valor, como en el alta. */
async function editar(
    request: Request,
    usuarioId: string,
    colegioId: string,
    integranteId: string,
    identificadorId: string,
    body: z.infer<typeof edicionSchema>
): Promise<NextResponse> {
    const repo = new IdentificadorIntegranteComiteRepository();
    const previo = await repo.obtenerPorId(colegioId, identificadorId);
    if (!previo || previo.integranteId !== integranteId) {
        return NextResponse.json(
            { error: { message: "Identificador no encontrado", code: ERROR_CODES.NOT_FOUND } },
            { status: 404 }
        );
    }
    const plataformaId = body.plataformaId ? body.plataformaId : null;
    if (plataformaId && !(await new PlataformaRepository().findById(plataformaId))) {
        return NextResponse.json(
            { error: { message: "Plataforma no encontrada", code: ERROR_CODES.NOT_FOUND } },
            { status: 404 }
        );
    }
    const valor = normalizarIdentificador(body.valor);
    const tipo = inferirTipoIdentificador(valor);
    const duplicado = await repo.buscarDuplicado(colegioId, { integranteId, tipo, valor, plataformaId }, identificadorId);
    if (duplicado) {
        return NextResponse.json(
            { error: { message: "Este identificador ya está registrado para el integrante.", code: ERROR_CODES.CONFLICT } },
            { status: 409 }
        );
    }
    const actualizado = await repo.actualizar(colegioId, integranteId, identificadorId, { tipo, valor, plataformaId });

    await logAudit({
        accion: "COLEGIO_IDENTIFICADOR_EDITADO",
        tipoRecurso: "IdentificadorIntegranteComite",
        recursoId: identificadorId,
        usuarioId,
        colegioId,
        valorAnterior: JSON.stringify({ tipo: previo.tipo, plataformaId: previo.plataformaId }),
        valorNuevo: JSON.stringify({ tipo, plataformaId }),
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    });
    return NextResponse.json({ identificador: actualizado });
}

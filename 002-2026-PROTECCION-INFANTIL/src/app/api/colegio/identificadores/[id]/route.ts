import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { IdentificadorAlumnoRepository } from "@/lib/dal/repositories/identificador-alumno";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { identificadorAlumnoIdParamsSchema, identificadorAlumnoUpdateBodySchema } from "@/lib/schemas";
import { verificarPropiedadIdentificador } from "@/lib/colegio/permisos";
import { normalizarIdentificador } from "@/lib/colegio/normalizacion";
import type { EtiquetaRelacionAlumno } from "@prisma/client";

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

        const { id } = withValidation.params(identificadorAlumnoIdParamsSchema)(await params);
        const body = await withValidation.body(identificadorAlumnoUpdateBodySchema)(request);

        const identificador = await verificarPropiedadIdentificador(user.id, id);

        const tipo = body.tipo ?? identificador.tipo;
        const valor = body.valor ? normalizarIdentificador(body.valor, tipo) : identificador.valor;
        const plataformaId = "plataformaId" in body ? body.plataformaId : identificador.plataformaId;

        if (body.plataformaId) {
            const plataforma = await new PlataformaRepository().findById(body.plataformaId);
            if (!plataforma) {
                return NextResponse.json(
                    { error: { message: "Plataforma no encontrada", code: ERROR_CODES.NOT_FOUND } },
                    { status: 404 }
                );
            }
        }

        // verificarPropiedadIdentificador ya garantizó usuario vinculado a un colegio.
        const colegioId = user.colegioId!;
        // SPEC-134 (E-1): duplicado y actualización viven en el repo (tenant vía la relación alumno).
        const identificadores = new IdentificadorAlumnoRepository();
        if (body.tipo !== undefined || body.valor !== undefined || body.plataformaId !== undefined) {
            const duplicado = await identificadores.buscarDuplicado(
                colegioId,
                { alumnoId: identificador.alumnoId, tipo, valor, plataformaId: plataformaId ?? null },
                id
            );
            if (duplicado) {
                return NextResponse.json(
                    { error: { message: "Identificador duplicado para este alumno", code: ERROR_CODES.CONFLICT } },
                    { status: 409 }
                );
            }
        }

        const actualizado = await identificadores.actualizar(colegioId, id, {
            tipo: body.tipo ?? identificador.tipo,
            valor,
            plataformaId: plataformaId ?? null,
            etiquetaRelacion: (body.etiquetaRelacion ?? identificador.etiquetaRelacion) as EtiquetaRelacionAlumno,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_EDITADO",
            tipoRecurso: "IdentificadorAlumno",
            recursoId: id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorAnterior: JSON.stringify({
                tipo: identificador.tipo,
                valor: identificador.valor,
                plataformaId: identificador.plataformaId,
                etiquetaRelacion: identificador.etiquetaRelacion,
            }),
            valorNuevo: JSON.stringify({
                tipo: actualizado.tipo,
                valor: actualizado.valor,
                plataformaId: actualizado.plataformaId,
                etiquetaRelacion: actualizado.etiquetaRelacion,
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
        return errorToResponse(error, "[COLEGIO/IDENTIFICADORES]");
    }
}

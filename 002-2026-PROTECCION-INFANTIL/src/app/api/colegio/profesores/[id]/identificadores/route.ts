/**
 * SPEC-164: identificadores de un profesor.
 * GET /api/colegio/profesores/[id]/identificadores — lista activos.
 * POST /api/colegio/profesores/[id]/identificadores — crea un identificador.
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
import { profesorIdParamsSchema, identificadorProfesorBodySchema } from "@/lib/schemas";
import { verificarPropiedadProfesor } from "@/lib/colegio/permisos";
import { normalizarIdentificador, inferirTipoIdentificador } from "@/lib/colegio/normalizacion";

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

        const { id: profesorId } = withValidation.params(profesorIdParamsSchema)(await params);
        const profesor = await verificarPropiedadProfesor(user.id, profesorId);

        const identificadores = await new IdentificadorProfesorRepository().listarPorProfesor(profesor.colegioId, profesorId);
        return NextResponse.json({ identificadores });
    } catch (error) {
        if (error instanceof Error && error.message === "Profesor no encontrado") {
            return NextResponse.json(
                { error: { message: "Profesor no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/PROFESORES/IDENTIFICADORES]");
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        const { id: profesorId } = withValidation.params(profesorIdParamsSchema)(await params);
        const body = await withValidation.body(identificadorProfesorBodySchema)(request);
        const profesor = await verificarPropiedadProfesor(user.id, profesorId);

        const tipo = body.tipo?.trim() || inferirTipoIdentificador(body.valor);
        const valorNormalizado = normalizarIdentificador(body.valor, tipo);

        if (body.plataformaId) {
            const plataforma = await new PlataformaRepository().findById(body.plataformaId);
            if (!plataforma) {
                return NextResponse.json(
                    { error: { message: "Plataforma no encontrada", code: ERROR_CODES.NOT_FOUND } },
                    { status: 404 }
                );
            }
        }

        const repo = new IdentificadorProfesorRepository();
        const duplicado = await repo.buscarDuplicado(profesor.colegioId, {
            profesorId,
            tipo,
            valor: valorNormalizado,
            plataformaId: body.plataformaId ?? null,
        });
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Identificador duplicado para este profesor", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const identificador = await repo.crear(profesor.colegioId, {
            profesorId,
            tipo,
            valor: valorNormalizado,
            plataformaId: body.plataformaId ?? null,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_PROFESOR_CREADO",
            tipoRecurso: "IdentificadorProfesor",
            recursoId: identificador.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({
                profesorId,
                tipo,
                valor: valorNormalizado,
                plataformaId: body.plataformaId ?? null,
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "Profesor no encontrado") {
            return NextResponse.json(
                { error: { message: "Profesor no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/PROFESORES/IDENTIFICADORES]");
    }
}

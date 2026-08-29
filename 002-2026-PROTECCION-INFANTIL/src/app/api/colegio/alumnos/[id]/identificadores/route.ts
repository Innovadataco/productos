import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { PlataformaRepository } from "@/lib/dal/repositories/plataforma";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { ERROR_CODES } from "@/lib/errors";
import { errorToResponse } from "@/lib/api-handler";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { estudianteIdParamsSchema, identificadorEstudianteBodySchema } from "@/lib/schemas";
import { verificarPropiedadEstudiante } from "@/lib/colegio/permisos";
import { normalizarIdentificador, inferirTipoIdentificador } from "@/lib/colegio/normalizacion";
import type { EtiquetaRelacionEstudiante } from "@prisma/client";

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

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const estudiante = await verificarPropiedadEstudiante(user.id, id);

        // SPEC-134 (E-1): la consulta vive en el repo (tenant vía la relación estudiante).
        const identificadores = await new IdentificadorEstudianteRepository().listarPorEstudiante(estudiante.colegioId, id);

        return NextResponse.json({ identificadores });
    } catch (error) {
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS]");
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

        const { id } = withValidation.params(estudianteIdParamsSchema)(await params);
        const body = await withValidation.body(identificadorEstudianteBodySchema)(request);

        const estudiante = await verificarPropiedadEstudiante(user.id, id);

        // El tipo ya no se pide en el formulario: si no viene, se infiere del valor.
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

        // SPEC-134 (E-1): duplicado y creación viven en el repo (tenant vía la relación estudiante).
        const identificadores = new IdentificadorEstudianteRepository();
        const duplicado = await identificadores.buscarDuplicado(estudiante.colegioId, {
            estudianteId: id,
            tipo,
            valor: valorNormalizado,
            plataformaId: body.plataformaId ?? null,
        });
        if (duplicado) {
            return NextResponse.json(
                { error: { message: "Identificador duplicado para este estudiante", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const identificador = await identificadores.crear(estudiante.colegioId, {
            estudianteId: id,
            tipo,
            valor: valorNormalizado,
            plataformaId: body.plataformaId ?? null,
            etiquetaRelacion: (body.etiquetaRelacion ?? "ESTUDIANTE") as EtiquetaRelacionEstudiante,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "COLEGIO_IDENTIFICADOR_CREADO",
            tipoRecurso: "IdentificadorAlumno",
            recursoId: identificador.id,
            usuarioId: user.id,
            colegioId: user.colegioId ?? undefined,
            valorNuevo: JSON.stringify({
                estudianteId: id,
                tipo,
                valor: valorNormalizado,
                plataformaId: body.plataformaId ?? null,
                etiquetaRelacion: body.etiquetaRelacion ?? "ESTUDIANTE",
            }),
            ipAddress,
            userAgent,
        });

        return NextResponse.json({ identificador }, { status: 201 });
    } catch (error) {
        if (error instanceof Error && error.message === "Alumno no encontrado") {
            return NextResponse.json(
                { error: { message: "Alumno no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        return errorToResponse(error, "[COLEGIO/ALUMNOS]");
    }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { verificarVigenciaColegio } from "@/lib/colegio/vigencia";
import { withValidation } from "@/lib/validation";
import { confirmarCargaSchema } from "@/lib/schemas";
import { verificarTokenCarga } from "@/lib/colegio/carga/token";
import { importarCargaMasiva } from "@/lib/colegio/carga/importer";

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

export async function POST(request: Request) {
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

        if (!user.colegioId) {
            return NextResponse.json(
                { error: { message: "Usuario no vinculado a un colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const body = await withValidation.body(confirmarCargaSchema)(request);
        const payload = await verificarTokenCarga(body.tokenConfirmacion);
        if (!payload) {
            return NextResponse.json(
                { error: { message: "Token de confirmación inválido o expirado", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        if (payload.colegioId !== user.colegioId) {
            return NextResponse.json(
                { error: { message: "Token no corresponde a este colegio", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (payload.filas.length === 0) {
            return NextResponse.json(
                { error: { message: "No hay filas para importar", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const resumen = await prisma.$transaction(async (tx) => {
            const resultado = await importarCargaMasiva(payload.filas, payload.colegioId, tx);

            const { ipAddress, userAgent } = getClientInfo(request);
            await logAudit({
                accion: "COLEGIO_CARGA_MASIVA",
                tipoRecurso: "CargaMasivaAlumnos",
                usuarioId: user.id,
                colegioId: user.colegioId ?? undefined,
                valorNuevo: JSON.stringify({
                    colegioId: payload.colegioId,
                    filas: payload.filas.length,
                    resultado,
                }),
                ipAddress,
                userAgent,
                tx,
            });

            return resultado;
        });

        return NextResponse.json(
            {
                mensaje: "Carga completada correctamente",
                resumen,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        return NextResponse.json(
            { error: { message: "Error interno", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { generarEmbedding } from "@/lib/ai/embedder";
import { MODELO_EMBEDDING_DEFAULT } from "@/lib/ai/defaults";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { idSchema } from "@/lib/validators";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { esAdminRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";
import { z } from "zod";

const validarSchema = z.object({
    valida: z.boolean(),
    observaciones: z.string().max(2000).optional(),
});

function requireOperadorOAdmin(user: { rol: string }) {
    if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

function getClientInfo(request: Request) {
    return {
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
    };
}

async function regenerarEmbedding(reporteId: string, texto: string) {
    try {
        // E-8 (D3): parámetro por el repo; upsert del embedding en el adaptador.
        const paramEmbedding = await new ParametroRepository().findByClave("reportes.embedding_model");
        const modeloEmbedding = paramEmbedding?.valor || MODELO_EMBEDDING_DEFAULT;
        const vector = await generarEmbedding(modeloEmbedding, texto);

        await new EmbeddingRepository().upsertReporteEmbedding(reporteId, modeloEmbedding, vector);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error("[VALIDAR-ANONIMIZACION] Embedding falló (no crítico):", msg);
        // No fallamos la validación; el embedding se puede regenerar después.
    }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireOperadorOAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas solicitudes. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const { id: rawId } = await params;
        const parsedId = idSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json(
                { error: { message: "ID inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }
        const reporteId = parsedId.data;

        const body = await request.json();
        const parsed = validarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsed.error.format() } },
                { status: 400 }
            );
        }
        const { valida, observaciones } = parsed.data;

        // E-8: la lectura vive en el repo; la ruta no toca prisma.
        const reporte = await new ReporteRepository().findByIdConClasificacion(reporteId);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (!puedeGestionarReporte(user, reporte)) {
            return NextResponse.json(
                { error: { message: "No tiene permiso para gestionar este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede validar un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (reporte.estado !== "REQUIERE_ANONIMIZACION") {
            return NextResponse.json(
                { error: { message: "El reporte no está pendiente de validación de anonimización", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { ipAddress, userAgent } = getClientInfo(request);
        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";

        if (valida) {
            await withUnitOfWork(async (tx) => {
                await registrarTransicion({
                    reporteId,
                    estadoAnterior: "REQUIERE_ANONIMIZACION",
                    estadoNuevo: "CLASIFICADO",
                    responsableTipo,
                    responsableId: user.id,
                    motivo: observaciones || "Anonimización validada",
                    tx,
                });
                await new ReporteRepository(tx).actualizarEstado(reporteId, {
                    estado: "CLASIFICADO",
                    anonimizacionValidadaPorId: user.id,
                    anonimizacionValidadaEn: new Date(),
                });
                await logAudit({
                    accion: "ANONIMIZACION_VALIDADA",
                    tipoRecurso: "Reporte",
                    recursoId: reporteId,
                    usuarioId: user.id,
                    ipAddress,
                    userAgent,
                    tx,
                    metadatos: { observaciones: observaciones || null },
                });
            });

            await regenerarEmbedding(reporteId, descifrarTextoReporte(reporte.texto));
            await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);

            return NextResponse.json({
                reporteId,
                estadoAnterior: "REQUIERE_ANONIMIZACION",
                estadoNuevo: "CLASIFICADO",
                validado: true,
            });
        }

        // Caso rechazado: solo se audita y se mantiene el estado.
        await logAudit({
            accion: "ANONIMIZACION_RECHAZADA",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            ipAddress,
            userAgent,
            metadatos: { observaciones: observaciones || null },
        });

        return NextResponse.json({
            reporteId,
            estado: reporte.estado,
            validado: false,
        });
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

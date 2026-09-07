import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditAnonimizacion } from "@/lib/audit";
import { generarEmbedding } from "@/lib/ai/embedder";
import { MODELO_EMBEDDING_DEFAULT } from "@/lib/ai/defaults";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { z } from "zod";
import { idSchema } from "@/lib/validators";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { resellarCampo } from "@/lib/reporte-texto-contenido";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";

const anonimizarSchema = z.object({
    textoAnonimizado: z.string().min(20).max(5000),
});

function requireAdmin(user: { rol: string }) {
    if (String(user.rol) !== "ADMIN") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas anonimizaciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const parsed = anonimizarSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { textoAnonimizado } = parsed.data;

        // E-8: la lectura vive en el repo; la ruta no toca prisma.
        const reporte = await new ReporteRepository().findByIdConClasificacionYEmbedding(reporteId);
        if (!reporte) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede anonimizar un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (reporte.estado !== "REQUIERE_ANONIMIZACION") {
            return NextResponse.json(
                { error: { message: "El reporte no requiere anonimización", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const piiEliminada = reporte.clasificacion?.piiDetectada || [];

        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";

        // S-C (D-116/D-117): el original (evidencia) YA está sellado write-once en ContenidoReporte
        // desde el alta (`sellarTextoNuevo` fija el original cifrado). La anonimización SOLO re-sella
        // el texto de TRABAJO con la versión anonimizada; el original NUNCA se re-escribe (política CEO).
        // Transacción: registrar transición, re-sellar el trabajo y avanzar el estado.
        await withUnitOfWork(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior: "REQUIERE_ANONIMIZACION",
                estadoNuevo: "CLASIFICADO",
                responsableTipo,
                responsableId: user.id,
                motivo: "Texto anonimizado por admin",
                tx,
            });
            await resellarCampo(tx, reporte.contenidoId, "texto", textoAnonimizado);
            await new ReporteRepository(tx).actualizarEstado(reporteId, {
                estado: "CLASIFICADO",
            });
        });

        // Regenerar embedding sobre texto anonimizado (best-effort)
        try {
            // E-8 (D3): parámetro por el repo; upsert del embedding en el adaptador.
            const paramEmbedding = await new ParametroRepository().findByClave("reportes.embedding_model");
            const modeloEmbedding = paramEmbedding?.valor || MODELO_EMBEDDING_DEFAULT;
            const vector = await generarEmbedding(modeloEmbedding, textoAnonimizado);

            await new EmbeddingRepository().upsertReporteEmbedding(reporteId, modeloEmbedding, vector);
        } catch (embedErr) {
            const msg = embedErr instanceof Error ? embedErr.message : String(embedErr);
            logger.error("[ANONIMIZAR] Embedding falló (no crítico):", msg);
            // No fallamos la anonimización; el embedding se puede regenerar después
        }

        // Actualizar visibilidad pública del identificador tras clasificar
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);

        // Registrar auditoría (solo metadata, nunca texto)
        await auditAnonimizacion({
            request,
            usuarioId: user.id,
            reporteId,
            estadoAnterior: "REQUIERE_ANONIMIZACION",
            estadoNuevo: "CLASIFICADO",
        });

        return NextResponse.json({
            reporteId,
            estadoAnterior: "REQUIERE_ANONIMIZACION",
            estadoNuevo: "CLASIFICADO",
            textoAnonimizado,
            piiEliminada,
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
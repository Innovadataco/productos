import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditCorreccion, logAudit } from "@/lib/audit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { esAdminRol, puedeGestionarReporte } from "@/lib/operadores/permisos";
import { anonimizarTexto } from "@/lib/ai/anonimizador";
import { generarEmbedding } from "@/lib/ai/embedder";
import { MODELO_ANONIMIZACION_DEFAULT, MODELO_EMBEDDING_DEFAULT } from "@/lib/ai/defaults";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { publishDatasetAnonimizacionBackfill, publishDatasetEmbeddingBackfill } from "@/lib/queue";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { CorreccionAdminRepository } from "@/lib/dal/repositories/correccion-admin";
import { ClasificacionIARepository } from "@/lib/dal/repositories/clasificacion-ia";
import { DatasetEntrenamientoRepository } from "@/lib/dal/repositories/dataset-entrenamiento";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";
import { detectarYRegistrarMatch } from "@/lib/dal/services/evento-match";
import { agregarPatronPorReporte } from "@/lib/colegio/patrones";
import { z } from "zod";

type CategoriaConducta =
    | "CONTACTO_INSISTENTE"
    | "SOLICITUD_MATERIAL"
    | "OFRECIMIENTO_REGALOS"
    | "SUPLANTACION_IDENTIDAD"
    | "SOLICITUD_ENCUENTRO"
    | "COMPARTIMIENTO_SEXUAL"
    | "EXTORSION"
    | "CONTENIDO_GENERADO_IA"
    | "DIFUSION_NO_CONSENTIDA"
    | "DOXING"
    | "OTRO";

const correccionSchema = z.object({
    reporteId: z.string().min(1),
    categoriaCorregida: z.enum([
        "CONTACTO_INSISTENTE",
        "SOLICITUD_MATERIAL",
        "OFRECIMIENTO_REGALOS",
        "SUPLANTACION_IDENTIDAD",
        "SOLICITUD_ENCUENTRO",
        "COMPARTIMIENTO_SEXUAL",
        "EXTORSION",
        "CONTENIDO_GENERADO_IA",
        "DIFUSION_NO_CONSENTIDA",
        "DOXING",
        "OTRO",
    ]),
    comentario: z.string().max(2000).optional(),
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

export async function POST(request: Request) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "bandeja_reportes");
        requireOperadorOAdmin(user);

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas correcciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate.headers }
            );
        }

        const body = await request.json();
        const parsed = correccionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            );
        }

        const { reporteId, categoriaCorregida, comentario } = parsed.data;

        // E-8: las consultas viven en los repos del DAL; la ruta no toca prisma.
        const reporteRow = await new ReporteRepository().findByIdConClasificacion(reporteId);
        if (!reporteRow) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        // SPEC-130 (BL-4): el texto va cifrado en reposo; el plano solo en memoria (O-3).
        const reporte = { ...reporteRow, texto: descifrarTextoReporte(reporteRow.texto) };

        if (!puedeGestionarReporte(user, reporte)) {
            return NextResponse.json(
                { error: { message: "No tienes permiso para gestionar este caso", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "No se puede corregir un reporte dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // Invariante de BD: solo se corrige un reporte CON clasificación (la crea el
        // motor en el procesamiento). Sin ella no hay nada que corregir (409 canónico,
        // nunca un TypeError por acceso a null).
        const clasificacion = reporte.clasificacion;
        if (!clasificacion) {
            return NextResponse.json(
                { error: { message: "El reporte no tiene clasificación que corregir", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        const categoriaAnterior = clasificacion.categoria;

        const correccionExistente = await new CorreccionAdminRepository().findByClasificacionId(clasificacion.id);
        if (correccionExistente) {
            return NextResponse.json(
                { error: { message: "Este reporte ya fue confirmado o corregido", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        // Guardar corrección usando Prisma ORM
        const correccion = await new CorreccionAdminRepository().crear({
            clasificacionId: clasificacion.id,
            categoriaOriginal: categoriaAnterior,
            categoriaCorregida: categoriaCorregida,
            adminId: user.id,
            motivo: comentario || null,
        });

        // Actualizar clasificación con la corrección
        if (reporte.clasificacion) {
            await new ClasificacionIARepository().actualizarPorReporteId(reporteId, {
                categoria: categoriaCorregida,
                confianza: 1.0,
            });
        }

        // Actualizar estado del reporte y registrar transición atómicamente
        const estadoAnterior = reporte.estado;
        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";
        await withUnitOfWork(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior,
                estadoNuevo: "CORREGIDO",
                responsableTipo,
                responsableId: user.id,
                motivo: comentario || "Caso corregido por operador/admin",
                tx,
            });
            await new ReporteRepository(tx).actualizarEstado(reporteId, { estado: "CORREGIDO" });
        });

        // SPEC-131 (O-2): la corrección puede mover la categoría hacia/desde SPAM/OTRO
        // y cambiar la aprobación — el escritor único recalcula contadores y visibilidad.
        await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);

        // SPEC-139/142 (ZEUS D-1): el paso a APROBADO por corrección humana dispara
        // el match y la agregación de patrones. Await + catch: fail-open (un error
        // aquí NUNCA rompe la corrección ya persistida).
        await detectarYRegistrarMatch(reporteId).catch((err) => {
            logger.error(`[CORRECCIONES] Error registrando match reporte=${reporteId}:`, err);
        });
        await agregarPatronPorReporte(reporteId).catch((err) => {
            logger.error(`[CORRECCIONES] Error agregando patrón institucional reporte=${reporteId}:`, err);
        });

        // Registrar auditoría (solo metadata, nunca texto)
        await auditCorreccion({
            request,
            usuarioId: user.id,
            reporteId,
            categoriaOriginal: categoriaAnterior as import("@prisma/client").CategoriaConducta,
            categoriaCorregida: categoriaCorregida as import("@prisma/client").CategoriaConducta,
        });

        const { ipAddress, userAgent } = getClientInfo(request);
        await logAudit({
            accion: "CASO_CORREGIDO",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: user.id,
            valorAnterior: JSON.stringify({ estado: reporte.estado, categoria: categoriaAnterior }),
            valorNuevo: JSON.stringify({ estado: "CORREGIDO", categoria: categoriaCorregida }),
            ipAddress,
            userAgent,
        });

        // Preparar texto seguro para el dataset de entrenamiento.
        // Si el reporte ya fue anonimizado previamente, su campo `texto` es seguro.
        // Si no, y la clasificación indica PII, forzamos anonimización antes de guardar.
        let textoDataset = reporte.texto;
        let datasetAnonimizado = false;
        let requiereBackfill = false;
        try {
            if (reporte.textoOriginal !== null) {
                // El texto ya fue anonimizado en el flujo de procesamiento.
                textoDataset = reporte.texto;
                datasetAnonimizado = true;
            } else if (reporte.clasificacion?.contienePii) {
                const paramModelo = await new ParametroRepository().findByClave("reportes.classification_model");
                const modelo = paramModelo?.valor || process.env.IA_MODEL_ANONIMIZACION || MODELO_ANONIMIZACION_DEFAULT;
                const resultado = await anonimizarTexto(modelo, reporte.texto);
                textoDataset = resultado.textoAnonimizado;
                datasetAnonimizado = true;
            }
        } catch (err) {
            logger.error("[CORRECCION] Fallo anonimización para dataset, guardando texto sin anonimizar y encolando backfill:", err);
            textoDataset = reporte.texto;
            datasetAnonimizado = false;
            requiereBackfill = true;
        }

        // Guardar en dataset de entrenamiento
        const datasetRegistro = await new DatasetEntrenamientoRepository().crear({
            texto: textoDataset,
            clasificacionCorrecta: categoriaCorregida,
            fuente: "correccion_admin",
            correccionId: correccion.id,
            textoAnonimizado: datasetAnonimizado,
        });

        if (requiereBackfill) {
            try {
                await publishDatasetAnonimizacionBackfill(datasetRegistro.id);
            } catch (queueErr) {
                logger.error("[CORRECCION] No se pudo encolar backfill de anonimización:", queueErr);
            }
        }

        // Generar embedding para RAG (F5). Si falla, no bloquear la corrección.
        try {
            const paramEmbedding = await new ParametroRepository().findByClave("reportes.embedding_model");
            const modeloEmbedding = paramEmbedding?.valor || MODELO_EMBEDDING_DEFAULT;
            const vector = await generarEmbedding(modeloEmbedding, datasetRegistro.texto);
            // E-8 (D3): la raw de inserción vive en el adaptador EmbeddingRepository.
            await new EmbeddingRepository().insertDatasetEmbedding(datasetRegistro.id, modeloEmbedding, vector);
        } catch (embedErr) {
            logger.error("[CORRECCION] Fallo embedding para dataset, encolando backfill:", embedErr);
            try {
                await publishDatasetEmbeddingBackfill(datasetRegistro.id);
            } catch (queueErr) {
                logger.error("[CORRECCION] No se pudo encolar backfill de embedding:", queueErr);
            }
        }

        return NextResponse.json({
            reporteId,
            categoriaAnterior,
            categoriaCorregida,
            estado: "CORREGIDO",
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
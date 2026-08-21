import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { verifyAuth } from "@/lib/auth";
import { assertModulo } from "@/lib/permisos-modulos";
import { checkRateLimit } from "@/lib/rate-limit";
import { idSchema } from "@/lib/validators";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { darDeBajaReporte } from "@/lib/dal/services/reporte-lifecycle";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { registrarTransicion, responsableTipoFromRol } from "@/lib/reporte-transiciones";
import { esAdminRol, esOperadorRol } from "@/lib/operadores/permisos";
import { generarEmbedding } from "@/lib/ai/embedder";
import { MODELO_EMBEDDING_DEFAULT } from "@/lib/ai/defaults";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { CorreccionAdminRepository } from "@/lib/dal/repositories/correccion-admin";
import { DatasetEntrenamientoRepository } from "@/lib/dal/repositories/dataset-entrenamiento";
import { ParametroRepository } from "@/lib/dal/repositories/parametro";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";
import { notificarSpamConfirmado } from "@/lib/email/notificacion-spam";
import { logAudit } from "@/lib/audit";
import type { CategoriaConducta, Prisma } from "@prisma/client";

const resolverSpamSchema = z.object({
    decision: z.enum(["es_spam", "corregir", "procesar_como_acoso"]),
    categoria: z.string().optional(),
    motivo: z.string().max(2000).optional(),
    notificarDenunciante: z.boolean().optional(),
});

const CATEGORIAS_VALIDAS: CategoriaConducta[] = [
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
];

async function embeddingModelo(tx?: Prisma.TransactionClient): Promise<string> {
    const paramEmbedding = await new ParametroRepository(tx).findByClave("reportes.embedding_model");
    return paramEmbedding?.valor || MODELO_EMBEDDING_DEFAULT;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await verifyAuth();
        await assertModulo(user, "revision_spam");
        if (!esAdminRol(user.rol) && !esOperadorRol(user.rol)) {
            return NextResponse.json(
                { error: { message: "Solo el operador asignado o un admin puede resolver", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const rate = await checkRateLimit(request, "admin_write", { identifier: user.id });
        if (!rate.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas resoluciones. Espere un momento.", code: ERROR_CODES.RATE_LIMITED } },
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
        const id = parsedId.data;

        const body = await request.json();
        const parsedBody = resolverSpamSchema.safeParse(body);
        if (!parsedBody.success) {
            return NextResponse.json(
                { error: { message: "Datos inválidos", code: ERROR_CODES.VALIDATION_ERROR, details: parsedBody.error.format() } },
                { status: 400 }
            );
        }
        const { decision, categoria, motivo, notificarDenunciante } = parsedBody.data;

        const reporteRow = await new ReporteRepository().findByIdConClasificacion(id);
        if (!reporteRow) {
            return NextResponse.json(
                { error: { message: "Reporte no encontrado", code: ERROR_CODES.NOT_FOUND } },
                { status: 404 }
            );
        }
        const reporte = { ...reporteRow, texto: descifrarTextoReporte(reporteRow.texto) };

        const estadoValido =
            reporte.estado === "POSIBLE_SPAM" ||
            (reporte.estado === "REVISION_MANUAL" && reporte.clasificacion?.categoria === "SPAM");
        if (!estadoValido) {
            return NextResponse.json(
                { error: { message: "El reporte no está en revisión de spam", code: "INVALID_STATE" } },
                { status: 400 }
            );
        }

        if (reporte.eliminado) {
            return NextResponse.json(
                { error: { message: "El reporte ya fue dado de baja", code: ERROR_CODES.CONFLICT } },
                { status: 409 }
            );
        }

        if (user.rol === "OPERADOR" && reporte.operadorId !== user.id) {
            return NextResponse.json(
                { error: { message: "Solo el operador asignado o un admin puede resolver", code: ERROR_CODES.FORBIDDEN } },
                { status: 403 }
            );
        }

        const responsableTipo = responsableTipoFromRol(user.rol) ?? "ADMIN";
        const nota = motivo || undefined;

        if (decision === "es_spam") {
            await withUnitOfWork(async (tx) => {
                await darDeBajaReporte({
                    reporteId: id,
                    motivo: "RETIRO_LIMPIEZA",
                    nota: nota || "Confirmado como spam por operador",
                    adminId: user.id,
                    tx,
                    accionAudit: "CASO_DADO_DE_BAJA",
                });

                const dataset = await new DatasetEntrenamientoRepository(tx).crear({
                    texto: reporte.texto,
                    clasificacionCorrecta: "SPAM",
                    fuente: "spam_revisado",
                    textoAnonimizado: true,
                });

                try {
                    const modeloEmbedding = await embeddingModelo(tx);
                    const vector = await generarEmbedding(modeloEmbedding, reporte.texto);
                    await new EmbeddingRepository(tx).insertDatasetEmbedding(dataset.id, modeloEmbedding, vector);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger.warn(`[SPAM] No se pudo generar embedding para ejemplo spam: ${msg}`);
                }

                await logAudit({
                    accion: "SPAM_CONFIRMADO",
                    tipoRecurso: "Reporte",
                    recursoId: id,
                    usuarioId: user.id,
                    valorAnterior: JSON.stringify({ estado: reporte.estado }),
                    valorNuevo: JSON.stringify({ estado: reporte.estado, eliminado: true, motivoBaja: "RETIRO_LIMPIEZA" }),
                    metadatos: { decision: "es_spam", motivo: nota },
                    tx,
                });
            });

            if (notificarDenunciante !== false) {
                await notificarSpamConfirmado({
                    id: reporte.id,
                    usuarioId: reporte.usuarioId,
                    identificador: reporte.identificador,
                });
            }

            return NextResponse.json({
                reporteId: id,
                eliminado: true,
                motivoBaja: "RETIRO_LIMPIEZA",
            });
        }

        if (decision === "corregir") {
            const categoriaFinal = categoria ?? "OTRO";
            if (!CATEGORIAS_VALIDAS.includes(categoriaFinal as CategoriaConducta)) {
                return NextResponse.json(
                    { error: { message: "Categoría inválida", code: ERROR_CODES.VALIDATION_ERROR } },
                    { status: 400 }
                );
            }

            await withUnitOfWork(async (tx) => {
                if (reporte.clasificacion) {
                    await new CorreccionAdminRepository(tx).crear({
                        clasificacionId: reporte.clasificacion.id,
                        categoriaOriginal: "SPAM",
                        categoriaCorregida: categoriaFinal as CategoriaConducta,
                        adminId: user.id,
                        motivo: nota || "Reporte válido revisado como spam",
                        confirmada: true,
                    });
                }

                await registrarTransicion({
                    reporteId: id,
                    estadoAnterior: reporte.estado,
                    estadoNuevo: "CLASIFICADO",
                    responsableTipo,
                    responsableId: user.id,
                    motivo: `Reporte corregido a ${categoriaFinal} tras revisión de spam`,
                    tx,
                });

                await new ReporteRepository(tx).actualizarEstado(id, { estado: "CLASIFICADO" });

                const dataset = await new DatasetEntrenamientoRepository(tx).crear({
                    texto: reporte.texto,
                    clasificacionCorrecta: categoriaFinal as CategoriaConducta,
                    fuente: "spam_corregido",
                    textoAnonimizado: true,
                });

                try {
                    const modeloEmbedding = await embeddingModelo(tx);
                    const vector = await generarEmbedding(modeloEmbedding, reporte.texto);
                    await new EmbeddingRepository(tx).insertDatasetEmbedding(dataset.id, modeloEmbedding, vector);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    logger.warn(`[SPAM] No se pudo generar embedding para corrección spam: ${msg}`);
                }

                await logAudit({
                    accion: "SPAM_CORREGIDO",
                    tipoRecurso: "Reporte",
                    recursoId: id,
                    usuarioId: user.id,
                    valorAnterior: JSON.stringify({ estado: reporte.estado, categoria: "SPAM" }),
                    valorNuevo: JSON.stringify({ estado: "CLASIFICADO", categoria: categoriaFinal }),
                    metadatos: { decision: "corregir", motivo: nota },
                    tx,
                });
            });

            return NextResponse.json({
                reporteId: id,
                estado: "CLASIFICADO",
                categoria: categoriaFinal,
            });
        }

        // decision === "procesar_como_acoso"
        const categoriaOriginal = reporte.clasificacion?.categoria ?? "SPAM";
        await withUnitOfWork(async (tx) => {
            await registrarTransicion({
                reporteId: id,
                estadoAnterior: reporte.estado,
                estadoNuevo: "CLASIFICADO",
                responsableTipo,
                responsableId: user.id,
                motivo: `Reporte confirmado como acoso (${categoriaOriginal}) tras revisión de spam`,
                tx,
            });

            await new ReporteRepository(tx).actualizarEstado(id, { estado: "CLASIFICADO" });

            await logAudit({
                accion: "SPAM_PROCESADO_COMO_ACOSO",
                tipoRecurso: "Reporte",
                recursoId: id,
                usuarioId: user.id,
                valorAnterior: JSON.stringify({ estado: reporte.estado }),
                valorNuevo: JSON.stringify({ estado: "CLASIFICADO", categoria: categoriaOriginal }),
                metadatos: { decision: "procesar_como_acoso", motivo: nota },
                tx,
            });
        });

        return NextResponse.json({
            reporteId: id,
            estado: "CLASIFICADO",
            categoria: categoriaOriginal,
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

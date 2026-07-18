import { prisma } from "./prisma";
import { getParametroSistema } from "./parametros";
import { generarEmbedding } from "./ai/embedder";
import { recalcularYGuardarScore } from "./scoring";
import { actualizarVisibilidadPublica } from "./visibility";
import { logAudit } from "./audit";
import { registrarTransicion, responsableTipoFromRol } from "./reporte-transiciones";
import type { MotivoBajaReporte, Prisma } from "@prisma/client";

const MOTIVOS_PURGAN_DATASET: MotivoBajaReporte[] = ["REPORTE_FALSO", "ORDEN_LEGAL"];

async function getEmbeddingModel(): Promise<string> {
    const param = await getParametroSistema("reportes.embedding_model");
    return param?.valor || "nomic-embed-text";
}

export interface ReporteBajaResult {
    reporteId: string;
    estadoAnterior: string;
    eliminado: true;
    datasetPurged: boolean;
}

export interface ReporteReactivacionResult {
    reporteId: string;
    reactivado: true;
    embeddingRegenerado: boolean;
}

function extractClientInfo(request?: Request): { ipAddress: string; userAgent: string } {
    return {
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    };
}

async function findReporteConDatos(reporteId: string, tx: Prisma.TransactionClient) {
    return tx.reporte.findUnique({
        where: { id: reporteId },
        include: {
            clasificacion: {
                include: {
                    correccion: {
                        include: { datasetRegistros: { include: { embedding: true } } },
                    },
                },
            },
            embedding: true,
        },
    });
}

export async function darDeBajaReporte(params: {
    reporteId: string;
    motivo: MotivoBajaReporte;
    nota: string;
    adminId: string;
    request?: Request;
    tx?: Prisma.TransactionClient;
    accionAudit?: "REPORT_DEACTIVATE" | "CASO_DADO_DE_BAJA";
}): Promise<ReporteBajaResult> {
    const { reporteId, motivo, nota, adminId, request, tx: externalTx, accionAudit = "REPORT_DEACTIVATE" } = params;
    const { ipAddress, userAgent } = extractClientInfo(request);

    const work = async (tx: Prisma.TransactionClient) => {
        const reporte = await findReporteConDatos(reporteId, tx);
        if (!reporte) {
            throw new Error("REPORTE_NO_ENCONTRADO");
        }
        if (reporte.eliminado) {
            throw new Error("REPORTE_YA_ELIMINADO");
        }

        const estadoAnterior = reporte.estado;
        const correccion = reporte.clasificacion?.correccion;
        const datasetRegistros = correccion?.datasetRegistros ?? [];
        const debePurgarDataset = MOTIVOS_PURGAN_DATASET.includes(motivo);

        // 1. Marcar reporte como eliminado.
        await tx.reporte.update({
            where: { id: reporteId },
            data: {
                eliminado: true,
                motivoBaja: motivo,
                notaBaja: nota,
                eliminadoEn: new Date(),
                eliminadoPorId: adminId,
            },
        });

        // Registrar baja en expediente (no cambia de estado, se documenta el cambio de flag eliminado).
        const admin = await tx.usuario.findUnique({ where: { id: adminId }, select: { rol: true } });
        const responsableTipo = responsableTipoFromRol(admin?.rol ?? "") ?? "ADMIN";
        await registrarTransicion({
            reporteId,
            estadoAnterior,
            estadoNuevo: estadoAnterior,
            responsableTipo,
            responsableId: adminId,
            motivo: `Reporte dado de baja: ${motivo}${nota ? ` - ${nota}` : ""}`,
            tx,
        });

        // 2. Borrar EmbeddingReporte.
        if (reporte.embedding) {
            await tx.embeddingReporte.delete({ where: { reporteId } });
        }

        // 3. Purga condicional de dataset RAG.
        if (debePurgarDataset) {
            for (const registro of datasetRegistros) {
                if (registro.embedding) {
                    await tx.embeddingDataset.delete({ where: { datasetId: registro.id } });
                }
                await tx.datasetEntrenamiento.delete({ where: { id: registro.id } });
            }
        }

        // 4. Recalcular score + visibilidad (dentro de la transacción).
        const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId, tx);
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId, tx);

        // 5. AuditLog atómico.
        await logAudit({
            accion: accionAudit,
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ estado: estadoAnterior, eliminado: false }),
            valorNuevo: JSON.stringify({ estado: estadoAnterior, eliminado: true, motivo, nota }),
            ipAddress,
            userAgent,
            tx,
        });

        return {
            reporteId,
            estadoAnterior,
            eliminado: true as const,
            datasetPurged: debePurgarDataset && datasetRegistros.length > 0,
            scoreResult,
        };
    };

    const result = externalTx ? await work(externalTx) : await prisma.$transaction(work);

    return {
        reporteId: result.reporteId,
        estadoAnterior: result.estadoAnterior,
        eliminado: result.eliminado,
        datasetPurged: result.datasetPurged,
    };
}

export async function reactivarReporte(params: {
    reporteId: string;
    nota: string;
    adminId: string;
    request?: Request;
}): Promise<ReporteReactivacionResult> {
    const { reporteId, nota, adminId, request } = params;
    const { ipAddress, userAgent } = extractClientInfo(request);

    // Validaciones y generación de embedding fuera de la transacción.
    const reporte = await prisma.reporte.findUnique({
        where: { id: reporteId },
        include: { embedding: true },
    });
    if (!reporte) {
        throw new Error("REPORTE_NO_ENCONTRADO");
    }
    if (!reporte.eliminado) {
        throw new Error("REPORTE_NO_ELIMINADO");
    }
    if (reporte.embedding) {
        throw new Error("EMBEDDING_INCONSISTENTE");
    }

    const modeloEmbedding = await getEmbeddingModel();
    const vector = await generarEmbedding(modeloEmbedding, reporte.texto);
    const vectorStr = "[" + vector.join(",") + "]";
    const embeddingId = crypto.randomUUID();

    await prisma.$transaction(async (tx) => {
        // Recargar para verificar que sigue eliminado dentro de la transacción.
        const actual = await tx.reporte.findUnique({ where: { id: reporteId } });
        if (!actual || !actual.eliminado) {
            throw new Error("REPORTE_NO_ELIMINADO");
        }

        // 1. Desmarcar eliminado.
        await tx.reporte.update({
            where: { id: reporteId },
            data: {
                eliminado: false,
                motivoBaja: null,
                notaBaja: null,
                eliminadoEn: null,
                eliminadoPorId: null,
            },
        });

        // 2. Insertar embedding regenerado.
        await tx.$executeRaw`
            INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
            VALUES (${embeddingId}, ${reporteId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
        `;

        // 3. Recalcular score + visibilidad.
        await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId, tx);
        await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId, tx);

        // 4. AuditLog.
        await logAudit({
            accion: "REPORT_REACTIVATE",
            tipoRecurso: "Reporte",
            recursoId: reporteId,
            usuarioId: adminId,
            valorAnterior: JSON.stringify({ eliminado: true }),
            valorNuevo: JSON.stringify({ eliminado: false, nota, embeddingRegenerado: true }),
            ipAddress,
            userAgent,
            tx,
        });
    });

    return {
        reporteId,
        reactivado: true,
        embeddingRegenerado: true,
    };
}

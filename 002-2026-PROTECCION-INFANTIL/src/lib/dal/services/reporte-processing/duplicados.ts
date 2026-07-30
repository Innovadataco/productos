import { prisma } from "@/lib/prisma";
import { buscarReporteSimilar, buscarSimilitudMaxima } from "@/lib/ai/similarity";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { registrarPaso } from "@/lib/expediente/pasos";
import { NextResponse } from "next/server";

export async function detectarDuplicado({
    reporteId,
    identificador,
    plataformaId,
    vector,
    esAnonimo,
}: {
    reporteId: string;
    identificador: string;
    plataformaId: string;
    vector: number[];
    esAnonimo: boolean;
}): Promise<{ esDuplicado: false } | { esDuplicado: true; response: NextResponse }> {
    if (!esAnonimo) {
        await registrarPaso(reporteId, "deduplicacion", {
            veredicto: "no_aplica",
            detalle: { motivo: "reporte no anónimo" },
        });
        return { esDuplicado: false };
    }

    const paramThreshold = await prisma.parametroSistema.findUnique({
        where: { clave: "reportes.duplicate.similarity_threshold" },
    });
    const threshold = parseFloat(paramThreshold?.valor || "0.92");
    const similar = await buscarReporteSimilar(reporteId, identificador, plataformaId, vector, threshold);

    if (similar) {
        await prisma.$transaction(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior: "PROCESANDO",
                estadoNuevo: "DUPLICADO",
                responsableTipo: "SISTEMA",
                motivo: "Reporte marcado como duplicado por similitud de embeddings",
                metadatos: { reporteOrigenId: similar.reporteId },
                tx,
            });
            await tx.reporte.update({
                where: { id: reporteId },
                data: { estado: "DUPLICADO", reporteOrigenId: similar.reporteId },
            });
        });
        await registrarPaso(reporteId, "deduplicacion", {
            veredicto: "duplicado",
            detalle: { reporteOrigenId: similar.reporteId, scoreSimilitud: similar.similarity, threshold },
        });
        return {
            esDuplicado: true,
            response: NextResponse.json({
                reporteId,
                estado: "DUPLICADO",
                clasificacion: null,
                latenciaMs: 0,
            }),
        };
    }

    const scoreMaximo = await buscarSimilitudMaxima(reporteId, identificador, plataformaId, vector);
    await registrarPaso(reporteId, "deduplicacion", {
        veredicto: "sin_duplicado",
        detalle: { scoreSimilitud: scoreMaximo, threshold },
    });
    return { esDuplicado: false };
}

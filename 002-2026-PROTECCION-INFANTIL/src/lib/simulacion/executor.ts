import { prisma } from "@/lib/prisma";
import { sendReporte } from "@/lib/queue";
import { generarNumeroSeguimiento } from "@/lib/reporte-utils";
import { encryptParameter } from "@/lib/param-encryption";
import { logger } from "@/lib/logger";
import type { CasoSimulacion } from "@/lib/schemas/simulacion";

const BATCH_SIZE = 5;

export function generarIdentificadorSimulacion(runIdShort: string, indice: number): string {
    return `SIM-${runIdShort}-${String(indice).padStart(3, "0")}`;
}

export function shortRunId(runId: string): string {
    return runId.slice(0, 6);
}

export async function crearReporteSimulacion(
    runId: string,
    indice: number,
    caso: CasoSimulacion,
    modeloClasificacion: string
): Promise<{ reporteId: string }> {
    const run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`SimulacionRun ${runId} no encontrado`);

    const plataforma = await prisma.plataforma.findUnique({ where: { clave: caso.plataforma } });
    if (!plataforma) throw new Error(`Plataforma ${caso.plataforma} no encontrada`);

    const identificador = generarIdentificadorSimulacion(shortRunId(runId), indice);
    const numeroSeguimiento = generarNumeroSeguimiento();
    const textoOriginalCifrado = encryptParameter(caso.texto);

    const result = await prisma.$transaction(async (tx) => {
        const reporte = await tx.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma.id,
                texto: caso.texto,
                textoOriginal: textoOriginalCifrado,
                fechaIncidente: new Date(caso.fechaIncidente),
                ciudad: caso.ciudad,
                pais: caso.pais,
                esAnonimo: true,
                edadVictima: caso.edadVictima,
                usuarioId: null,
                numeroSeguimiento,
                estado: "PENDIENTE",
                prioridadAlta: false,
                keywordsDetectadas: [],
            },
        });

        await tx.simulacionReporte.create({
            data: {
                simulacionRunId: runId,
                reporteId: reporte.id,
                indice,
                categoriaEsperada: caso.categoriaEsperada,
            },
        });

        return { reporteId: reporte.id };
    });

    await sendReporte(result.reporteId, { modeloClasificacion });
    return result;
}

export async function runSimulacionBatchCreator(runId: string, modeloClasificacion: string): Promise<void> {
    const run = await prisma.simulacionRun.findUnique({ where: { id: runId } });
    if (!run || run.estado === "CANCELADA") {
        logger.info(`[SIMULACION] Run ${runId} cancelado o no encontrado; no se crean reportes.`);
        return;
    }

    const casos = (run.casosJson ?? []) as CasoSimulacion[];
    if (!Array.isArray(casos) || casos.length === 0) {
        await prisma.simulacionRun.update({
            where: { id: runId },
            data: { estado: "FALLIDA", fechaFin: new Date() },
        });
        return;
    }

    await prisma.simulacionRun.update({
        where: { id: runId },
        data: { estado: "EN_PROGRESO" },
    });

    let creados = 0;
    let fallidos = 0;
    for (let i = 0; i < casos.length; i += BATCH_SIZE) {
        // Verificar cancelación entre batches
        const runActual = await prisma.simulacionRun.findUnique({ where: { id: runId }, select: { estado: true } });
        if (runActual?.estado === "CANCELADA") {
            logger.info(`[SIMULACION] Run ${runId} cancelado durante creación de reportes.`);
            return;
        }

        const batch = casos.slice(i, i + BATCH_SIZE);
        for (let j = 0; j < batch.length; j++) {
            const indice = i + j + 1;
            const caso = batch[j];
            try {
                await crearReporteSimulacion(runId, indice, caso, modeloClasificacion);
                creados++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`[SIMULACION] Error creando reporte para run ${runId} índice ${indice}: ${msg}`);
                fallidos++;
            }
        }
        // Permitir que el worker procese otros jobs mientras crea reportes
        await new Promise((resolve) => setImmediate(resolve));
    }

    const estadoFinal = creados > 0 ? "COMPLETADA" : "FALLIDA";
    const metricasActuales = (run.metricasJson ?? {}) as Record<string, unknown>;
    await prisma.simulacionRun.update({
        where: { id: runId },
        data: {
            estado: estadoFinal,
            fechaFin: new Date(),
            metricasJson: { ...metricasActuales, casosFallidos: fallidos },
        },
    });

    logger.info(`[SIMULACION] Run ${runId}: ${creados}/${casos.length} reportes creados y encolados; ${fallidos} fallidos.`);
}

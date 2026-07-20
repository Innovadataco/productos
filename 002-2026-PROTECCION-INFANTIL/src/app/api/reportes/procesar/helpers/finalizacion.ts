import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { registrarTransicion } from "@/lib/reporte-transiciones";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import { recalcularYGuardarScore } from "@/lib/scoring";
import { enviarAlertaRevision, enviarAlertaScoreCritico, enviarAlertasSuscriptores } from "@/lib/email";
import { asignarOperadorAReporte } from "@/lib/operadores/asignador";
import { ESTADOS_FINALES } from "./errors";
import { ERROR_CODES } from "@/lib/errors";
import type { EstadoReporte } from "@prisma/client";
import type { ClasificacionResult } from "./clasificacion";

export async function finalizarReporte({
    reporteId,
    estadoFinal,
    clasificacion,
    esRafaga,
    prioridadAlta,
    keywordsDetectadas,
}: {
    reporteId: string;
    estadoFinal: EstadoReporte;
    clasificacion: ClasificacionResult;
    esRafaga: boolean;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
}): Promise<EstadoReporte> {
    const estadoFinalTx = await prisma.$transaction(async (tx) => {
        const reporteActual = await tx.reporte.findUnique({
            where: { id: reporteId },
            select: { estado: true },
        });
        if (!reporteActual) {
            throw new Error("Reporte no encontrado durante transición final");
        }
        if (ESTADOS_FINALES.has(reporteActual.estado)) {
            // Idempotencia: otro proceso ya finalizó el reporte.
            return reporteActual.estado;
        }
        await registrarTransicion({
            reporteId,
            estadoAnterior: reporteActual.estado,
            estadoNuevo: estadoFinal,
            responsableTipo: "IA",
            motivo: estadoFinal === "REVISION_MANUAL" ? "Requiere revisión humana" : "Clasificación automática completada",
            metadatos: {
                modelo: clasificacion.metrics.modelo,
                latenciaMs: clasificacion.metrics.latenciaMs,
                categoria: clasificacion.categoria,
                confianza: clasificacion.confianza,
                esRafaga,
                prioridadAlta,
            },
            tx,
        });
        await tx.reporte.update({
            where: { id: reporteId },
            data: {
                estado: estadoFinal,
                prioridadAlta,
                keywordsDetectadas,
                esRafaga,
            },
        });
        return estadoFinal;
    });

    // Fase 3: asignación automática de operador para revisión manual o posible spam
    if (estadoFinalTx === "REVISION_MANUAL" || estadoFinalTx === "POSIBLE_SPAM") {
        asignarOperadorAReporte(reporteId).catch((err) =>
            console.error("[OPERADORES] Error asignando operador a reporte", { reporteId, error: err })
        );
    }

    // Actualizar IdentificadorReportado (solo si está clasificado o corregido)
    if (estadoFinalTx === "CLASIFICADO" || estadoFinalTx === "CORREGIDO") {
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: { identificador: true, plataformaId: true },
        });
        if (reporte) {
            await actualizarVisibilidadPublica(reporte.identificador, reporte.plataformaId);
            const scoreResult = await recalcularYGuardarScore(reporte.identificador, reporte.plataformaId);

            if (scoreResult.nivelRiesgo === "CRITICO") {
                enviarAlertaScoreCritico({
                    id: reporteId,
                    identificador: reporte.identificador,
                    plataformaId: reporte.plataformaId,
                    score: scoreResult.score,
                    nivelRiesgo: scoreResult.nivelRiesgo,
                }).catch((err) => console.error("[ALERTA] Error enviando alerta de score crítico", err));
            }

            enviarAlertasSuscriptores({
                identificador: reporte.identificador,
                plataformaId: reporte.plataformaId,
                totalReportes: scoreResult.totalReportes,
            }).catch((err) => console.error("[ALERTA] Error enviando alertas a suscriptores", err));
        }
    }

    // Alertar a administradores cuando el reporte requiere intervención humana
    if (estadoFinalTx === "REVISION_MANUAL" || estadoFinalTx === "REQUIERE_ANONIMIZACION" || estadoFinalTx === "POSIBLE_SPAM") {
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: { numeroSeguimiento: true, identificador: true },
        });
        enviarAlertaRevision({
            id: reporteId,
            numeroSeguimiento: reporte?.numeroSeguimiento || null,
            identificador: reporte?.identificador || "",
            estado: estadoFinalTx,
            prioridadAlta,
        }).catch((err) => console.error("[ALERTA] Error enviando alerta de revisión", err));
    }

    return estadoFinalTx;
}

export function respuestaExito({
    reporteId,
    estadoFinal,
    clasificacion,
}: {
    reporteId: string;
    estadoFinal: EstadoReporte;
    clasificacion: ClasificacionResult;
}) {
    return NextResponse.json({
        reporteId,
        estado: estadoFinal,
        clasificacion: {
            categoria: clasificacion.categoria,
            confianza: clasificacion.confianza,
            categoriasSecundarias: clasificacion.categoriasSecundarias,
            posibleAgresorPar: clasificacion.posibleAgresorPar,
            votos: clasificacion.votos,
        },
        latenciaMs: clasificacion.metrics.latenciaMs,
    });
}

export async function fallbackARevisionManual({
    reporteId,
    errorCode,
}: {
    reporteId: string;
    errorCode: string;
}): Promise<{ id: string; numeroSeguimiento: string | null; identificador: string } | null> {
    try {
        const reportePrevio = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: { estado: true },
        });
        const estadoPrevio = reportePrevio?.estado ?? "PENDIENTE";

        const reporteActualizado = await prisma.$transaction(async (tx) => {
            await registrarTransicion({
                reporteId,
                estadoAnterior: estadoPrevio,
                estadoNuevo: "REVISION_MANUAL",
                responsableTipo: "SISTEMA",
                motivo: "Error durante el procesamiento del reporte",
                metadatos: { errorCode },
                tx,
            });
            return tx.reporte.update({
                where: { id: reporteId },
                data: {
                    estado: "REVISION_MANUAL",
                    processingError: `Error durante el procesamiento del reporte (código: ${errorCode})`,
                },
            });
        });

        asignarOperadorAReporte(reporteId).catch((err) =>
            console.error("[OPERADORES] Error asignando operador a reporte con error", { reporteId, error: err })
        );

        return {
            id: reporteActualizado.id,
            numeroSeguimiento: reporteActualizado.numeroSeguimiento,
            identificador: reporteActualizado.identificador,
        };
    } catch {
        return null;
    }
}

export async function enviarAlertaRevisionManual({
    reporteParaAlerta,
}: {
    reporteParaAlerta: { id: string; numeroSeguimiento: string | null; identificador: string };
}) {
    enviarAlertaRevision({
        id: reporteParaAlerta.id,
        numeroSeguimiento: reporteParaAlerta.numeroSeguimiento,
        identificador: reporteParaAlerta.identificador,
        estado: "REVISION_MANUAL",
    }).catch((err) => console.error("[ALERTA] Error enviando alerta de revisión", err));
}

export function obtenerErrorCode(error: unknown): string {
    return error && typeof error === "object" && "code" in error && typeof error.code === "string"
        ? error.code
        : ERROR_CODES.INTERNAL_ERROR;
}

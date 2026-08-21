import { createHash } from "crypto";
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { EmbeddingRepository } from "@/lib/dal/repositories/embedding";
import { getParametroSistema } from "@/lib/parametros";
import { enviarAlertaInfra } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import type { IncidenteInfra } from "@prisma/client";

export interface PatronCoordinadoResultCoordinado {
    coordinado: true;
    reportesRelacionadosIds: string[];
    count: number;
    similitudPromedio: number;
}

export interface PatronCoordinadoResultNoCoordinado {
    coordinado: false;
}

export type PatronCoordinadoResult = PatronCoordinadoResultCoordinado | PatronCoordinadoResultNoCoordinado;

export interface OpcionesPatronCoordinado {
    minReportes: number;
    ventanaMin: number;
    similitudUmbral: number;
    modeloEmbedding: string;
}

const VENTANA_CIERRE_MS = 60 * 60 * 1000;

function hashTexto(texto: string): string {
    return createHash("sha256").update(texto, "utf8").digest("hex");
}

/**
 * SPEC-195 (002-PI-089): detecta si un texto muy similar está siendo reportado
 * contra muchos identificadores distintos en una ventana corta de tiempo.
 *
 * Solo cuentan identificadores distintos: duplicados/ráfagas contra el mismo
 * identificador ya los cubre el anti-abuso vigente.
 */
export async function detectarPatronCoordinado(
    reporteId: string,
    embedding: number[],
    opciones: OpcionesPatronCoordinado
): Promise<PatronCoordinadoResult> {
    const ventana = new Date(Date.now() - opciones.ventanaMin * 60_000);

    const rows = await new EmbeddingRepository().buscarPatronCoordinadoCandidatos(embedding, {
        reporteId,
        modeloEmbedding: opciones.modeloEmbedding,
        umbral: opciones.similitudUmbral,
        ventana,
    });

    // Agrupar por identificador: solo un reporte por identificador cuenta.
    const porIdentificador = new Map<string, { id: string; similitud: number }>();
    for (const row of rows) {
        if (!porIdentificador.has(row.identificador)) {
            porIdentificador.set(row.identificador, { id: row.id, similitud: row.similitud });
        }
    }

    if (porIdentificador.size < opciones.minReportes) {
        return { coordinado: false };
    }

    const seleccionados = Array.from(porIdentificador.values());
    const reportesRelacionadosIds = seleccionados.map((s) => s.id);
    const similitudPromedio =
        seleccionados.reduce((acc, s) => acc + s.similitud, 0) / seleccionados.length;

    return {
        coordinado: true,
        reportesRelacionadosIds,
        count: seleccionados.length,
        similitudPromedio,
    };
}

/**
 * Registra o actualiza un IncidenteInfra para el patrón coordinado.
 * Si ya existe un incidente abierto para el mismo hash de texto y no tuvo
 * matches recientes, se cierra y se abre uno nuevo.
 */
export async function registrarPatronCoordinado(
    texto: string,
    patron: PatronCoordinadoResult
): Promise<void> {
    if (!patron.coordinado) return;

    const senal = `patron_coordinado:${hashTexto(texto)}`;
    const ahora = new Date();
    const repo = new MonitoreoRepository();

    const detalle = JSON.stringify({
        reportesRelacionadosIds: patron.reportesRelacionadosIds,
        count: patron.count,
        similitud_promedio: patron.similitudPromedio,
        primer_reporte_id: patron.reportesRelacionadosIds[0] ?? null,
    });

    const existente = await repo.incidenteAbiertoDe(senal);
    if (existente) {
        if (ahora.getTime() - existente.actualizadoEn.getTime() > VENTANA_CIERRE_MS) {
            await repo.resolverIncidente(existente.id, ahora);
            await logAudit({
                accion: "INFRA_INCIDENTE_RESUELTO",
                tipoRecurso: "IncidenteInfra",
                recursoId: existente.id,
                valorNuevo: senal,
                metadatos: { senal, cierreAutomatico: true, fin: ahora.toISOString() },
            });
        } else {
            await repo.actualizarDetalleIncidente(existente.id, detalle);
            await notificarPatronCoordinado(existente, repo);
            return;
        }
    }

    const incidente = await repo.crearIncidente(senal, detalle);
    await logAudit({
        accion: "INFRA_INCIDENTE_ABIERTO",
        tipoRecurso: "IncidenteInfra",
        recursoId: incidente.id,
        valorNuevo: senal,
        metadatos: { senal, detalle: incidente.detalle, inicio: incidente.inicio.toISOString() },
    });
    await notificarPatronCoordinado(incidente, repo);
}

async function notificarPatronCoordinado(incidente: IncidenteInfra, repo: MonitoreoRepository): Promise<void> {
    const [throttleParam, destinatariosParam] = await Promise.all([
        getParametroSistema("monitoreo.email.throttle_min"),
        getParametroSistema("monitoreo.email.destinatarios"),
    ]);

    const destinatarios = (destinatariosParam?.valor ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
    if (destinatarios.length === 0) return;

    const throttleNum = Number(throttleParam?.valor);
    const throttleMin = Number.isFinite(throttleNum) && throttleNum > 0 ? throttleNum : 30;
    if (incidente.ultimoEmailEn && Date.now() - incidente.ultimoEmailEn.getTime() < throttleMin * 60_000) {
        return;
    }

    try {
        await enviarAlertaInfra({
            senal: incidente.senal,
            inicio: incidente.inicio,
            detalle: incidente.detalle,
            destinatarios,
        });
        await repo.marcarEmailEnviado(incidente.id, new Date());
        await logAudit({
            accion: "INFRA_EMAIL_ENVIADO",
            tipoRecurso: "IncidenteInfra",
            recursoId: incidente.id,
            valorNuevo: incidente.senal,
            metadatos: { senal: incidente.senal, destinatarios: destinatarios.length },
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[PatronCoordinado] Error enviando alerta (senal=${incidente.senal}): ${msg}`);
    }
}

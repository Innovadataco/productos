/**
 * SPEC-171 (Pilar B, I-51) — Ciclo de vida de incidentes de infraestructura.
 *
 * Doble rojo: un primer fallo NO abre incidente — `evaluarSenal` devuelve
 * "pendiente-reprobe" y el caller reprograma un segundo probe
 * (`monitoreo.reprobe.segundos`); solo si ese también falla, `confirmarRojo`
 * abre el IncidenteInfra y avisa por email (con throttle por señal). El
 * incidente se resuelve solo cuando el probe vuelve a verde.
 *
 * Audit sin texto de reportes: solo señal, timestamps y detalle técnico.
 */
import { prisma } from "../prisma";
import { getParametroSistema } from "@/lib/parametros";
import { logAudit } from "@/lib/audit";
import { enviarAlertaInfra } from "@/lib/email";
import { logger } from "@/lib/logger";
import type { IncidenteInfra } from "@prisma/client";
import type { ResultadoProbe, SenalMonitoreo } from "./probes";

export type ResultadoEvaluacion = "verde" | "resuelto" | "pendiente-reprobe";

/** Sin fila en ParametroSistema el vigilante queda habilitado (el seed lo crea en true). */
async function monitoreoHabilitado(): Promise<boolean> {
    const param = await getParametroSistema("monitoreo.enabled");
    return param ? param.valor === "true" : true;
}

/** Persiste el resultado de un probe. No-op si el vigilante está apagado. */
export async function registrarProbe(senal: SenalMonitoreo, resultado: ResultadoProbe): Promise<void> {
    if (!(await monitoreoHabilitado())) return;
    await prisma.healthProbe.create({
        data: {
            senal,
            ok: resultado.ok,
            latenciaMs: resultado.latenciaMs,
            detalle: resultado.detalle ?? null,
        },
    });
}

/**
 * Evalúa el resultado ya persistido. Verde: si había un incidente ABIERTO de
 * la señal lo cierra (RESUELTO, fin=now) + audit. Rojo: NO abre nada; devuelve
 * "pendiente-reprobe" para que el caller confirme con un segundo probe.
 */
export async function evaluarSenal(senal: SenalMonitoreo, resultado: ResultadoProbe): Promise<ResultadoEvaluacion> {
    if (!(await monitoreoHabilitado())) return resultado.ok ? "verde" : "pendiente-reprobe";
    if (!resultado.ok) return "pendiente-reprobe";

    const abierto = await prisma.incidenteInfra.findFirst({
        where: { senal, estado: "ABIERTO" },
    });
    if (!abierto) return "verde";

    const fin = new Date();
    await prisma.incidenteInfra.update({
        where: { id: abierto.id },
        data: { estado: "RESUELTO", fin },
    });
    await logAudit({
        accion: "INFRA_INCIDENTE_RESUELTO",
        tipoRecurso: "IncidenteInfra",
        recursoId: abierto.id,
        valorNuevo: senal,
        metadatos: { senal, inicio: abierto.inicio.toISOString(), fin: fin.toISOString() },
    });
    return "resuelto";
}

/**
 * Segundo fallo consecutivo: abre el IncidenteInfra (nunca duplica uno ABIERTO
 * de la misma señal) + audit + notificación por email.
 */
export async function confirmarRojo(senal: SenalMonitoreo, detalle?: string): Promise<IncidenteInfra | null> {
    if (!(await monitoreoHabilitado())) return null;

    const existente = await prisma.incidenteInfra.findFirst({
        where: { senal, estado: "ABIERTO" },
    });
    if (existente) return existente;

    const incidente = await prisma.incidenteInfra.create({
        data: { senal, estado: "ABIERTO", detalle: detalle ?? null },
    });
    await logAudit({
        accion: "INFRA_INCIDENTE_ABIERTO",
        tipoRecurso: "IncidenteInfra",
        recursoId: incidente.id,
        valorNuevo: senal,
        metadatos: { senal, detalle: detalle ?? null, inicio: incidente.inicio.toISOString() },
    });
    await notificarIncidente(incidente);
    return incidente;
}

/**
 * Email de alerta con throttle por señal (`monitoreo.email.throttle_min`) y
 * destinatarios configurables (`monitoreo.email.destinatarios`, separados por
 * coma; vacío = no enviar). Un fallo del envío NO tumba el vigilante: el
 * incidente ya quedó abierto y auditado. Devuelve true si el email salió.
 */
export async function notificarIncidente(incidente: IncidenteInfra): Promise<boolean> {
    const [throttleParam, destinatariosParam] = await Promise.all([
        getParametroSistema("monitoreo.email.throttle_min"),
        getParametroSistema("monitoreo.email.destinatarios"),
    ]);

    const destinatarios = (destinatariosParam?.valor ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
    if (destinatarios.length === 0) return false;

    const throttleNum = Number(throttleParam?.valor);
    const throttleMin = Number.isFinite(throttleNum) && throttleNum > 0 ? throttleNum : 30;
    if (incidente.ultimoEmailEn && Date.now() - incidente.ultimoEmailEn.getTime() < throttleMin * 60_000) {
        return false;
    }

    try {
        await enviarAlertaInfra({
            senal: incidente.senal,
            inicio: incidente.inicio,
            detalle: incidente.detalle,
            destinatarios,
        });
    } catch (error) {
        logger.error(`[Monitoreo] Error enviando alerta de infraestructura (senal=${incidente.senal}): ${error instanceof Error ? error.message : error}`);
        return false;
    }

    const ahora = new Date();
    await prisma.incidenteInfra.update({
        where: { id: incidente.id },
        data: { ultimoEmailEn: ahora },
    });
    await logAudit({
        accion: "INFRA_EMAIL_ENVIADO",
        tipoRecurso: "IncidenteInfra",
        recursoId: incidente.id,
        valorNuevo: incidente.senal,
        metadatos: { senal: incidente.senal, destinatarios: destinatarios.length },
    });
    return true;
}

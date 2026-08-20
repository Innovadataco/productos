/**
 * SPEC-184 (002-PI-079): alertas throttled por rate-limit.
 *
 * Cuando una IP supera el umbral de bloqueos por hora se abre/reusa un
 * IncidenteInfra con señal `rate_limit:<scope>:<ipHash>` y se notifica por
 * email con throttle (`alerts.ratelimit.throttle_min`). El patrón es el mismo
 * de SPEC-171: la notificación NO es un probe; reusamos IncidenteInfra porque
 * ya resuelve deduplicación por señal y throttle por email.
 *
 * Frontera DAL (Q-3): no importa prisma; todo pasa por MonitoreoRepository y
 * RateLimitRepository.
 */
import { MonitoreoRepository } from "@/lib/dal/repositories/monitoreo";
import { RateLimitRepository } from "@/lib/dal/repositories/rate-limit";
import { getParametroSistema } from "@/lib/parametros";
import { logAudit } from "@/lib/audit";
import { enviarAlertaRateLimit } from "@/lib/email";
import { logger } from "@/lib/logger";

const repoMonitoreo = () => new MonitoreoRepository();
const repoRateLimit = () => new RateLimitRepository();

async function alertasHabilitadas(): Promise<boolean> {
    const param = await getParametroSistema("alerts.ratelimit.enabled");
    return param ? param.valor === "true" : true;
}

async function getConfig(): Promise<{
    umbral: number;
    throttleMin: number;
    destinatarios: string[];
}> {
    const [umbralParam, throttleParam, destinatariosParam] = await Promise.all([
        getParametroSistema("alerts.ratelimit.umbral_bloqueos_hora"),
        getParametroSistema("alerts.ratelimit.throttle_min"),
        getParametroSistema("alerts.ratelimit.destinatarios"),
    ]);

    const umbralNum = Number(umbralParam?.valor);
    const throttleNum = Number(throttleParam?.valor);

    return {
        umbral: Number.isFinite(umbralNum) && umbralNum > 0 ? umbralNum : 20,
        throttleMin: Number.isFinite(throttleNum) && throttleNum > 0 ? throttleNum : 60,
        destinatarios: (destinatariosParam?.valor ?? "")
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d.length > 0),
    };
}

/**
 * Evalúa si una IP que acaba de ser bloqueada por rate-limit supera el umbral
 * de bloqueos por hora y, de ser así, abre/reusa un IncidenteInfra y envía un
 * email throttled. Los errores se loguean pero no tumban la request.
 */
export async function evaluarYAlertarRateLimit(params: {
    scope: string;
    identifier: string;
    ipHash: string;
    maxRequests: number;
}): Promise<void> {
    try {
        if (!(await alertasHabilitadas())) return;

        const config = await getConfig();
        if (config.destinatarios.length === 0) return;

        const ahora = new Date();
        const haceUnaHora = new Date(ahora.getTime() - 60 * 60 * 1000);
        const bloqueos = await repoRateLimit().contarBloqueosPorIpEnRango(
            params.identifier,
            params.scope,
            haceUnaHora,
            params.maxRequests
        );

        if (bloqueos < config.umbral) return;

        const senal = `rate_limit:${params.scope}:${params.ipHash}`;
        let incidente = await repoMonitoreo().incidenteAbiertoDe(senal);
        if (!incidente) {
            incidente = await repoMonitoreo().crearIncidente(
                senal,
                `IP ${params.ipHash} acumuló ${bloqueos} bloqueos en la última hora (scope=${params.scope}, umbral=${config.umbral}).`
            );
            await logAudit({
                accion: "INFRA_INCIDENTE_ABIERTO",
                tipoRecurso: "IncidenteInfra",
                recursoId: incidente.id,
                valorNuevo: senal,
                metadatos: {
                    senal,
                    ipHash: params.ipHash,
                    scope: params.scope,
                    bloqueos,
                    umbral: config.umbral,
                },
            });
        }

        if (
            incidente.ultimoEmailEn &&
            Date.now() - incidente.ultimoEmailEn.getTime() < config.throttleMin * 60_000
        ) {
            return;
        }

        await enviarAlertaRateLimit({
            senal,
            inicio: incidente.inicio,
            detalle: incidente.detalle,
            destinatarios: config.destinatarios,
        });

        await repoMonitoreo().marcarEmailEnviado(incidente.id, ahora);
        await logAudit({
            accion: "INFRA_EMAIL_ENVIADO",
            tipoRecurso: "IncidenteInfra",
            recursoId: incidente.id,
            valorNuevo: senal,
            metadatos: { senal, destinatarios: config.destinatarios.length },
        });
    } catch (error) {
        logger.error("[RateLimitAlerts] Error evaluando alerta:", error);
    }
}

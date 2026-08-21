import { SpamReporteRepository } from "../dal/repositories/spam-reporte";
import { getParametroSistema } from "../parametros";
import { enviarAlertaRevision } from "../email";
import { logger } from "../logger";

/**
 * SPEC-195 (002-PI-089): alerta sobre reportes POSIBLE_SPAM que superan el SLA
 * configurado (`spam.sla_horas`). Corre desde el vigilante de monitoreo.
 */
export async function revisarSlaSpam(): Promise<void> {
    const slaParam = await getParametroSistema("spam.sla_horas");
    const slaHoras = parseInt(slaParam?.valor ?? "48", 10);
    if (!Number.isFinite(slaHoras) || slaHoras < 1) return;

    const limite = new Date(Date.now() - slaHoras * 60 * 60 * 1000);
    const vencidos = await new SpamReporteRepository().findSpamVencidos(limite, 100);

    if (vencidos.length === 0) return;

    for (const reporte of vencidos) {
        try {
            await enviarAlertaRevision({
                id: reporte.id,
                numeroSeguimiento: reporte.numeroSeguimiento,
                identificador: reporte.identificador,
                estado: "POSIBLE_SPAM",
                prioridadAlta: true,
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`[SPAM-SLA] Error alertando reporte ${reporte.id}: ${msg}`);
        }
    }

    logger.info(`[SPAM-SLA] ${vencidos.length} reportes POSIBLE_SPAM vencidos alertados`);
}

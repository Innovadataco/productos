import { SpamReporteRepository } from "../dal/repositories/spam-reporte";
import { getParametroSistema } from "../parametros";
import { enviarAlertaRevision } from "../email";
import { logAudit } from "../audit";
import { logger } from "../logger";

/**
 * SPEC-195 (002-PI-089): alerta sobre reportes POSIBLE_SPAM que superan el SLA
 * configurado (`spam.sla_horas`). Corre desde el vigilante de monitoreo.
 *
 * I-280 (SPEC-387): candado de repetición. Antes de este fix, el job pegaba
 * `enviarAlertaRevision` en cada vuelta (cada 15 min) para TODOS los vencidos
 * — en 24 h iban 1.894 correos sobre 135 casos (14× por caso). Ahora el job
 * consulta el último audit `SPAM_ALERTA_REVISION_ENVIADA` y salta el reporte
 * si `ultimoAviso.creadoEn >= reporte.updatedAt` — es decir, si desde el aviso
 * previo no cambió nada. Cuando el reporte cambia de estado (`updatedAt` se
 * mueve), sí vuelve a avisar la siguiente vez que vence. Mismo patrón que
 * `EXPEDIENTE_SLA_VENCIDO` en `tareas-motor.ts:117-118`.
 */
export async function revisarSlaSpam(): Promise<void> {
    const slaParam = await getParametroSistema("spam.sla_horas");
    const slaHoras = parseInt(slaParam?.valor ?? "48", 10);
    if (!Number.isFinite(slaHoras) || slaHoras < 1) return;

    const limite = new Date(Date.now() - slaHoras * 60 * 60 * 1000);
    const repo = new SpamReporteRepository();
    const vencidos = await repo.findSpamVencidos(limite, 100);

    if (vencidos.length === 0) return;

    let enviados = 0;
    let saltados = 0;
    for (const reporte of vencidos) {
        const ultimoAviso = await repo.obtenerUltimoAvisoSlaSpam(reporte.id);
        if (ultimoAviso && ultimoAviso.creadoEn.getTime() >= reporte.actualizadoEn.getTime()) {
            saltados += 1;
            continue;
        }
        try {
            await enviarAlertaRevision({
                id: reporte.id,
                numeroSeguimiento: reporte.numeroSeguimiento,
                identificador: reporte.identificador,
                estado: "POSIBLE_SPAM",
                prioridadAlta: true,
            });
            // El audit se registra SOLO tras enviar bien: si el correo tronó,
            // la siguiente vuelta reintenta (no se marca «avisado» por error).
            await logAudit({
                accion: "SPAM_ALERTA_REVISION_ENVIADA",
                tipoRecurso: "Reporte",
                recursoId: reporte.id,
                ipAddress: "worker",
                userAgent: "spam-sla/worker",
            });
            enviados += 1;
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error(`[SPAM-SLA] Error alertando reporte ${reporte.id}: ${msg}`);
        }
    }

    logger.info(
        `[SPAM-SLA] ${vencidos.length} POSIBLE_SPAM vencidos: ${enviados} avisados, ${saltados} saltados (ya avisados sin cambios)`
    );
}

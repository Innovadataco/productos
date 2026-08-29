/**
 * SPEC-238 (002-PI-mega-cola): tarea del worker del motor de expediente que
 * vigila el SLA de las aclaraciones padre-comité (US4, FR-006). Se ejecuta en
 * el tick de `scripts/worker-expediente-motor.mjs` (sin worker nuevo, D-72).
 *
 * Por cada aclaración PENDIENTE cuya `solicitadaEn` + `padre.comite.sla_horas_normal`
 * sea anterior a ahora (America/Bogota):
 * 1. Publica el evento `expediente.comite.sla_vencido` (best-effort, Motor Notif).
 * 2. Ejecuta el cierre forzoso: expediente EN_ACLARACION → CERRADO y
 *    aclaración → CERRADA_FORZOSAMENTE (idempotente, ver servicio).
 *
 * El parámetro se lee en CADA tick (edge case "SLA cambiado en caliente").
 */
import { getParametroSistemaValor } from "@/lib/parametros";
import { AclaracionRepository } from "@/lib/dal/repositories/aclaracion-repository";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";
import { cerrarAclaracionVencidaPorSla } from "@/lib/dal/services/aclaracion-expediente";
import { publicarEventoExpediente } from "../estados/publicar-evento-expediente";
import { EVENTOS_EXPEDIENTE } from "../estados/transiciones";
import { calcularLimiteSolicitudSla } from "./sla-aclaracion";
import { calcularFechaLimiteSla } from "./fechas-motor";

const DEFAULT_SLA_HORAS_NORMAL = 48;
const LIMITE_LOTE = 100;

async function slaHorasNormal(): Promise<number> {
    const raw = await getParametroSistemaValor("padre.comite.sla_horas_normal");
    const parsed = Number.parseInt(raw ?? String(DEFAULT_SLA_HORAS_NORMAL), 10);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_SLA_HORAS_NORMAL;
}

/**
 * US4: cierra forzosamente las aclaraciones PENDIENTE con SLA vencido.
 * Devuelve el número de aclaraciones cerradas en este tick.
 */
export async function cerrarAclaracionesSlaVencidas(ahora: Date = new Date()): Promise<number> {
    const horas = await slaHorasNormal();
    const limite = calcularLimiteSolicitudSla(ahora, horas);

    const vencidas = await new AclaracionRepository().listarPendientesVencidas(limite, LIMITE_LOTE);

    let cerradas = 0;
    for (const aclaracion of vencidas) {
        try {
            // Evento best-effort: si la publicación falla, el cierre de la BD
            // se aplica igualmente (eventual consistencia, edge case de la spec).
            const expediente = await new ExpedienteMotorRepository().obtenerPorId(aclaracion.expedienteId);
            if (expediente) {
                await publicarEventoExpediente(EVENTOS_EXPEDIENTE.COMITE_SLA_VENCIDO, {
                    expediente,
                    actor: "worker-expediente-motor",
                    motivo: `SLA de aclaración vencido (${horas}h) — aclaración ${aclaracion.id}`,
                    fechaLimite: calcularFechaLimiteSla(aclaracion.solicitadaEn, horas),
                });
            }

            await cerrarAclaracionVencidaPorSla(aclaracion);
            cerradas++;
        } catch (error) {
            console.warn(
                `[ExpedienteMotor] Cierre forzoso de aclaración omitido: aclaracion=${aclaracion.id} expediente=${aclaracion.expedienteId} —`,
                error instanceof Error ? error.message : error
            );
        }
    }
    return cerradas;
}

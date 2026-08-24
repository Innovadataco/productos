/**
 * SPEC-239 (002-PI-mega-cola): handler del evento
 * `expediente.gravedad.subio_a_rojo` publicado por el motor de estados
 * (SPEC-236, FR-014).
 *
 * Al subir un expediente a gravedad ROJO (FR-004):
 * a) fija el SLA efectivo a `padre.comite.sla_horas_gravedad_roja` (default 12)
 *    y registra `fechaEscaladoRojoEn` (arranque del reloj de la vigilancia 12h);
 * b) publica el evento en Motor Notif vía `publicarEventoExpediente` con la
 *    plantilla existente `expediente.gravedad.subio_a_rojo` (sembrada por
 *    SPEC-236); la publicación es fail-open (post-commit, error solo logueado);
 * c) registra `AuditLog` `EXPEDIENTE_ESCALADO_A_ROJO` con metadatos
 *    `nivel: "CRITICAL"` (el modelo AuditLog no tiene columna de nivel; se
 *    documenta en cierre.md). NUNCA incluye texto de reportes.
 *
 * Integración: `recalcularGravedad24h` (src/lib/expediente/motor/tareas-motor.ts)
 * delega aquí cuando el score anterior no era ROJO y el nuevo sí lo es; el caso
 * "ROJO que ya era ROJO" no re-publica (edge case cubierto por el llamador, que
 * además tiene el throttle/reemplazo del Motor Notif, US2.4).
 */
import { ScoreGravedad } from "@prisma/client";
import type { Expediente } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { getParametroSistemaValor } from "@/lib/parametros";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";
import { publicarEventoExpediente } from "../estados/publicar-evento-expediente";
import { EVENTOS_EXPEDIENTE } from "../estados/transiciones";

export const PARAM_SLA_HORAS_ROJO = "padre.comite.sla_horas_gravedad_roja";
const DEFAULT_SLA_HORAS_ROJO = 12;

export interface ManejarSubidaARojoInput {
    expediente: Expediente;
    /** Gravedad previa (para auditoría; el llamador garantiza que no era ROJO). */
    gravedadAnterior: ScoreGravedad;
    /** Id del actor (worker o usuario) que originó la subida. */
    actor: string;
    motivo?: string | undefined;
    /** Reloj inyectable para tests. */
    ahora?: Date | undefined;
}

export async function manejarSubidaARojo(input: ManejarSubidaARojoInput): Promise<Expediente> {
    const ahora = input.ahora ?? new Date();

    const raw = await getParametroSistemaValor(PARAM_SLA_HORAS_ROJO);
    const parsed = Number.parseInt(raw ?? String(DEFAULT_SLA_HORAS_ROJO), 10);
    const slaHoras = Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_SLA_HORAS_ROJO;

    const actualizado = await new ExpedienteMotorRepository().marcarEscaladoRojo(input.expediente.id, {
        slaEfectivoHoras: slaHoras,
        fechaEscaladoRojoEn: ahora,
    });

    await logAudit({
        accion: "EXPEDIENTE_ESCALADO_A_ROJO",
        tipoRecurso: "Expediente",
        recursoId: input.expediente.id,
        valorAnterior: input.gravedadAnterior,
        valorNuevo: ScoreGravedad.ROJO,
        ipAddress: "worker",
        userAgent: "expediente-motor/handler",
        metadatos: {
            nivel: "CRITICAL",
            gravedadAnterior: input.gravedadAnterior,
            slaEfectivoHoras: slaHoras,
            fechaEscaladoRojoEn: ahora.toISOString(),
            actor: input.actor,
        },
    });

    await publicarEventoExpediente(EVENTOS_EXPEDIENTE.GRAVEDAD_SUBIO_A_ROJO, {
        expediente: actualizado,
        actor: input.actor,
        motivo: input.motivo ?? `Gravedad subió de ${input.gravedadAnterior} a ROJO`,
    });

    return actualizado;
}

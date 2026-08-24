/**
 * SPEC-236 (002-PI-mega-cola): wrapper de publicación de eventos del
 * expediente hacia Motor Notif (SPEC-201, API estricta `programar`).
 *
 * Fail-open hacia notificaciones: si Motor Notif falla, la transición de
 * estado ya quedó persistida y el error solo se loguea (plan §2.1). La API
 * pública del motor no acepta cliente transaccional, por eso la publicación
 * se ejecuta DESPUÉS del commit de la transición.
 */
import type { Expediente } from "@prisma/client";
import { programar } from "@/lib/notificaciones";
import { ExpedienteMotorRepository } from "@/lib/dal/repositories/expediente-motor-repository";
import { EVENTOS_EXPEDIENTE, type ClaveEventoExpediente } from "./transiciones";

export interface PayloadEventoExpediente {
    expediente: Expediente;
    estadoAnterior?: string | undefined;
    estadoDestino?: string | undefined;
    actor?: string | undefined;
    motivo?: string | undefined;
    fechaLimite?: Date | undefined;
}

/** Eventos dirigidos solo al comité de validación (no al padre). */
const EVENTOS_SOLO_COMITE = new Set<ClaveEventoExpediente>([
    EVENTOS_EXPEDIENTE.CONSOLIDACION_SOLICITADA,
    EVENTOS_EXPEDIENTE.ACLARACION_RESPONDIDA,
    EVENTOS_EXPEDIENTE.COMITE_SLA_VENCIDO,
]);

/** Eventos que además del padre copian al comité. */
const EVENTOS_PADRE_Y_COMITE = new Set<ClaveEventoExpediente>([
    EVENTOS_EXPEDIENTE.GRAVEDAD_SUBIO_A_ROJO,
    EVENTOS_EXPEDIENTE.ESCALADO,
]);

const MAX_DESTINATARIOS_COMITE = 50;

async function resolverDestinatarios(
    clave: ClaveEventoExpediente,
    expediente: Expediente
): Promise<Array<{ usuarioId: string; variables: Record<string, unknown> }>> {
    const destinatarios: Array<{ usuarioId: string; variables: Record<string, unknown> }> = [];

    if (!EVENTOS_SOLO_COMITE.has(clave)) {
        destinatarios.push({ usuarioId: expediente.padreUsuarioId, variables: {} });
    }

    if (EVENTOS_SOLO_COMITE.has(clave) || EVENTOS_PADRE_Y_COMITE.has(clave)) {
        const comite = await new ExpedienteMotorRepository().listarIdsComiteValidacionActivo(MAX_DESTINATARIOS_COMITE);
        for (const miembroId of comite) {
            destinatarios.push({ usuarioId: miembroId, variables: {} });
        }
    }

    return destinatarios;
}

/**
 * Publica un evento del ciclo de vida del expediente en Motor Notif.
 * Devuelve el número de notificaciones programadas; 0 si no hay reglas
 * activas o si el motor falla (fail-open, error logueado).
 */
export async function publicarEventoExpediente(
    clave: ClaveEventoExpediente,
    payload: PayloadEventoExpediente
): Promise<number> {
    try {
        const { expediente } = payload;
        const destinatarios = await resolverDestinatarios(clave, expediente);
        if (destinatarios.length === 0) {
            console.warn(`[Expediente/MotorNotif] Sin destinatarios para evento=${clave} expediente=${expediente.id}`);
            return 0;
        }

        const resultado = await programar({
            evento: clave,
            sujetoTipo: "Expediente",
            sujetoId: expediente.id,
            destinatarios,
            metadatos: {
                expedienteId: expediente.id,
                estadoAnterior: payload.estadoAnterior ?? expediente.estado,
                estadoDestino: payload.estadoDestino ?? expediente.estado,
                actor: payload.actor ?? "sistema",
                motivo: payload.motivo ?? "",
                scoreGravedadActual: expediente.scoreGravedadActual,
                fechaLimite: payload.fechaLimite?.toISOString() ?? "",
                urlExpediente: `/dashboard/expedientes/${expediente.id}`,
            },
        });
        return resultado.programadas;
    } catch (error) {
        console.warn(
            `[Expediente/MotorNotif] Publicación fall-open: evento=${clave} expediente=${payload.expediente.id} —`,
            error instanceof Error ? error.message : error
        );
        return 0;
    }
}

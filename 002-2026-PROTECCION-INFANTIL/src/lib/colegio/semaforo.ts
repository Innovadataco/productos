/**
 * SPEC-143 (D1) → SPEC-560 (D-120, ratificada por el CEO) — Regla del estado de la
 * home del rector, como función pura.
 *
 * D-120 DEROGA la D1 de SPEC-143: el ámbar significa ATENCIÓN / acción pendiente en
 * todo el producto; lo ya atendido va en pino. El rubí queda SOLO para la alerta
 * específica de alto riesgo en su tarjeta — nunca en un hero-resumen.
 *
 * El estado se nombra por su SEMÁNTICA (PENDIENTE / ATENDIDO / TRANQUILO), no por su
 * color: así el color deja de ser el contrato y cambiarlo no revive D1. La traducción
 * a color vive en `colorDeEstadoColegio` (única fuente del color del estado):
 *   PENDIENTE (alertasNuevas>0)  → ámbar  (hay que actuar)
 *   ATENDIDO  (alertas72h>0)     → pino   (reciente, ya atendido: al día)
 *   TRANQUILO (ninguna)          → pino   (sin novedad)
 */
import type { EstadoSistema } from "@/components/ui/Anillo";

export type EstadoColegio = "PENDIENTE" | "ATENDIDO" | "TRANQUILO";

export interface ConteosSemaforo {
    alertasNuevas: number;
    alertas72h: number;
}

export function resolverEstado({ alertasNuevas, alertas72h }: ConteosSemaforo): EstadoColegio {
    if (alertasNuevas > 0) return "PENDIENTE";
    if (alertas72h > 0) return "ATENDIDO";
    return "TRANQUILO";
}

/** Único lugar donde el estado del colegio se traduce a color (D-120: nunca rubí). */
export function colorDeEstadoColegio(estado: EstadoColegio): EstadoSistema {
    switch (estado) {
        case "PENDIENTE":
            return "ambar";
        case "ATENDIDO":
        case "TRANQUILO":
            return "pino";
    }
}

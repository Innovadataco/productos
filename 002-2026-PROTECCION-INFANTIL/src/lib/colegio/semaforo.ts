/**
 * SPEC-143 (D1, aprobada por ZEUS 2026-08-03) — Regla del semáforo de la home del
 * rector, como función pura:
 *   rubí  = ≥1 alerta en estado "nueva" (sin gestionar)
 *   ámbar = 0 nuevas pero ≥1 alerta en las últimas 72 horas
 *   pino  = el resto
 * 72 h (no 7 días): el estado decae solo y no hay fatiga de alarma.
 * CONDICIÓN DE COPY: en ámbar la interfaz dice explícitamente que ya está atendido
 * ("hubo algo y ya lo atendiste") — nunca se lee como trabajo pendiente.
 */
import type { EstadoSistema } from "@/components/ui/Anillo";

export interface ConteosSemaforo {
    alertasNuevas: number;
    alertas72h: number;
}

export function resolverEstado({ alertasNuevas, alertas72h }: ConteosSemaforo): EstadoSistema {
    if (alertasNuevas > 0) return "rubi";
    if (alertas72h > 0) return "ambar";
    return "pino";
}

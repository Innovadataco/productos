import { EstadoReporte } from "@prisma/client";

export type EstadoVisualUsuario = "En proceso" | "Procesado";
export type BadgeVisualUsuario = "warning" | "success" | "muted";

export type MapEstadoUsuarioResult = {
    estadoVisual: EstadoVisualUsuario;
    badge: BadgeVisualUsuario;
    enProceso: boolean;
};

/**
 * Mapeo puro de estados internos de un reporte a los estados simplificados
 * que ve el usuario final, según la Spec 023.
 */
export function mapEstadoUsuario(estado: EstadoReporte): MapEstadoUsuarioResult {
    switch (estado) {
        case EstadoReporte.PENDIENTE:
        case EstadoReporte.PROCESANDO:
        case EstadoReporte.REVISION_MANUAL:
        case EstadoReporte.POSIBLE_SPAM:
        case EstadoReporte.REQUIERE_ANONIMIZACION:
            return { estadoVisual: "En proceso", badge: "warning", enProceso: true };
        case EstadoReporte.CLASIFICADO:
        case EstadoReporte.CORREGIDO:
            return { estadoVisual: "Procesado", badge: "success", enProceso: false };
        case EstadoReporte.DUPLICADO:
            return { estadoVisual: "Procesado", badge: "muted", enProceso: false };
        default:
            // Estado desconocido: opción más segura es "En proceso" (no expone resolución).
            return { estadoVisual: "En proceso", badge: "warning", enProceso: true };
    }
}

const MENSAJES_ESTADO: Record<EstadoReporte, string> = {
    [EstadoReporte.PENDIENTE]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.PROCESANDO]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.REVISION_MANUAL]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.POSIBLE_SPAM]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.REQUIERE_ANONIMIZACION]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.CLASIFICADO]: "Tu reporte ha sido procesado y clasificado.",
    [EstadoReporte.CORREGIDO]: "Tu reporte ha sido revisado y corregido.",
    [EstadoReporte.DUPLICADO]: "Tu reporte fue vinculado a uno existente.",
};

/**
 * Genera el mensaje amigable para el usuario final. Si el estado está en
 * proceso, incluye el SLA en horas.
 */
export function getMensajeUsuario(estado: EstadoReporte, slaHoras: number): string {
    const plantilla = MENSAJES_ESTADO[estado] ?? MENSAJES_ESTADO[EstadoReporte.PENDIENTE];
    return plantilla.replace("{{sla}}", String(slaHoras));
}

/**
 * Lee el SLA de procesamiento desde el parámetro de sistema.
 * Si el parámetro no existe o no es numérico, retorna el default 24.
 */
export function parseSlaHoras(valor: string | null | undefined): number {
    if (!valor) return 24;
    const parsed = Number.parseInt(valor, 10);
    return Number.isNaN(parsed) || parsed < 1 ? 24 : parsed;
}

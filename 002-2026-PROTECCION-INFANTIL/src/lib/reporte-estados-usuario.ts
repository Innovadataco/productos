import { EstadoReporte } from "@prisma/client";

export type EstadoVisualUsuario = "En proceso" | "Verificado";
export type BadgeVisualUsuario = "warning" | "success" | "muted";

export type EstadoContactoVisual = "sinReportes" | "enRevision" | "clasificado";

export type MapEstadoUsuarioResult = {
    estadoVisual: EstadoVisualUsuario;
    badge: BadgeVisualUsuario;
    enProceso: boolean;
};

/**
 * Mapeo puro de estados internos de un reporte a los estados simplificados
 * que ve el usuario final, según la Spec 031:
 * - CLASIFICADO / CORREGIDO → "Verificado"
 * - Todo lo demás → "En proceso"
 */
export function mapEstadoUsuario(estado: EstadoReporte): MapEstadoUsuarioResult {
    switch (estado) {
        case EstadoReporte.CLASIFICADO:
        case EstadoReporte.CORREGIDO:
            return { estadoVisual: "Verificado", badge: "success", enProceso: false };
        case EstadoReporte.PENDIENTE:
        case EstadoReporte.PROCESANDO:
        case EstadoReporte.REVISION_MANUAL:
        case EstadoReporte.POSIBLE_SPAM:
        case EstadoReporte.REQUIERE_ANONIMIZACION:
        case EstadoReporte.DUPLICADO:
        default:
            // Estado desconocido: opción más segura es "En proceso" (no expone resolución).
            return { estadoVisual: "En proceso", badge: "warning", enProceso: true };
    }
}

/**
 * Devuelve el label único para un estado interno de reporte.
 */
export function formatEstadoUsuario(estado: EstadoReporte): EstadoVisualUsuario {
    return mapEstadoUsuario(estado).estadoVisual;
}

/**
 * Devuelve el label para el estado del Círculo de Confianza.
 */
export function formatEstadoCirculo(estado: EstadoContactoVisual): string {
    switch (estado) {
        case "clasificado":
            return "Verificado";
        case "enRevision":
            return "En proceso";
        case "sinReportes":
        default:
            return "Sin reportes";
    }
}

const MENSAJES_ESTADO: Record<EstadoReporte, string> = {
    [EstadoReporte.PENDIENTE]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.PROCESANDO]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.REVISION_MANUAL]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.POSIBLE_SPAM]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.REQUIERE_ANONIMIZACION]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.DUPLICADO]: "Tu reporte está en proceso — puede tardar hasta {{sla}} horas",
    [EstadoReporte.CLASIFICADO]: "Tu reporte ha sido verificado y clasificado.",
    [EstadoReporte.CORREGIDO]: "Tu reporte ha sido verificado y corregido.",
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

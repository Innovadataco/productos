import { prisma } from "@/lib/db";

/**
 * registrarEventoAudit · ÚNICO punto de escritura de la bitácora general de
 * BI (SE1: helper central — inline en cada endpoint = el próximo lo olvida).
 *
 * Eventos de gobierno del producto (quién ingresó, qué config cambió, qué se
 * exportó). Distinto de BIConsultaLog, que es la traza del chat NL→SQL.
 *
 * FAIL-OPEN deliberado: la auditoría NUNCA rompe el flujo principal. Si la
 * escritura falla (BD caída, migración pendiente), se loguea el error y se
 * sigue — un login no puede 500 porque la bitácora no escribió. La
 * contrapartida: si la bitácora importa más que el flujo, el monitor de
 * salud la detecta vacía (ver vigilancia).
 *
 * REGLA DURA: `detalle` jamás lleva passwords, tokens ni secretos — solo
 * metadatos (clave de config, valor nuevo, recurso exportado, formato).
 */

/** Acciones canónicas de la bitácora general. */
export const ACCION_AUDIT = {
    LOGIN_OK: "LOGIN_OK",
    LOGIN_FALLIDO: "LOGIN_FALLIDO",
    CONFIG_CAMBIO: "CONFIG_CAMBIO",
    EXPORTACION: "EXPORTACION",
} as const;

export type AccionAudit = (typeof ACCION_AUDIT)[keyof typeof ACCION_AUDIT];

interface EventoAudit {
    accion: AccionAudit;
    /** Email del admin BI; en LOGIN_FALLIDO es el email intentado. */
    email: string;
    /** JSON chico serializable; jamás secretos. */
    detalle?: Record<string, unknown>;
}

export async function registrarEventoAudit(evento: EventoAudit): Promise<void> {
    try {
        await prisma.bIAuditLog.create({
            data: {
                accion: evento.accion,
                email: evento.email,
                detalle: evento.detalle ? JSON.stringify(evento.detalle) : null,
            },
        });
    } catch (error) {
        console.error(
            "[Bitácora] Falló registrarEventoAudit (fail-open, el flujo sigue):",
            error instanceof Error ? error.message : error,
        );
    }
}

/**
 * SPEC-155 (FR-002): servicio de timeline "Ver proceso" para ADMIN.
 * Combina TransicionReporte y ReintentoReporte en una única línea de tiempo
 * cronológica, sin exponer texto del reporte ni datos personales.
 */
import { TransicionReporteRepository } from "@/lib/dal/repositories/transicion-reporte";
import { ReintentoReporteRepository } from "@/lib/dal/repositories/reintento-reporte";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { AuditLogRepository } from "@/lib/dal/repositories/audit-log";
import { AppError, ERROR_CODES } from "@/lib/errors";

export type TipoEventoProceso = "TRANSICION" | "REINTENTO" | "ASIGNACION_OPERADOR";

export interface EventoTransicion {
    tipo: "TRANSICION";
    id: string;
    fecha: string;
    estadoAnterior: string;
    estadoNuevo: string;
    responsableTipo: string;
    responsableId: string | null;
    motivo: string | null;
}

export interface EventoReintento {
    tipo: "REINTENTO";
    id: string;
    fecha: string;
    intento: number;
    exitoso: boolean;
    error: string | null;
}

export interface EventoAsignacionOperador {
    tipo: "ASIGNACION_OPERADOR";
    id: string;
    fecha: string;
    accion: "OPERADOR_ASIGNADO" | "OPERADOR_REASIGNADO" | "OPERADOR_DESASIGNADO";
    operadorEmail: string | null;
    operadorNombre: string | null;
    actorEmail: string | null;
    actorNombre: string | null;
}

export type EventoProceso = EventoTransicion | EventoReintento | EventoAsignacionOperador;

export interface TimelineProceso {
    eventos: EventoProceso[];
}

function parseJsonSeguro(valor: string | null): Record<string, unknown> | null {
    if (!valor) return null;
    try {
        const parsed = JSON.parse(valor);
        return typeof parsed === "object" && parsed !== null ? parsed : null;
    } catch {
        return null;
    }
}

function extraerEmailOperador(valor: Record<string, unknown> | null): string | null {
    if (!valor) return null;
    const email = valor.operadorEmail;
    return typeof email === "string" ? email : null;
}

function extraerNombreOperador(valor: Record<string, unknown> | null): string | null {
    if (!valor) return null;
    const nombre = valor.operadorNombre;
    return typeof nombre === "string" ? nombre : null;
}

export async function obtenerTimelineProceso(reporteId: string): Promise<TimelineProceso> {
    const reporte = await new ReporteRepository().findByIdBasico(reporteId);
    if (!reporte) {
        throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const [transiciones, reintentos, asignaciones] = await Promise.all([
        new TransicionReporteRepository().findByReporteId(reporteId),
        new ReintentoReporteRepository().findByReporteId(reporteId),
        new AuditLogRepository().findAsignacionesReporte(reporteId),
    ]);

    const eventos: EventoProceso[] = [
        ...transiciones.map((t) => ({
            tipo: "TRANSICION" as const,
            id: t.id,
            fecha: t.creadoEn.toISOString(),
            estadoAnterior: t.estadoAnterior,
            estadoNuevo: t.estadoNuevo,
            responsableTipo: t.responsableTipo,
            responsableId: t.responsableId,
            motivo: t.motivo,
        })),
        ...reintentos.map((r) => ({
            tipo: "REINTENTO" as const,
            id: r.id,
            fecha: r.creadoEn.toISOString(),
            intento: r.intento,
            exitoso: r.exitoso,
            error: r.error,
        })),
        ...asignaciones.map((a): EventoAsignacionOperador => {
            const valorNuevo = parseJsonSeguro(a.valorNuevo);
            const valorAnterior = parseJsonSeguro(a.valorAnterior);
            const usuarioEmail = a.usuario?.email ?? null;
            const usuarioNombre = a.usuario?.nombre ?? null;
            const accion = a.accion as EventoAsignacionOperador["accion"];

            if (accion === "OPERADOR_ASIGNADO") {
                return {
                    tipo: "ASIGNACION_OPERADOR",
                    id: a.id,
                    fecha: a.creadoEn.toISOString(),
                    accion,
                    operadorEmail: usuarioEmail,
                    operadorNombre: usuarioNombre,
                    actorEmail: null,
                    actorNombre: null,
                };
            }

            const operadorEmail = accion === "OPERADOR_DESASIGNADO"
                ? extraerEmailOperador(valorAnterior)
                : extraerEmailOperador(valorNuevo);
            const operadorNombre = accion === "OPERADOR_DESASIGNADO"
                ? extraerNombreOperador(valorAnterior)
                : extraerNombreOperador(valorNuevo);

            return {
                tipo: "ASIGNACION_OPERADOR",
                id: a.id,
                fecha: a.creadoEn.toISOString(),
                accion,
                operadorEmail,
                operadorNombre,
                actorEmail: usuarioEmail,
                actorNombre: usuarioNombre,
            };
        }),
    ];

    eventos.sort((a, b) => {
        const ta = new Date(a.fecha).getTime();
        const tb = new Date(b.fecha).getTime();
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
    });

    return { eventos };
}

/**
 * SPEC-155 (FR-002): servicio de timeline "Ver proceso" para ADMIN.
 * Combina TransicionReporte y ReintentoReporte en una única línea de tiempo
 * cronológica, sin exponer texto del reporte ni datos personales.
 */
import { TransicionReporteRepository } from "@/lib/dal/repositories/transicion-reporte";
import { ReintentoReporteRepository } from "@/lib/dal/repositories/reintento-reporte";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { AppError, ERROR_CODES } from "@/lib/errors";

export type TipoEventoProceso = "TRANSICION" | "REINTENTO";

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

export type EventoProceso = EventoTransicion | EventoReintento;

export interface TimelineProceso {
    eventos: EventoProceso[];
}

export async function obtenerTimelineProceso(reporteId: string): Promise<TimelineProceso> {
    const reporte = await new ReporteRepository().findByIdBasico(reporteId);
    if (!reporte) {
        throw new AppError("Reporte no encontrado", ERROR_CODES.NOT_FOUND, 404);
    }

    const [transiciones, reintentos] = await Promise.all([
        new TransicionReporteRepository().findByReporteId(reporteId),
        new ReintentoReporteRepository().findByReporteId(reporteId),
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
    ];

    eventos.sort((a, b) => {
        const ta = new Date(a.fecha).getTime();
        const tb = new Date(b.fecha).getTime();
        if (ta !== tb) return ta - tb;
        return a.id.localeCompare(b.id);
    });

    return { eventos };
}

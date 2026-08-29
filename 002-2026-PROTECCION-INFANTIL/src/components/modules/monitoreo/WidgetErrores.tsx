/**
 * SPEC-171 (Pilar B) — Widget de errores activos.
 * Cruza dos fuentes existentes: incidentes de infraestructura ABIERTOS
 * (GET /api/admin/monitoreo/incidentes?estado=ABIERTO) y trabajos fallidos
 * de la cola (GET /api/admin/estadisticas, sección worker).
 */
import { useFetchJson } from "@/components/ui/use-fetch-json";
import { MarcoWidget } from "./MarcoWidget";
import { nombreSenal } from "./SemaforoCard";
import type { EstadisticasConCola } from "./WidgetCola";

export type IncidenteInfraItem = {
    id: string;
    senal: string;
    estado: string;
    inicio: string;
    fin: string | null;
    detalle: string | null;
};

type IncidentesRespuesta = {
    items: IncidenteInfraItem[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function formatoInicio(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "—";
    return fecha.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });
}

export function WidgetErrores({ recargaId }: { recargaId: number }) {
    const incidentes = useFetchJson<IncidentesRespuesta>("/api/admin/monitoreo/incidentes?estado=ABIERTO&pageSize=5", [recargaId]);
    const stats = useFetchJson<EstadisticasConCola>("/api/admin/estadisticas", [recargaId]);

    const datos = incidentes.datos ?? stats.datos;
    const cargando = (incidentes.cargando || stats.cargando) && !datos;
    const error = datos ? null : incidentes.error ?? stats.error;
    const abiertos = incidentes.datos?.pagination.total ?? 0;
    const fallidosCola = stats.datos?.worker?.fallidos ?? 0;

    return (
        <MarcoWidget titulo="Errores activos" cargando={cargando} error={error}>
            {datos && (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-2xl font-bold text-body">{abiertos}</p>
                            <p className="text-xs text-subtle">Incidentes abiertos</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-body">{fallidosCola}</p>
                            <p className="text-xs text-subtle">Trabajos fallidos en la cola</p>
                        </div>
                    </div>
                    {(incidentes.datos?.items.length ?? 0) > 0 ? (
                        <ul className="mt-3 space-y-1">
                            {incidentes.datos?.items.map((incidente) => (
                                <li key={incidente.id} className="flex items-center justify-between gap-2 text-xs">
                                    <span className="text-muted">{nombreSenal(incidente.senal)}</span>
                                    <span className="text-subtle">desde {formatoInicio(incidente.inicio)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 text-xs text-muted">Sin errores activos.</p>
                    )}
                </>
            )}
        </MarcoWidget>
    );
}

/**
 * SPEC-171 (Pilar B) — Widget del SLA operativo de clasificación.
 * Reusa GET /api/admin/estadisticas/clasificacion (el mismo endpoint del
 * tablero de Clasificación): tiempo promedio de gestión, atendidos hoy y
 * escalados pendientes. Rotulado en criollo.
 */
import { useFetchJson } from "@/components/ui/use-fetch-json";
import { MarcoWidget } from "./MarcoWidget";

type ClasificacionResumen = {
    indicadores: {
        atendidosHoy: number;
        tiempoPromedioGestionMin: number;
        escaladosPendientes: number;
    };
};

export function WidgetSla({ recargaId }: { recargaId: number }) {
    const { datos, cargando, error } = useFetchJson<ClasificacionResumen>("/api/admin/estadisticas/clasificacion", [recargaId]);
    const indicadores = datos?.indicadores ?? null;

    return (
        <MarcoWidget titulo="Ritmo de atención (SLA)" cargando={cargando && !datos} error={datos ? null : error}>
            {indicadores && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                        <p className="text-2xl font-bold text-body">
                            {indicadores.tiempoPromedioGestionMin}
                            <span className="text-base font-semibold"> min</span>
                        </p>
                        <p className="text-xs text-subtle">Tiempo promedio de gestión</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-body">{indicadores.atendidosHoy}</p>
                        <p className="text-xs text-subtle">Atendidos hoy</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-body">{indicadores.escaladosPendientes}</p>
                        <p className="text-xs text-subtle">Escalados pendientes</p>
                    </div>
                </div>
            )}
        </MarcoWidget>
    );
}

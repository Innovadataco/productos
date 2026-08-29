/**
 * SPEC-171 (Pilar B) — Widget de la cola de procesamiento (pg-boss).
 * Reusa las métricas que ya expone GET /api/admin/estadisticas (misma sección
 * "Cola de procesamiento" que pinta AdminDashboard), sin duplicar cálculo.
 */
import { useFetchJson } from "@/components/ui/use-fetch-json";
import { MarcoWidget } from "./MarcoWidget";

export type MetricasCola = {
    enCola: number;
    activos: number;
    estancados: number;
    completados: number;
    fallidos: number;
    latenciaPromedioMs: number;
    tasaExito: number;
};

export type EstadisticasConCola = {
    worker: MetricasCola | null;
};

export function WidgetCola({ recargaId }: { recargaId: number }) {
    const { datos, cargando, error } = useFetchJson<EstadisticasConCola>("/api/admin/estadisticas", [recargaId]);
    const cola = datos?.worker ?? null;

    return (
        <MarcoWidget titulo="Cola de procesamiento" cargando={cargando && !datos} error={datos ? null : error}>
            {cola ? (
                <>
                    <div className="grid grid-cols-2 gap-3">
                        <Dato label="En cola" value={cola.enCola} />
                        <Dato label="Activos" value={cola.activos} />
                        <Dato label="Estancados" value={cola.estancados} />
                        <Dato label="Fallidos" value={cola.fallidos} />
                    </div>
                    <p className="mt-3 text-xs text-subtle">
                        Tasa de éxito: <span className="font-semibold text-accent">{cola.tasaExito}%</span>
                    </p>
                </>
            ) : (
                <p className="text-sm text-muted">Sin datos de la cola todavía.</p>
            )}
        </MarcoWidget>
    );
}

function Dato({ label, value }: { label: string; value: number }) {
    return (
        <div>
            <p className="text-2xl font-bold text-body">{value}</p>
            <p className="text-xs text-subtle">{label}</p>
        </div>
    );
}

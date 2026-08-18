/**
 * SPEC-171 (Pilar B) — Widget de reportes atascados.
 * Consume GET /api/admin/monitoreo/atascados: conteos por estado intermedio
 * que llevan más de `umbralHoras` sin avanzar. Solo conteos agregados.
 */
import { useFetchJson } from "@/components/ui/use-fetch-json";
import { MarcoWidget } from "./MarcoWidget";

type AtascadosData = {
    umbralHoras: number;
    creadoAntesDe: string;
    porEstado: Record<string, number>;
    total: number;
};

const ESTADO_LABELS: Record<string, string> = {
    PENDIENTE: "Pendiente",
    PROCESANDO: "Procesando",
    REVISION_MANUAL: "En revisión",
    REQUIERE_ANONIMIZACION: "Requiere anonimización",
};

export function WidgetAtascados({ recargaId }: { recargaId: number }) {
    const { datos, cargando, error } = useFetchJson<AtascadosData>("/api/admin/monitoreo/atascados", [recargaId]);
    const estadosConConteo = Object.entries(datos?.porEstado ?? {}).filter(([, count]) => count > 0);

    return (
        <MarcoWidget titulo="Reportes atascados" cargando={cargando && !datos} error={datos ? null : error}>
            {datos && (
                <>
                    <p className="text-2xl font-bold text-body">{datos.total}</p>
                    <p className="mt-1 text-xs text-subtle">
                        Llevan más de {datos.umbralHoras} h sin avanzar.
                    </p>
                    {estadosConConteo.length > 0 ? (
                        <ul className="mt-3 space-y-1">
                            {estadosConConteo.map(([estado, count]) => (
                                <li key={estado} className="flex items-center justify-between text-xs">
                                    <span className="text-muted">{ESTADO_LABELS[estado] ?? estado}</span>
                                    <span className="font-semibold text-body">{count}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="mt-3 text-xs text-muted">Nada atascado: todo fluye.</p>
                    )}
                </>
            )}
        </MarcoWidget>
    );
}

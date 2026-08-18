import { TarjetaMetrica } from "@/components/ui/TarjetaMetrica";
import type { EstadisticasComiteDto } from "@/lib/dal/types/comite-convivencia";

interface Props {
    estadisticas: EstadisticasComiteDto;
}

const ETIQUETAS_ESTADO: Record<string, string> = {
    PENDIENTE: "Pendientes",
    RESUELTA: "Resueltas",
};

/**
 * SPEC-173: agregados de la bandeja del Comité de Convivencia. SOLO
 * estadísticas; nunca texto de reporte ni datos del denunciante.
 */
export function ComiteEstadisticas({ estadisticas }: Props) {
    const estados = Object.entries(estadisticas.casosPorEstado);
    const totalCasos = estados.reduce((acc, [, total]) => acc + total, 0);

    return (
        <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-3">
                <TarjetaMetrica label="Casos totales" value={totalCasos} />
                <TarjetaMetrica
                    label="Tiempo medio de resolución"
                    value={estadisticas.tiempoMedioResolucionDias ?? "—"}
                    suffix={estadisticas.tiempoMedioResolucionDias !== null ? " días" : ""}
                />
                <TarjetaMetrica label="Categorías distintas" value={estadisticas.topCategorias.length} />
            </div>

            <section className="rounded-2xl glass p-6 md:p-8">
                <h2 className="text-xl font-semibold text-body">Casos por estado</h2>
                {estados.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Todavía no hay casos escalados.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-tinta/10">
                        {estados.map(([estado, total]) => (
                            <li key={estado} className="flex items-center justify-between py-3">
                                <span className="text-sm text-body">{ETIQUETAS_ESTADO[estado] ?? estado}</span>
                                <span className="text-sm font-semibold text-body">{total}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="rounded-2xl glass p-6 md:p-8">
                <h2 className="text-xl font-semibold text-body">Categorías más frecuentes</h2>
                {estadisticas.topCategorias.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">Todavía no hay casos clasificados.</p>
                ) : (
                    <ul className="mt-4 divide-y divide-tinta/10">
                        {estadisticas.topCategorias.map((categoria) => (
                            <li key={categoria.categoria} className="flex items-center justify-between py-3">
                                <span className="text-sm text-body">{categoria.categoria}</span>
                                <span className="text-sm font-semibold text-body">{categoria.total}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

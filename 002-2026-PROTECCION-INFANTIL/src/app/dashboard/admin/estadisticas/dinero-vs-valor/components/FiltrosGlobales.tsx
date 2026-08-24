"use client";

/**
 * SPEC-222 (002-PI-123, US-6, FR-017): filtros globales del panel. Escriben
 * en el querystring (vía `onCambiar`), así sobreviven a cambios de
 * granularidad, drill-down y se comparten por URL. Tono neutral, sin voseo.
 */
import type { Granularidad } from "./tipos";

export interface VistaFiltros {
    granularidad: Granularidad;
    periodo: string;
    desde?: string | undefined;
    hasta?: string | undefined;
    estado: string;
    tipoTitular: string;
    paisId?: string | undefined;
    ciudadId?: string | undefined;
    colegioId?: string | undefined;
    page: number;
}

const SELECT_CLASE =
    "rounded-lg border border-tinta/15 bg-papel px-3 py-2 text-sm text-body focus:border-cielo focus:outline-none";

export function FiltrosGlobales({
    vista,
    onCambiar,
}: {
    vista: VistaFiltros;
    onCambiar: (cambios: Record<string, string | null>) => void;
}) {
    return (
        <section className="glass rounded-3xl p-4" aria-label="Filtros del panel">
            <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted">
                    Período
                    <select
                        className={SELECT_CLASE}
                        value={vista.periodo}
                        onChange={(e) => onCambiar({ periodo: e.target.value, desde: null, hasta: null, page: null })}
                    >
                        <option value="mes">Mes actual</option>
                        <option value="trimestre">Trimestre</option>
                        <option value="anio">Año</option>
                        <option value="custom">Rango personalizado</option>
                    </select>
                </label>

                {vista.periodo === "custom" && (
                    <>
                        <label className="flex flex-col gap-1 text-xs text-muted">
                            Desde
                            <input
                                type="date"
                                className={SELECT_CLASE}
                                value={vista.desde ?? ""}
                                onChange={(e) => onCambiar({ desde: e.target.value || null, page: null })}
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted">
                            Hasta
                            <input
                                type="date"
                                className={SELECT_CLASE}
                                value={vista.hasta ?? ""}
                                onChange={(e) => onCambiar({ hasta: e.target.value || null, page: null })}
                            />
                        </label>
                    </>
                )}

                <label className="flex flex-col gap-1 text-xs text-muted">
                    Estado de suscripción
                    <select
                        className={SELECT_CLASE}
                        value={vista.estado}
                        onChange={(e) => onCambiar({ estado: e.target.value, page: null })}
                    >
                        <option value="todas">Todas</option>
                        <option value="ACTIVA">Activa</option>
                        <option value="EN_GRACIA">En gracia</option>
                        <option value="SUSPENDIDA">Suspendida</option>
                        <option value="CANCELADA">Cancelada</option>
                    </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-muted">
                    Tipo de cliente
                    <select
                        className={SELECT_CLASE}
                        value={vista.tipoTitular}
                        onChange={(e) => onCambiar({ tipoTitular: e.target.value, page: null })}
                    >
                        <option value="ambos">Colegios y padres</option>
                        <option value="COLEGIO">Colegios</option>
                        <option value="PADRE">Padres</option>
                    </select>
                </label>
            </div>
        </section>
    );
}

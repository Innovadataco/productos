import { GlassCard } from "@/components/ui/GlassCard";
import { formatoFechaBogota } from "@/lib/fechas/formato-bogota";
import type { SenalComunitariaData } from "@/lib/expediente/compilacion/queries/senal-comunitaria";

const SIN_DATOS = "—";
const MAX_ENTRADAS = 5;

function entradasFrecuentes(registro: Record<string, number>): { clave: string; total: number }[] {
    return Object.entries(registro)
        .map(([clave, total]) => ({ clave, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, MAX_ENTRADAS);
}

function BloqueFrecuencia({ titulo, registro }: { titulo: string; registro: Record<string, number> }) {
    const entradas = entradasFrecuentes(registro);
    return (
        <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
            <h3 className="text-sm font-semibold text-body">{titulo}</h3>
            {entradas.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{SIN_DATOS}</p>
            ) : (
                <ul className="mt-2 space-y-1">
                    {entradas.map((e) => (
                        <li key={e.clave} className="flex items-center justify-between text-sm">
                            <span className="truncate text-muted">{e.clave}</span>
                            <span className="ml-3 font-semibold text-body">{e.total}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * SPEC-233 (002-PI-133): agregado anónimo del identificador (vista admin/comité).
 * Solo estadísticas agregadas de la señal comunitaria (SPEC-234): cero textos,
 * cero identidades (Ley 1581, presunción de inocencia).
 */
export function IdentificadorAgregadoAnonimo({ senal }: { senal: SenalComunitariaData }) {
    const totalExpedientes =
        senal.totalExpedientesActivos + senal.totalExpedientesCerrados + senal.totalExpedientesEscalados;
    const hayEventos = Object.keys(senal.categoriasFrecuenciaJson).length > 0;

    return (
        <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-body">Agregado anónimo del identificador</h2>
            <p className="mt-1 text-sm text-muted">
                Estadísticas agregadas de la comunidad. No incluyen textos ni datos de quienes reportaron.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
                    <p className="text-sm text-muted">Expedientes activos</p>
                    <p className="mt-1 text-2xl font-bold text-body">{senal.totalExpedientesActivos}</p>
                </div>
                <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
                    <p className="text-sm text-muted">Expedientes cerrados</p>
                    <p className="mt-1 text-2xl font-bold text-body">{senal.totalExpedientesCerrados}</p>
                </div>
                <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
                    <p className="text-sm text-muted">Expedientes escalados</p>
                    <p className="mt-1 text-2xl font-bold text-body">{senal.totalExpedientesEscalados}</p>
                </div>
                <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
                    <p className="text-sm text-muted">Total en los estados agregados</p>
                    <p className="mt-1 text-2xl font-bold text-body">{totalExpedientes}</p>
                </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <BloqueFrecuencia titulo="Categorías frecuentes" registro={senal.categoriasFrecuenciaJson} />
                <BloqueFrecuencia titulo="Plataformas" registro={senal.plataformasJson} />
                <BloqueFrecuencia titulo="Países" registro={senal.paisesJson} />
                <BloqueFrecuencia titulo="Ciudades" registro={senal.ciudadesJson} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
                    <p className="text-sm text-muted">Primera aparición</p>
                    <p className="mt-1 text-sm font-semibold text-body">
                        {hayEventos ? formatoFechaBogota(senal.primeraAparicionEn) : SIN_DATOS}
                    </p>
                </div>
                <div className="rounded-2xl border border-ambar/20 bg-ambar/5 p-4">
                    <p className="text-sm text-muted">Última aparición</p>
                    <p className="mt-1 text-sm font-semibold text-body">
                        {hayEventos ? formatoFechaBogota(senal.ultimaAparicionEn) : SIN_DATOS}
                    </p>
                </div>
            </div>
        </GlassCard>
    );
}

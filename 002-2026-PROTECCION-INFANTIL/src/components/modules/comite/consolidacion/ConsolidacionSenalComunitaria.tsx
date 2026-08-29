// SPEC-237 (002-PI-mega-cola): señal comunitaria agregada del identificador.
// Lenguaje descriptivo/estadístico, nunca veredictos (constitución §1.3).
import type { SenalComunitariaDto } from "./tipos";

function numeroDe(v: unknown): number {
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function conteoPlataformas(plataformasJson: unknown): number | null {
    if (Array.isArray(plataformasJson)) return plataformasJson.length;
    if (plataformasJson && typeof plataformasJson === "object") return Object.keys(plataformasJson).length;
    return null;
}

export function ConsolidacionSenalComunitaria({ senal }: { senal: SenalComunitariaDto | null }) {
    const plataformas = senal ? conteoPlataformas(senal.plataformasJson) : null;
    return (
        <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-body">Señal comunitaria</h3>
            {!senal ? (
                <p className="text-sm text-muted">Sin datos agregados de la comunidad para este identificador.</p>
            ) : (
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-muted">Expedientes activos registrados</dt>
                        <dd className="text-2xl font-bold text-body">{numeroDe(senal.totalExpedientesActivos)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted">Expedientes cerrados</dt>
                        <dd className="text-2xl font-bold text-body">{numeroDe(senal.totalExpedientesCerrados)}</dd>
                    </div>
                    <div>
                        <dt className="text-muted">Expedientes escalados</dt>
                        <dd className="text-2xl font-bold text-body">{numeroDe(senal.totalExpedientesEscalados)}</dd>
                    </div>
                    {plataformas !== null && (
                        <div>
                            <dt className="text-muted">Plataformas con reportes</dt>
                            <dd className="text-2xl font-bold text-body">{plataformas}</dd>
                        </div>
                    )}
                </dl>
            )}
            <p className="text-xs text-muted">
                Estadísticas agregadas de reportes comunitarios. No constituyen un veredicto sobre el identificador.
            </p>
        </section>
    );
}

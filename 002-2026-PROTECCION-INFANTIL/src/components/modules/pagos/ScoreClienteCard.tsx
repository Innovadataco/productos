/**
 * SPEC-220 (002-PI-121): card "Score de valor este mes" de la ficha de cliente
 * (solo ADMIN con grant `pagos_admin`). Componente presentacional: mide uso de
 * la plataforma por un cliente comercial, nunca conducta de personas.
 * Tono neutral, sin voseo; tokens del sistema visual (tinta/body/muted).
 */
import type { ScoreClienteVista } from "@/lib/dal/repositories/analisis-repository";

interface ScoreClienteCardProps {
    actual: ScoreClienteVista | null;
    historico: ScoreClienteVista[];
}

const ETIQUETAS_COMPONENTES = [
    { clave: "reportes", etiqueta: "Reportes" },
    { clave: "casos", etiqueta: "Casos" },
    { clave: "alertas", etiqueta: "Alertas" },
    { clave: "sesiones", etiqueta: "Sesiones" },
] as const;

function formatearNumero(valor: number): string {
    return Number.isInteger(valor) ? String(valor) : valor.toFixed(2);
}

export function ScoreClienteCard({ actual, historico }: ScoreClienteCardProps) {
    return (
        <section aria-label="Score de valor" className="rounded-xl border border-tinta/10 p-6 dark:border-tinta/20">
            <h3 className="text-lg font-semibold text-body">Score de valor este mes</h3>

            {!actual ? (
                <p className="mt-3 text-sm text-muted">
                    Score de valor aún no calculado para este período.
                </p>
            ) : (
                <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                        <span className="text-3xl font-bold text-body">{formatearNumero(actual.scoreTotal)}</span>
                        <span className="text-sm text-muted">Período {actual.periodo}</span>
                        {actual.percentilEnCohorte !== null && (
                            <span className="text-sm text-muted">
                                Percentil en su cohorte: {formatearNumero(actual.percentilEnCohorte)}
                            </span>
                        )}
                    </div>

                    <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        {ETIQUETAS_COMPONENTES.map(({ clave, etiqueta }) => {
                            const componente = actual.componentes[clave];
                            const peso = actual.pesos[clave];
                            return (
                                <div key={clave} className="rounded-lg border border-tinta/10 p-3 dark:border-tinta/20">
                                    <div className="text-muted">{etiqueta}</div>
                                    <div className="mt-1 font-medium text-body">
                                        {componente} × {formatearNumero(peso)} = {formatearNumero(componente * peso)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {historico.length > 0 && (
                <div className="mt-5">
                    <h4 className="mb-2 text-sm font-medium text-muted">Histórico (últimos 12 meses)</h4>
                    <ul className="divide-y divide-tinta/10 text-sm dark:divide-tinta/20">
                        {historico.map((fila) => (
                            <li key={fila.periodo} className="flex items-center justify-between py-2">
                                <span className="text-muted">{fila.periodo}</span>
                                <span className="font-medium text-body">{formatearNumero(fila.scoreTotal)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

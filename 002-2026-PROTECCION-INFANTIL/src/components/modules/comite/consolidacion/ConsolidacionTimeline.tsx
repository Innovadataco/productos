// SPEC-237 (002-PI-mega-cola): línea de tiempo de eventos del expediente.
import { formatearEnBogota } from "@/lib/comite/sla";
import type { EventoExpedienteDto } from "./tipos";

export function ConsolidacionTimeline({ eventos }: { eventos: EventoExpedienteDto[] }) {
    return (
        <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-body">Línea de tiempo</h3>
            {eventos.length === 0 ? (
                <p className="text-sm text-muted">El expediente aún no registra eventos.</p>
            ) : (
                <ol className="relative space-y-4 border-l border-tinta/15 pl-4">
                    {eventos.map((e) => (
                        <li key={e.id} className="space-y-1">
                            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-cielo" aria-hidden />
                            <p className="text-xs text-muted">
                                #{e.ordenSecuencial} · {formatearEnBogota(new Date(e.fecha))}
                                {e.plataforma ? ` · ${e.plataforma}` : ""}
                            </p>
                            <p className="text-sm text-body">{e.descripcion}</p>
                            {e.categoriaDetectada && (
                                <p className="text-xs text-subtle">Categoría detectada: {e.categoriaDetectada}</p>
                            )}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

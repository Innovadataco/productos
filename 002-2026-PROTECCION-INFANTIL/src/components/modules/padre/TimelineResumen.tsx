import type { TimelineHomeItem } from "@/lib/padre/home";

interface TimelineResumenProps {
    eventos: TimelineHomeItem[];
}

export function TimelineResumen({ eventos }: TimelineResumenProps) {
    if (eventos.length === 0) {
        return (
            <div className="glass rounded-3xl p-6 text-center">
                <h2 className="text-lg font-semibold text-body">Eventos recientes</h2>
                <p className="mt-2 text-sm text-muted">No hay eventos registrados en los últimos días.</p>
            </div>
        );
    }

    return (
        <section aria-labelledby="timeline-resumen-titulo" className="glass rounded-3xl p-6">
            <h2 id="timeline-resumen-titulo" className="text-lg font-semibold text-body">
                Eventos recientes
            </h2>
            <ol className="mt-4 space-y-4">
                {eventos.map((evento) => (
                    <li key={evento.id} className="rounded-2xl bg-tinta/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <time className="text-sm font-semibold text-body">
                                {new Date(evento.fechaEvento).toLocaleDateString("es-CO", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </time>
                            {evento.categoria && (
                                <span className="rounded-full bg-tinta/10 px-2.5 py-0.5 text-xs font-semibold text-muted">
                                    {evento.categoria}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-sm text-body">{evento.texto}</p>
                        {evento.contactoEtiqueta && (
                            <p className="mt-2 text-xs text-muted">Contacto: {evento.contactoEtiqueta}</p>
                        )}
                    </li>
                ))}
            </ol>
        </section>
    );
}

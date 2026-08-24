import { LABELS_ESTADO } from "@/lib/padre/expediente-ui";

interface EventoItem {
    id: string;
    ordenSecuencial: number;
    fechaEvento: Date;
    texto: string;
    categoriaDetectada: string | null;
    confianzaClasificacion: number | null;
    plataforma: string | null;
}

export function TimelineEventos({ eventos }: { eventos: EventoItem[] }) {
    if (eventos.length === 0) {
        return (
            <div className="glass rounded-2xl p-6 text-center">
                <p className="text-muted">Aún no hay eventos registrados en este expediente.</p>
            </div>
        );
    }

    return (
        <ol className="relative space-y-6 border-l border-slate-200 dark:border-slate-700">
            {eventos.map((evento) => (
                <li key={evento.id} className="ml-6">
                    <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800 ring-8 ring-white dark:bg-sky-900 dark:text-sky-200 dark:ring-slate-950">
                        {evento.ordenSecuencial}
                    </span>
                    <div className="glass rounded-2xl p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <time className="text-sm font-semibold text-body">
                                {new Date(evento.fechaEvento).toLocaleDateString("es-CO", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </time>
                            {evento.categoriaDetectada && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                    {evento.categoriaDetectada}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-sm text-body">{evento.texto}</p>
                        {evento.plataforma && (
                            <p className="mt-2 text-xs text-muted">Plataforma: {evento.plataforma}</p>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}

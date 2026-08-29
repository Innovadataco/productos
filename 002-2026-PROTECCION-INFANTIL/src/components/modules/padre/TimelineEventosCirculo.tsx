"use client";

import { TimelineEventoItem } from "./TimelineEventoItem";
import type { TimelineEvento } from "@/lib/padre/timeline-circulo";

interface TimelineEventosCirculoProps {
    eventos: TimelineEvento[];
    titulo?: string;
}

export function TimelineEventosCirculo({
    eventos,
    titulo = "Actividad reciente de tu círculo",
}: TimelineEventosCirculoProps) {
    if (eventos.length === 0) {
        return (
            <section aria-labelledby="timeline-circulo-titulo" className="glass rounded-3xl p-6 text-center">
                <h2 id="timeline-circulo-titulo" className="text-lg font-semibold text-body">
                    {titulo}
                </h2>
                <p className="mt-2 text-sm text-muted">
                    No hay eventos registrados en los últimos 30 días. Tu círculo de confianza está tranquilo.
                </p>
            </section>
        );
    }

    return (
        <section aria-labelledby="timeline-circulo-titulo">
            <h2 id="timeline-circulo-titulo" className="text-lg font-semibold text-body">
                {titulo}
            </h2>
            <ol className="relative mt-4 space-y-6 border-l border-tinta/15">
                {eventos.map((evento, indice) => (
                    <li key={evento.id} className="ml-6">
                        <span
                            className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-cielo/15 text-xs font-semibold text-cielo ring-8 ring-papel"
                            aria-hidden="true"
                        >
                            {eventos.length - indice}
                        </span>
                        <TimelineEventoItem {...evento} />
                    </li>
                ))}
            </ol>
        </section>
    );
}

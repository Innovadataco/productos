"use client";

/**
 * SPEC-222 (002-PI-123, US-1, FR-014): bloque "Tu top 5 hoy" — cards grandes
 * con acción destacada (patrón notificación accionable del brief §4). Las
 * acciones transicionan la recomendación vía el endpoint de resolución;
 * `datosContexto` puede aportar contacto (enlaces tel:/mailto:).
 */
import { useState } from "react";
import type { TopDecision } from "./tipos";

interface Bloque<T> {
    data: T | null;
    cargando: boolean;
    error: string | null;
}

export function TopDecisiones({
    bloque,
    onResolver,
}: {
    bloque: Bloque<TopDecision[]>;
    onResolver: (id: string, accion: "APLICADA" | "IGNORADA") => Promise<void>;
}) {
    const [resolviendoId, setResolviendoId] = useState<string | null>(null);

    const resolver = async (id: string, accion: "APLICADA" | "IGNORADA") => {
        setResolviendoId(id);
        try {
            await onResolver(id, accion);
        } finally {
            setResolviendoId(null);
        }
    };

    return (
        <section className="glass rounded-3xl p-6" aria-label="Top 5 decisiones de hoy">
            <div className="mb-4">
                <h2 className="text-base font-semibold text-body">Tu top 5 hoy</h2>
                <p className="text-xs text-muted">Las decisiones de mayor prioridad según las reglas activas.</p>
            </div>

            {bloque.cargando && !bloque.data ? (
                <p className="text-sm text-muted">Cargando decisiones...</p>
            ) : bloque.error ? (
                <p className="text-sm text-muted">No se pudieron cargar las decisiones: {bloque.error}</p>
            ) : !bloque.data || bloque.data.length === 0 ? (
                <p className="rounded-xl border border-tinta/10 p-4 text-sm text-muted">
                    Sin decisiones pendientes hoy.
                </p>
            ) : (
                <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {bloque.data.map((rec) => (
                        <li key={rec.id} className="rounded-2xl border border-tinta/10 bg-papel/60 p-5">
                            <div className="mb-2 flex items-start justify-between gap-3">
                                <h3 className="text-sm font-semibold text-body">{rec.titulo}</h3>
                                <span className="shrink-0 rounded-full bg-ambar/10 px-2.5 py-0.5 text-xs font-medium text-estado-ambar dark:bg-ambar/20 dark:text-ambar">
                                    {rec.categoria}
                                </span>
                            </div>
                            <p className="mb-4 text-sm text-muted">{rec.descripcion}</p>

                            {(rec.contacto?.telefono || rec.contacto?.email) && (
                                <div className="mb-3 flex flex-wrap gap-3 text-sm">
                                    {rec.contacto.telefono && (
                                        <a
                                            href={`tel:${rec.contacto.telefono}`}
                                            className="font-medium text-cielo underline hover:text-primary-700"
                                        >
                                            Llamar
                                        </a>
                                    )}
                                    {rec.contacto.email && (
                                        <a
                                            href={`mailto:${rec.contacto.email}`}
                                            className="font-medium text-cielo underline hover:text-primary-700"
                                        >
                                            Escribir
                                        </a>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={resolviendoId === rec.id}
                                    onClick={() => void resolver(rec.id, "APLICADA")}
                                    className="rounded-lg bg-pino px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-700 disabled:opacity-50"
                                >
                                    Marcar como aplicada
                                </button>
                                <button
                                    type="button"
                                    disabled={resolviendoId === rec.id}
                                    onClick={() => void resolver(rec.id, "IGNORADA")}
                                    className="rounded-lg border border-tinta/20 px-4 py-2 text-sm font-medium text-muted transition hover:bg-tinta/5 hover:text-body disabled:opacity-50"
                                >
                                    Ignorar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

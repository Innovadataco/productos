"use client";

/**
 * A-70 · F10 — la bitácora del menor.
 *
 * Responde la pregunta que Jelkin puso como valor de esta pantalla: "¿desde
 * cuándo se está monitoreando?". Cada hito con su fecha y hora; el más antiguo
 * arriba, porque la historia se lee hacia adelante.
 */
import { useCallback, useEffect, useState } from "react";
import { fechaHora } from "@/lib/format/fecha";

interface Hito {
    tipo: string;
    fecha: string;
    descripcion: string;
    identificador?: string;
}

interface BitacoraDto {
    nombre: string;
    monitoreadoDesde: string | null;
    hitos: Hito[];
}

/** Verde = protección activa · gris = pausada (regla 2 del brief A-70: nunca rojo). */
function colorDelHito(tipo: string): string {
    if (tipo.endsWith("_inactivado")) return "bg-tinta/25 dark:bg-papel/25";
    return "bg-pino";
}

export function BitacoraMenor({ hijoId }: { hijoId: string }) {
    const [datos, setDatos] = useState<BitacoraDto | null>(null);
    const [error, setError] = useState("");

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`/api/padre/hijos/${hijoId}/bitacora`, { credentials: "include" });
            if (!res.ok) throw new Error("No pudimos cargar la bitácora.");
            setDatos(await res.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos cargar la bitácora.");
        }
    }, [hijoId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    if (error) {
        return <p className="text-sm text-muted">{error}</p>;
    }
    if (!datos) {
        return <p className="text-sm text-muted">Cargando la bitácora…</p>;
    }

    return (
        <section className="rounded-2xl border border-tinta/10 bg-papel/60 p-4 dark:border-papel/10 dark:bg-tinta/40">
            <h2 className="font-medium text-body">Bitácora de {datos.nombre}</h2>
            {datos.monitoreadoDesde && (
                <p className="mt-1 text-sm text-muted">
                    Lo estás cuidando desde el <strong>{fechaHora(datos.monitoreadoDesde)}</strong>.
                </p>
            )}

            {datos.hitos.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Aún no hay movimientos que mostrar.</p>
            ) : (
                <ol className="mt-3 space-y-3">
                    {datos.hitos.map((h, i) => (
                        <li key={`${h.tipo}-${h.fecha}-${i}`} className="flex gap-3">
                            <span className="mt-1.5 flex flex-col items-center">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${colorDelHito(h.tipo)}`} />
                                {i < datos.hitos.length - 1 && (
                                    <span className="mt-1 w-px grow bg-tinta/15 dark:bg-papel/15" aria-hidden="true" />
                                )}
                            </span>
                            <span className="pb-1">
                                <span className="block text-sm text-body">{h.descripcion}</span>
                                <span className="block text-xs text-muted">{fechaHora(h.fecha)}</span>
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}

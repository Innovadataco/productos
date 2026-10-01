"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-832 (pieza 2) · El «a QUIÉN va» §1-bis + la acción «Reasignar a {B}» (dos pasos: elegir B → su turno
 * → confirmar). Muestra el calce PARCIAL a la vista (qué comparte / qué no cubre) — nunca «lo que la familia
 * necesitaba». NUNCA un control de cancelar.
 *
 * El rechazo por caducidad entre ver y confirmar (B dejó de ser ofrecible) llega del server como MENSAJE y
 * se muestra; no es un 500 mudo (el service re-chequea REPS por modalidad). Al éxito, `router.refresh()`
 * re-arma la cola (la cita reubicada sale; si B queda sin turno, deja de ofrecerse).
 */
export interface TurnoElegible {
    id: string;
    /** Etiqueta ya formateada en America/Bogota por el servidor (Date no cruza bien el borde RSC). */
    etiqueta: string;
}

export interface CandidatoVista {
    profesionalId: string;
    nombreVisible: string;
    especialidadesCompartidas: string[];
    especialidadesNoCubiertas: string[];
    turnos: TurnoElegible[];
}

export function ReubicarAccion({
    citaId,
    nombreSaliente,
    candidatos,
}: {
    citaId: string;
    nombreSaliente: string;
    candidatos: CandidatoVista[];
}) {
    const router = useRouter();
    const [enviando, setEnviando] = useState<string | null>(null); // `${profesionalId}:${turnoId}`
    const [error, setError] = useState<string | null>(null);

    async function reasignar(profesionalId: string, franjaId: string, nombreB: string) {
        if (!window.confirm(`¿Reasignar esta cita a ${nombreB}?`)) return;
        setError(null);
        setEnviando(`${profesionalId}:${franjaId}`);
        try {
            const res = await fetch(`/api/admin/reubicaciones/${citaId}/reasignar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nuevoProfesionalId: profesionalId, nuevaFranjaId: franjaId }),
            });
            if (!res.ok) {
                // El mensaje del server (p. ej. «no disponible» por caducidad entre ver y confirmar), NO un 500 mudo.
                const cuerpo = await res.json().catch(() => null);
                setError(cuerpo?.error ?? "No se pudo reasignar. Intente de nuevo.");
                setEnviando(null);
                return;
            }
            router.refresh();
        } catch {
            setError("No se pudo reasignar. Revise la conexión e intente de nuevo.");
            setEnviando(null);
        }
    }

    return (
        <div className="mt-3 border-t border-ambar/30 pt-3">
            {error ? (
                <p className="mb-2 text-sm font-medium text-estado-ambar" role="alert">
                    {error}
                </p>
            ) : null}
            <ul className="space-y-3">
                {candidatos.map((c) => {
                    const cubreTodo = c.especialidadesNoCubiertas.length === 0;
                    return (
                        <li key={c.profesionalId} className="rounded-lg border border-ambar/30 p-3">
                            <p className="text-sm font-semibold">{c.nombreVisible}</p>
                            {cubreTodo ? (
                                <p className="mt-0.5 text-sm">Comparte todo lo que atendía {nombreSaliente}.</p>
                            ) : (
                                <>
                                    {c.especialidadesCompartidas.length > 0 ? (
                                        <p className="mt-0.5 text-sm">
                                            Comparte con {nombreSaliente}: {c.especialidadesCompartidas.join(" · ")}
                                        </p>
                                    ) : null}
                                    <p className="text-sm">
                                        {nombreSaliente} también atendía: {c.especialidadesNoCubiertas.join(" · ")}
                                    </p>
                                </>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                                {c.turnos.map((t) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        disabled={enviando !== null}
                                        onClick={() => reasignar(c.profesionalId, t.id, c.nombreVisible)}
                                        className="min-h-11 rounded-2xl border border-ambar/40 px-4 py-2 text-sm font-semibold transition hover:bg-ambar/10 disabled:opacity-50"
                                    >
                                        {enviando === `${c.profesionalId}:${t.id}` ? "Reasignando…" : `Reasignar a ${c.nombreVisible} · ${t.etiqueta}`}
                                    </button>
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

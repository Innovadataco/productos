"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-425 (A-75 · L5) · Los DOS botones que tienen motor.
 *
 * `Confirmar` → `confirmarPorProfesional` · `No puedo` → `rechazarPorProfesional`,
 * los dos de L4. El mockup dibuja además «Proponer otro horario», pero esa
 * acción **no existe** en el motor —`reprogramarPorPadre` es del padre— así que
 * no se pinta. Un botón que no hace nada es la misma clase de defecto que
 * cerramos hoy tres veces (I-289, I-290, I-297).
 */
export function SolicitudAcciones({ solicitudId }: { solicitudId: string }) {
    const router = useRouter();
    const [enCurso, setEnCurso] = useState<"confirmar" | "rechazar" | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function ejecutar(accion: "confirmar" | "rechazar") {
        setEnCurso(accion);
        setError(null);
        try {
            const res = await fetch(`/api/profesional/solicitudes/${solicitudId}/${accion}`, {
                method: "PATCH",
                credentials: "include",
            });
            if (!res.ok) {
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                // Se muestra la causa real, no un "error interno" (lección de I-287).
                setError(cuerpo?.error?.message ?? `No se pudo ${accion} (HTTP ${res.status}).`);
                return;
            }
            router.refresh();
        } catch (e) {
            console.error("[SolicitudAcciones]", e);
            setError("No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.");
        } finally {
            setEnCurso(null);
        }
    }

    return (
        <div className="mt-3">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => void ejecutar("confirmar")}
                    disabled={enCurso !== null}
                    className="rounded-xl bg-pino px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                    {enCurso === "confirmar" ? "Confirmando…" : "Confirmar"}
                </button>
                <button
                    type="button"
                    onClick={() => void ejecutar("rechazar")}
                    disabled={enCurso !== null}
                    className="rounded-xl border border-tinta/15 px-3 py-1.5 text-xs font-medium text-body transition hover:bg-tinta/5 disabled:opacity-50"
                >
                    {enCurso === "rechazar" ? "Avisando…" : "No puedo"}
                </button>
            </div>
            {error && (
                <p role="alert" className="mt-2 text-xs text-ambar">
                    {error}
                </p>
            )}
        </div>
    );
}

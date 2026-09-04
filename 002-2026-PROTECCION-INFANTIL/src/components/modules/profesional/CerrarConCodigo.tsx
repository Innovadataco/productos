"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * SPEC-427 (A-75 · L6 · brief §9 momento 6) · el cierre de la cita.
 *
 * El padre le dicta seis dígitos al profesional durante la sesión; el
 * profesional los escribe acá. Si coinciden, la cita queda cumplida.
 *
 * SPEC-425 dejó este lugar vacío a propósito —«cerrar la cita todavía no está
 * disponible»— porque no existía quién escribiera `CUMPLIDA`. Ahora existe, y
 * su candado lo obligó a volver a esta pantalla.
 */
export function CerrarConCodigo({ solicitudId }: { solicitudId: string }) {
    const router = useRouter();
    const [codigo, setCodigo] = useState("");
    const [enCurso, setEnCurso] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [listo, setListo] = useState(false);
    const [inasistencia, setInasistencia] = useState(false);

    const completo = /^\d{6}$/.test(codigo);

    async function declararInasistencia() {
        setEnCurso(true);
        setError(null);
        try {
            const res = await fetch(`/api/profesional/citas/${solicitudId}/no-asistio`, {
                method: "POST",
                credentials: "include",
            });
            if (!res.ok) {
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                setError(cuerpo?.error?.message ?? `No se pudo registrar (HTTP ${res.status}).`);
                return;
            }
            setInasistencia(true);
            router.refresh();
        } catch (e) {
            console.error("[CerrarConCodigo/no-asistio]", e);
            setError("No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.");
        } finally {
            setEnCurso(false);
        }
    }

    async function enviar() {
        setEnCurso(true);
        setError(null);
        try {
            const res = await fetch(`/api/profesional/citas/${solicitudId}/cerrar`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo }),
            });
            if (!res.ok) {
                const cuerpo = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
                // La causa real, nunca un "error interno" (I-287): acá el motivo
                // le dice al profesional qué hacer — pedirle otro código al padre.
                setError(cuerpo?.error?.message ?? `No se pudo cerrar la cita (HTTP ${res.status}).`);
                return;
            }
            setListo(true);
            router.refresh();
        } catch (e) {
            console.error("[CerrarConCodigo]", e);
            setError("No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.");
        } finally {
            setEnCurso(false);
        }
    }

    if (inasistencia) {
        return (
            <p className="anim-entrada mt-3 text-xs text-body">
                Quedó registrado que la familia no se presentó. Le avisamos al padre; si él lo ve distinto,
                lo dirá en su encuesta y lo revisamos.
            </p>
        );
    }

    if (listo) {
        return (
            <p className="anim-entrada mt-3 flex items-center gap-2 text-xs text-body">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
                    <path
                        d="M3 8.5 6.5 12 13 4.5"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
                Cita cerrada. Queda constancia de que la sesión ocurrió.
            </p>
        );
    }

    return (
        <form
            className="mt-3"
            onSubmit={(e) => {
                e.preventDefault();
                if (completo && !enCurso) void enviar();
            }}
        >
            <label htmlFor={`codigo-${solicitudId}`} className="microetiqueta">
                Código de la cita
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
                <input
                    id={`codigo-${solicitudId}`}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    aria-describedby={`ayuda-${solicitudId}`}
                    className="cifra w-28 rounded-xl border border-tinta/15 bg-transparent px-3 py-1.5 text-sm tracking-[0.3em] text-body outline-none transition focus:border-pino"
                />
                <button
                    type="submit"
                    disabled={!completo || enCurso}
                    className="rounded-xl bg-pino px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                    {enCurso ? "Cerrando…" : "Cerrar cita"}
                </button>
                <button
                    type="button"
                    onClick={() => void declararInasistencia()}
                    disabled={enCurso}
                    className="rounded-xl border border-tinta/15 px-3 py-1.5 text-xs font-medium text-body transition hover:bg-tinta/5 disabled:opacity-40"
                >
                    No se presentó
                </button>
            </div>
            <p id={`ayuda-${solicitudId}`} className="mt-1 text-xs text-subtle">
                Te lo dicta el padre en la sesión. Vence a los 30 minutos; si se le pasó, puede pedir otro.
            </p>
            {error && (
                <p role="alert" className="mt-2 text-xs text-ambar">
                    {error}
                </p>
            )}
        </form>
    );
}

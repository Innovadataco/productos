"use client";
/**
 * SPEC-429 (A-75 · brief §9-bis) · Formulario de encuesta post-cita (padre
 * o profesional). Sin estrellas ni texto libre — todo opción única.
 *
 * Se usa desde `/encuesta` (guardia) y desde el panel del profesional
 * (sección propia, montaje de una línea).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DefinicionPregunta } from "@/lib/profesional/cita/encuestas-preguntas";

type Origen = "PADRE" | "PROFESIONAL";

interface Props {
    solicitudId: string;
    origen: Origen;
    preguntas: readonly DefinicionPregunta[];
    titulo: string;
    explicacion?: string;
    onCompletado?: () => void;
}

export function EncuestaFormulario({
    solicitudId,
    origen,
    preguntas,
    titulo,
    explicacion,
    onCompletado,
}: Props) {
    const router = useRouter();
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const completa = preguntas.every((p) => Boolean(respuestas[p.id]));

    async function enviar() {
        if (!completa) return;
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch("/api/encuesta", {
                method: "POST",
                credentials: "include",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ solicitudId, origen, respuestas }),
            });
            const json = (await res.json().catch(() => ({}))) as {
                data?: unknown;
                error?: { message?: string };
            };
            if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
            // Refrescamos: si al usuario le queda otra encuesta, la próxima carga
            // la trae; si no, la guardia baja tras el re-sello de sesión.
            onCompletado?.();
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setEnviando(false);
        }
    }

    return (
        <section className="mx-auto max-w-2xl p-4 sm:p-6 space-y-5 anim-entrada">
            <header>
                <h1 className="font-serif text-2xl text-body">{titulo}</h1>
                {explicacion && <p className="cuerpo text-subtle mt-1">{explicacion}</p>}
            </header>

            {preguntas.map((p) => (
                <fieldset key={p.id} className="glass rounded-2xl p-4 space-y-3">
                    <legend className="titular-seccion">{p.enunciado}</legend>
                    <div className="grid gap-2">
                        {p.opciones.map((o) => {
                            const seleccionada = respuestas[p.id] === o.key;
                            return (
                                <label
                                    key={o.key}
                                    className={`flex items-center gap-2 rounded-xl border p-3 text-sm cursor-pointer transition ${
                                        seleccionada
                                            ? "border-cielo bg-cielo/10 text-body"
                                            : "border-tinta/10 bg-tinta/5 text-body hover:bg-tinta/10"
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name={p.id}
                                        value={o.key}
                                        checked={seleccionada}
                                        onChange={() => setRespuestas((r) => ({ ...r, [p.id]: o.key }))}
                                        className="mt-0"
                                    />
                                    <span>{o.label}</span>
                                </label>
                            );
                        })}
                    </div>
                </fieldset>
            ))}

            {error && <p className="text-sm text-estado-rubi">{error}</p>}

            <button
                type="button"
                disabled={!completa || enviando}
                onClick={() => void enviar()}
                className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${
                    completa && !enviando
                        ? "bg-pino hover:bg-pino/90"
                        : "bg-tinta/30 cursor-not-allowed"
                }`}
            >
                {enviando ? "Enviando…" : "Enviar respuestas"}
            </button>
        </section>
    );
}

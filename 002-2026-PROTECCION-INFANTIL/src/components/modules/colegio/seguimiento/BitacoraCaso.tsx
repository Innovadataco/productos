"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { NotaCasoVista } from "@/lib/colegio/seguimiento";

/**
 * SPEC-159 (US3, FR-004/FR-005) — Bitácora del caso: "registrar lo actuado".
 * Las notas son INMUTABLES (respaldo forense, Ley 1581): se listan con fecha y
 * autor legible, sin edición ni borrado — ni siquiera hay verbo para ello.
 * Texto plano 1..1000 (Zod en el servidor; React escapa al renderizar).
 */

const MAX_NOTA = 1000;

interface BitacoraCasoProps {
    alertaId: string;
    notas: NotaCasoVista[];
}

function fechaLegible(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export function BitacoraCaso({ alertaId, notas }: BitacoraCasoProps) {
    const router = useRouter();
    const [texto, setTexto] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);

    async function publicar() {
        const limpio = texto.trim();
        if (limpio.length === 0 || enviando) return;
        setEnviando(true);
        setAviso(null);
        try {
            const res = await fetch(`/api/colegio/alertas/${alertaId}/notas`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: limpio }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setAviso({ tipo: "error", mensaje: data?.error?.message || "No pudimos registrar la nota." });
                return;
            }
            setTexto("");
            setAviso({ tipo: "exito", mensaje: "Nota registrada en la bitácora." });
            router.refresh();
        } catch {
            setAviso({ tipo: "error", mensaje: "Error de red registrando la nota." });
        } finally {
            setEnviando(false);
        }
    }

    return (
        <section
            id="bitacora"
            aria-label="Bitácora del caso"
            className="glass rounded-[var(--radio-card)] p-6 sm:p-8"
        >
            <h2 className="titular-seccion text-body">Bitácora — registrar lo actuado</h2>
            <p className="cuerpo mt-1 text-muted">
                Anota lo que hiciste con fecha y hora. Las notas no se pueden editar ni borrar: quedan como
                respaldo del colegio.
            </p>

            {notas.length > 0 ? (
                <ol className="mt-4 space-y-3">
                    {notas.map((nota) => (
                        <li key={nota.id} className="rounded-xl bg-papel/60 p-4 ring-1 ring-tinta/10">
                            <p className="whitespace-pre-wrap text-sm text-body">{nota.texto}</p>
                            <p className="microetiqueta mt-2">
                                {nota.autor} · {fechaLegible(nota.creadoEn)}
                            </p>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="cuerpo mt-4 text-subtle">Aún no hay notas registradas.</p>
            )}

            <div className="mt-5">
                <label htmlFor="texto-nota" className="microetiqueta block">
                    Nueva nota
                </label>
                <textarea
                    id="texto-nota"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={MAX_NOTA}
                    rows={3}
                    placeholder="Ej.: llamé a la acudiente, citada para el jueves"
                    className="mt-1 w-full rounded-xl bg-papel/60 p-3 text-sm text-body ring-1 ring-tinta/10 placeholder:text-subtle focus:outline-none focus:ring-accent"
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="microetiqueta">
                        {texto.length}/{MAX_NOTA}
                    </p>
                    <Button
                        className="min-h-12"
                        isLoading={enviando}
                        disabled={texto.trim().length === 0}
                        onClick={publicar}
                    >
                        Registrar en la bitácora
                    </Button>
                </div>
                {aviso ? (
                    <p className={`mt-2 text-sm ${aviso.tipo === "exito" ? "text-estado-pino" : "text-estado-rubi"}`}>
                        {aviso.mensaje}
                    </p>
                ) : null}
            </div>
        </section>
    );
}

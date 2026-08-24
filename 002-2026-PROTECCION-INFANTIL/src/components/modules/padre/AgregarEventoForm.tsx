"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

interface AgregarEventoFormProps {
    expedienteId: string;
    onCancel: () => void;
    onSuccess: () => void;
}

export function AgregarEventoForm({ expedienteId, onCancel, onSuccess }: AgregarEventoFormProps) {
    const [texto, setTexto] = useState("");
    const [plataforma, setPlataforma] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState("");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!texto.trim()) {
            setError("El texto es obligatorio.");
            return;
        }
        if (texto.length > 2000) {
            setError("El texto no puede superar 2000 caracteres.");
            return;
        }

        setEnviando(true);
        try {
            const res = await fetch(`/api/padre/expedientes/${expedienteId}/eventos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texto: texto.trim(),
                    plataforma: plataforma.trim() || undefined,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error?.message ?? "Error al agregar el evento");
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setEnviando(false);
        }
    }

    return (
        <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-body">Nueva situación</h3>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                    <label htmlFor="texto" className="block text-sm font-semibold text-body">
                        ¿Qué pasó?
                    </label>
                    <textarea
                        id="texto"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        rows={4}
                        maxLength={2000}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white/80 p-3 text-sm text-body shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:border-slate-700 dark:bg-slate-900/60"
                        placeholder="Describe la nueva situación..."
                        disabled={enviando}
                    />
                    <p className="mt-1 text-xs text-muted">{texto.length}/2000</p>
                </div>
                <div>
                    <label htmlFor="plataforma" className="block text-sm font-semibold text-body">
                        Plataforma (opcional)
                    </label>
                    <input
                        id="plataforma"
                        type="text"
                        value={plataforma}
                        onChange={(e) => setPlataforma(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white/80 p-3 text-sm text-body shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 dark:border-slate-700 dark:bg-slate-900/60"
                        placeholder="Instagram, WhatsApp, TikTok..."
                        disabled={enviando}
                    />
                </div>
                {error && <p className="text-sm text-rubi">{error}</p>}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={enviando}
                        className="rounded-xl accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-50"
                    >
                        {enviando ? "Guardando..." : "Guardar evento"}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={enviando}
                        className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-body transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </GlassCard>
    );
}

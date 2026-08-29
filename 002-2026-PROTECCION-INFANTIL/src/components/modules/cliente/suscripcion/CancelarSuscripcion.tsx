"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";

const FRASE_CONFIRMACION = "CANCELAR";

/**
 * SPEC-211 (002-PI-111): bloque 7 — cancelar suscripción con triple
 * confirmación (AS-006): (1) botón inicial, (2) aceptación explícita del
 * aviso, (3) escritura de la frase de confirmación. Borrado lógico: los datos
 * se preservan.
 */
export function CancelarSuscripcion({
    suscripcionId,
    estadoActual,
}: {
    suscripcionId: string;
    estadoActual: string;
}) {
    const router = useRouter();
    const [paso, setPaso] = useState<0 | 1 | 2>(0);
    const [aceptaAviso, setAceptaAviso] = useState(false);
    const [frase, setFrase] = useState("");
    const [motivo, setMotivo] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (estadoActual === "CANCELADA") {
        return (
            <GlassCard data-testid="bloque-cancelar" className="p-6">
                <h2 className="text-lg font-bold text-body">Cancelar suscripción</h2>
                <p className="mt-3 text-sm text-muted">
                    Tu suscripción está cancelada. Tus datos se conservan por si decides volver.
                </p>
            </GlassCard>
        );
    }

    async function confirmar() {
        setCargando(true);
        setError(null);
        try {
            const res = await fetch("/api/pagos/suscripcion/cancelar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    suscripcionId,
                    ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
                }),
            });
            if (!res.ok) {
                try {
                    const json = (await res.json()) as { error?: { message?: string } };
                    setError(json.error?.message ?? "No se pudo cancelar la suscripción");
                } catch {
                    setError("No se pudo cancelar la suscripción");
                }
                return;
            }
            router.refresh();
        } finally {
            setCargando(false);
        }
    }

    return (
        <GlassCard data-testid="bloque-cancelar" className="border border-rubi/20 p-6">
            <h2 className="text-lg font-bold text-body">Cancelar suscripción</h2>

            {paso === 0 && (
                <div className="mt-3">
                    <p className="text-sm text-muted">
                        Puedes cancelar en cualquier momento. Tus datos y tu historial se conservan.
                    </p>
                    <button
                        type="button"
                        onClick={() => setPaso(1)}
                        className="mt-4 inline-flex items-center justify-center rounded-xl border border-rubi/40 px-5 py-2.5 text-sm font-semibold text-rubi transition hover:bg-rubi/10"
                    >
                        Quiero cancelar mi suscripción
                    </button>
                </div>
            )}

            {paso === 1 && (
                <div className="mt-3 space-y-4">
                    <p className="rounded-xl bg-rubi/10 px-4 py-3 text-sm text-body">
                        Al cancelar, tu acceso terminará al final de la vigencia ya pagada y no se programarán nuevos
                        cobros. Esta acción no se puede deshacer desde aquí.
                    </p>
                    <label className="flex items-start gap-3 text-sm text-body">
                        <input
                            type="checkbox"
                            checked={aceptaAviso}
                            onChange={(e) => setAceptaAviso(e.target.checked)}
                            className="mt-1 h-4 w-4"
                        />
                        Entiendo las consecuencias y deseo continuar con la cancelación.
                    </label>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={() => setPaso(2)}
                            disabled={!aceptaAviso}
                            className="inline-flex items-center justify-center rounded-xl bg-rubi px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            Continuar
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPaso(0);
                                setAceptaAviso(false);
                            }}
                            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-muted transition hover:text-body"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            )}

            {paso === 2 && (
                <div className="mt-3 space-y-4">
                    <div>
                        <label htmlFor="motivo-cancelacion" className="block text-sm font-medium text-body">
                            Motivo (opcional)
                        </label>
                        <textarea
                            id="motivo-cancelacion"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            maxLength={500}
                            rows={2}
                            className="glass-input mt-1.5 w-full rounded-xl px-4 py-2.5 text-sm text-body placeholder:text-subtle"
                            placeholder="Cuéntanos por qué cancelas (opcional)"
                        />
                    </div>
                    <div>
                        <label htmlFor="frase-cancelacion" className="block text-sm font-medium text-body">
                            Escribe <span className="font-mono font-bold">{FRASE_CONFIRMACION}</span> para confirmar
                        </label>
                        <input
                            id="frase-cancelacion"
                            type="text"
                            value={frase}
                            onChange={(e) => setFrase(e.target.value)}
                            autoComplete="off"
                            className="glass-input mt-1.5 w-full max-w-xs rounded-xl px-4 py-2.5 text-sm text-body placeholder:text-subtle"
                        />
                    </div>
                    {error && (
                        <p role="alert" className="text-sm font-medium text-rubi">
                            {error}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={confirmar}
                            disabled={cargando || frase.trim().toUpperCase() !== FRASE_CONFIRMACION}
                            className="inline-flex items-center justify-center rounded-xl bg-rubi px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {cargando ? "Cancelando…" : "Confirmar cancelación"}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setPaso(0);
                                setAceptaAviso(false);
                                setFrase("");
                                setError(null);
                            }}
                            className="inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-muted transition hover:text-body"
                        >
                            Volver
                        </button>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}

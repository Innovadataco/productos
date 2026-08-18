"use client";

/* SPEC-173 (H01/H06): "Resolver aquí" — el rector documenta qué hizo con el
 * caso (nota obligatoria en la bitácora vía POST /notas, que NO cambia estado)
 * y luego la alerta pasa a "gestionada" vía PATCH /estado. */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ResolverAlertaModalProps {
    isOpen: boolean;
    alertaId: string | null;
    onClose: () => void;
    onResuelta: (alertaId: string, estado: string) => void;
}

export function ResolverAlertaModal({ isOpen, alertaId, onClose, onResuelta }: ResolverAlertaModalProps) {
    const [nota, setNota] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cerrar = () => {
        setNota("");
        setError(null);
        onClose();
    };

    const enviar = async () => {
        if (!alertaId) return;
        const limpio = nota.trim();
        if (limpio.length === 0) {
            setError("Escribe lo que hiciste antes de registrarlo");
            return;
        }
        if (limpio.length > 1000) {
            setError("La nota no puede superar 1000 caracteres");
            return;
        }
        setEnviando(true);
        setError(null);
        try {
            // 1) La nota queda en la bitácora del caso (inmutable).
            const resNota = await fetch(`/api/colegio/alertas/${alertaId}/notas`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: limpio }),
            });
            const dataNota = await resNota.json().catch(() => ({}));
            if (!resNota.ok) {
                setError(dataNota?.error?.message || "No pudimos registrar la nota");
                return;
            }
            // 2) La alerta pasa a gestionada.
            const resEstado = await fetch(`/api/colegio/alertas/${alertaId}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: "gestionada" }),
            });
            const dataEstado = await resEstado.json().catch(() => ({}));
            if (!resEstado.ok) {
                setError(
                    dataEstado?.error?.message ||
                        "La nota quedó registrada, pero no pudimos marcar la alerta como gestionada"
                );
                return;
            }
            onResuelta(alertaId, dataEstado?.alerta?.estado ?? "gestionada");
            cerrar();
        } catch {
            setError("Error de red al resolver la alerta");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={cerrar} title="Resolver aquí">
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    Resuelve el caso en el colegio, sin comité. Cuenta qué hiciste: la nota queda
                    en la bitácora del caso y la alerta pasa a Gestionada.
                </p>
                <div>
                    <label htmlFor="nota-resolucion" className="mb-1 block text-sm font-medium text-body">
                        Qué hiciste con este caso
                    </label>
                    <textarea
                        id="nota-resolucion"
                        className="min-h-28 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm text-body focus:border-emerald-500 focus:outline-none dark:border-slate-700"
                        maxLength={1000}
                        placeholder="Ej.: hablé con el estudiante y su acudiente; quedaron citados a seguimiento la próxima semana"
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted">{nota.trim().length}/1000</p>
                </div>
                {error && (
                    <div
                        role="alert"
                        className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200"
                    >
                        {error}
                    </div>
                )}
                <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={cerrar} disabled={enviando}>
                        Cancelar
                    </Button>
                    <Button onClick={() => void enviar()} isLoading={enviando} disabled={nota.trim().length === 0}>
                        Resolver aquí
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default ResolverAlertaModal;

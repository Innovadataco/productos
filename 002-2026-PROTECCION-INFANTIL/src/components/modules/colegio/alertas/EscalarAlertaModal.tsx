"use client";

/* SPEC-173 (H01/H06): escalar exige motivo — el botón individual antes hacía
 * POST sin body y `escalarAlertaSchema` (motivo min 1) respondía siempre 400.
 * Este modal captura el motivo (trim, 1..2000) y lo envía en el body JSON. */

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface EscalarAlertaModalProps {
    isOpen: boolean;
    alertaId: string | null;
    onClose: () => void;
    onEscalada: (alertaId: string, estado: string) => void;
}

export function EscalarAlertaModal({ isOpen, alertaId, onClose, onEscalada }: EscalarAlertaModalProps) {
    const [motivo, setMotivo] = useState("");
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cerrar = () => {
        setMotivo("");
        setError(null);
        onClose();
    };

    const enviar = async () => {
        if (!alertaId) return;
        const limpio = motivo.trim();
        if (limpio.length === 0) {
            setError("Escribe el motivo del escalamiento");
            return;
        }
        if (limpio.length > 2000) {
            setError("El motivo no puede superar 2000 caracteres");
            return;
        }
        setEnviando(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/alertas/${alertaId}/escalar`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: limpio }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                if (res.status === 409) {
                    setError(data?.error?.message || "Esta alerta ya fue escalada al comité");
                } else if (res.status === 400) {
                    setError(data?.error?.message || "Revisa el motivo: no cumple los requisitos");
                } else {
                    setError(data?.error?.message || "No pudimos escalar la alerta");
                }
                return;
            }
            onEscalada(alertaId, data?.alerta?.estado ?? "escalada");
            cerrar();
        } catch {
            setError("Error de red al escalar la alerta");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={cerrar} title="Escalar al Comité de Convivencia">
            <div className="space-y-4">
                <p className="text-sm text-muted">
                    El comité de convivencia recibirá el caso y se hará cargo. Cuenta por qué lo
                    escalas: queda registrado en la solicitud.
                </p>
                <div>
                    <label htmlFor="motivo-escalamiento" className="mb-1 block text-sm font-medium text-body">
                        Motivo del escalamiento
                    </label>
                    <textarea
                        id="motivo-escalamiento"
                        className="min-h-28 w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm text-body focus:border-emerald-500 focus:outline-none dark:border-slate-700"
                        maxLength={2000}
                        placeholder="Ej.: el estudiante acumula tres reportes por acoso y necesita acompañamiento del comité"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted">{motivo.trim().length}/2000</p>
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
                    <Button onClick={() => void enviar()} isLoading={enviando} disabled={motivo.trim().length === 0}>
                        Escalar al Comité
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default EscalarAlertaModal;

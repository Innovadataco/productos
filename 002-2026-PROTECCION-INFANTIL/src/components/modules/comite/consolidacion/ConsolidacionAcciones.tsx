"use client";

// SPEC-237 (002-PI-mega-cola): acciones del comité sobre el informe
// consolidado. Visibles solo para COMITE_VALIDACION en estado consolidable;
// la devolución exige motivo (validación local + Zod en el endpoint).
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ConsolidacionAcciones({
    puedeActuar,
    estadoAprobacion,
    ejecutando,
    onAprobar,
    onDevolver,
}: {
    puedeActuar: boolean;
    estadoAprobacion: string;
    ejecutando: boolean;
    onAprobar: () => Promise<string | null>;
    onDevolver: (motivo: string) => Promise<string | null>;
}) {
    const [mostrarDevolucion, setMostrarDevolucion] = useState(false);
    const [motivoDevolucion, setMotivoDevolucion] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);

    if (!puedeActuar) {
        return (
            <section className="glass rounded-2xl p-6">
                <p className="text-sm text-muted" data-testid="acciones-solo-lectura">
                    {estadoAprobacion === "APROBADO" || estadoAprobacion === "DEVUELTO"
                        ? `El informe está en estado ${estadoAprobacion}; ya no admite acciones del comité.`
                        : "Vista en modo lectura: solo el comité de validación puede aprobar, corregir o devolver."}
                </p>
            </section>
        );
    }

    const handleAprobar = async () => {
        setError(null);
        setMensaje(null);
        const fallo = await onAprobar();
        if (fallo) setError(fallo);
        else setMensaje("Aprobación registrada");
    };

    const handleDevolver = async () => {
        if (!motivoDevolucion.trim()) {
            setError("El motivo de la devolución es obligatorio");
            return;
        }
        setError(null);
        setMensaje(null);
        const fallo = await onDevolver(motivoDevolucion.trim());
        if (fallo) {
            setError(fallo);
        } else {
            setMostrarDevolucion(false);
            setMotivoDevolucion("");
            setMensaje("Informe devuelto al área de origen");
        }
    };

    return (
        <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-body">Acciones del comité</h3>
            <div className="flex flex-wrap gap-3">
                <Button onClick={handleAprobar} disabled={ejecutando} className="text-sm">
                    {ejecutando ? "Procesando..." : "Aprobar informe"}
                </Button>
                <Button
                    onClick={() => setMostrarDevolucion((v) => !v)}
                    disabled={ejecutando}
                    variant="outline"
                    className="text-sm"
                >
                    Devolver
                </Button>
            </div>
            {mostrarDevolucion && (
                <div className="space-y-2">
                    <textarea
                        aria-label="Motivo de la devolución"
                        placeholder="Motivo de la devolución (obligatorio)"
                        value={motivoDevolucion}
                        onChange={(e) => setMotivoDevolucion(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        className="glass-input w-full rounded-xl border p-3 text-sm text-body"
                    />
                    <Button onClick={handleDevolver} disabled={ejecutando} variant="danger" className="text-xs">
                        Confirmar devolución
                    </Button>
                </div>
            )}
            {error && (
                <p role="alert" className="text-sm text-rubi">
                    {error}
                </p>
            )}
            {mensaje && <p className="text-sm text-pino">{mensaje}</p>}
        </section>
    );
}

"use client";

/**
 * SPEC-340 (A-68 §3.2) — «Agregar otro evento»: el sistema ya sabe dónde está.
 *
 * Nick, plataforma, país, ciudad y edad se muestran FIJOS (no editables — se
 * heredan en el SERVIDOR del principal); el padre escribe solo el texto y el
 * día y la hora del hecho.
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface AgregarEventoProps {
    reporteId: string;
    identificador: string;
    plataforma: string;
    onListo: () => void;
    onCancelar: () => void;
}

export function AgregarEvento({ reporteId, identificador, plataforma, onListo, onCancelar }: AgregarEventoProps) {
    const [texto, setTexto] = useState("");
    const [fechaHora, setFechaHora] = useState("");
    const [error, setError] = useState("");
    const [enviando, setEnviando] = useState(false);

    const enviar = async () => {
        if (texto.trim().length < 10) {
            setError("Cuéntanos qué pasó, con tus palabras.");
            return;
        }
        if (!fechaHora) {
            setError("Dinos el día y la hora en que pasó.");
            return;
        }
        setEnviando(true);
        setError("");
        try {
            const res = await fetch(`/api/reportes/${reporteId}/evento`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto: texto.trim(), fechaIncidente: new Date(fechaHora).toISOString() }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.error?.message ?? "No pudimos guardar el evento. Intenta de nuevo.");
            }
            onListo();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos guardar el evento.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="rounded-xl border border-pino/30 bg-pino/5 p-3">
            <p className="text-sm font-medium text-body">Agregar otro evento</p>
            {/* Los datos heredados, a la vista pero FIJOS. */}
            <p className="mt-1 text-xs text-muted">
                Sobre <strong>{identificador}</strong> en {plataforma} — el lugar y los datos del menor se toman
                de tu primer reporte, no tienes que repetirlos.
            </p>
            <textarea
                className="mt-2 w-full rounded-xl border border-tinta/20 bg-transparent px-3 py-2 text-sm"
                rows={3}
                maxLength={2000}
                placeholder="¿Qué pasó esta vez?"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                aria-label="Qué pasó"
            />
            <label className="mt-2 block text-xs text-muted">
                Día y hora en que pasó
                <input
                    type="datetime-local"
                    className="mt-1 block w-full rounded-xl border border-tinta/20 bg-transparent px-3 py-2 text-sm"
                    value={fechaHora}
                    onChange={(e) => setFechaHora(e.target.value)}
                />
            </label>
            {error && <p className="mt-2 text-sm text-ambar">{error}</p>}
            <div className="mt-3 flex gap-2">
                <Button onClick={enviar} isLoading={enviando} className="flex-1">
                    Guardar el evento
                </Button>
                <Button variant="ghost" onClick={onCancelar}>
                    Cancelar
                </Button>
            </div>
        </div>
    );
}

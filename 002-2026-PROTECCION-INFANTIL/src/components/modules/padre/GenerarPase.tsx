"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface PaseGenerado {
    codigo: string;
    vigenteHasta: string;
}

/**
 * SPEC-610 (I-372 · D-123/D-129) · «Generar el pase para tu psicólogo».
 *
 * El padre o la madre genera un PASE de 8 caracteres que abre ESTE expediente
 * completo durante 15 minutos. D-129: acá se dice «el pase», nunca «código» — la
 * «llave» de 6 dígitos es otra cosa (del lado del padre, no se entrega). El pase
 * se muestra UNA sola vez en pantalla y también viaja por correo; cada canje le
 * avisa al padre por correo (lo maneja el backend).
 */
export function GenerarPase({ expedienteId }: { expedienteId: string }) {
    const [pase, setPase] = useState<PaseGenerado | null>(null);
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState("");
    const [copiado, setCopiado] = useState(false);

    const generar = async () => {
        setGenerando(true);
        setError("");
        try {
            const res = await fetch(`/api/padre/expedientes/${expedienteId}/solicitar-acceso`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: "{}",
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error?.message ?? "No pudimos generar el pase. Intenta de nuevo.");
            setPase(data as PaseGenerado);
            setCopiado(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : "No pudimos generar el pase.");
        } finally {
            setGenerando(false);
        }
    };

    const copiar = async () => {
        if (!pase) return;
        try {
            await navigator.clipboard.writeText(pase.codigo);
            setCopiado(true);
        } catch {
            // El portapapeles puede no estar disponible; el pase igual está en pantalla.
        }
    };

    return (
        <div className="rounded-xl border border-tinta/10 bg-tinta/5 p-3.5 dark:border-tinta/12 dark:bg-papel/5">
            <p className="text-xs text-muted">
                Genera un pase de 8 caracteres y dáselo a tu psicólogo. Cada vez que alguien lo use, te avisamos por
                correo.
            </p>

            {pase ? (
                <div className="mt-3 space-y-2">
                    <p className="font-mono text-2xl font-bold tracking-[0.35em] text-body">{pase.codigo}</p>
                    <p className="text-[11px] text-subtle">
                        Tu psicólogo tiene hasta las{" "}
                        {new Date(pase.vigenteHasta).toLocaleTimeString("es-CO", {
                            timeZone: "America/Bogota",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}{" "}
                        para usar el pase; una vez que entra, ve el expediente 15 minutos. Se muestra una sola vez.
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                        <Button variant="secondary" onClick={() => void copiar()}>
                            {copiado ? "Pase copiado" : "Copiar el pase"}
                        </Button>
                        <Button variant="secondary" onClick={() => void generar()} isLoading={generando}>
                            Generar otro
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="mt-3">
                    <Button onClick={() => void generar()} isLoading={generando}>
                        Generar el pase
                    </Button>
                    {error && <p className="mt-2 text-xs text-estado-rubi">{error}</p>}
                </div>
            )}
        </div>
    );
}

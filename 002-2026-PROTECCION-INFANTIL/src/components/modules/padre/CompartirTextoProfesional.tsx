"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
    reporteId: string;
}

interface CodigoGenerado {
    codigo: string;
    vigenteHasta: string;
}

/**
 * SPEC-584 (Fase 3) · «Compartir con un profesional» en el detalle del reporte
 * del padre. Solicita el código temporal (8 caracteres, 30 min de vigencia, un
 * solo canje): llega por correo y se muestra UNA vez en pantalla para pasarlo
 * al profesional, quien lo canjea desde «Canjear código» con su cuenta.
 */
export function CompartirTextoProfesional({ reporteId }: Props) {
    const [codigo, setCodigo] = useState<CodigoGenerado | null>(null);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);

    async function solicitar() {
        setCargando(true);
        setError("");
        try {
            const res = await fetch(`/api/reportes/${encodeURIComponent(reporteId)}/solicitar-acceso`, {
                method: "POST",
                credentials: "include",
            });
            if (res.status === 404) throw new Error("Este reporte no permite compartir el texto.");
            if (res.status === 429) throw new Error("Demasiadas solicitudes. Espera un momento e intenta de nuevo.");
            if (!res.ok) throw new Error("No se pudo generar el código. Intenta de nuevo.");
            setCodigo(await res.json());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setCargando(false);
        }
    }

    return (
        <div className="rounded-2xl border border-tinta/10 p-4">
            <h3 className="text-sm font-semibold text-body">Compartir el texto con un profesional</h3>
            <p className="mt-1 text-xs text-muted">
                Genera un código temporal que tu profesional puede canjear con su cuenta para leer el texto de este
                reporte. El código vence en 30 minutos y solo se puede usar una vez.
            </p>
            {codigo ? (
                <div className="mt-3">
                    <p className="text-xs text-muted">Tu código (también te lo enviamos por correo):</p>
                    <p className="mt-1 text-center text-2xl font-bold tracking-[0.3em] text-body">{codigo.codigo}</p>
                    <p className="mt-1 text-center text-xs text-subtle">
                        Válido hasta {new Date(codigo.vigenteHasta).toLocaleTimeString("es-CO", { timeZone: "America/Bogota" })}
                    </p>
                </div>
            ) : (
                <div className="mt-3">
                    <Button onClick={solicitar} disabled={cargando} variant="secondary">
                        {cargando ? "Generando código..." : "Generar código de acceso"}
                    </Button>
                    {error && <p className="mt-2 text-xs text-estado-rubi">{error}</p>}
                </div>
            )}
        </div>
    );
}

"use client";

/**
 * SPEC-752 · La puerta de PQR/soporte (§4c de FORMA-CANAL-CONTINUIDAD; FORMA-SPEC752).
 *
 * El padre elige UN motivo cerrado y envía; NO escribe. Sin campo de texto libre
 * (imposibilidad estructural: un textarea entre un padre y soporte arrastra contenido
 * sensible de un menor). Sin plazo en la UI — la confirmación dice el QUÉ pasa después,
 * no el CUÁNDO. La puerta URGENTE (141/CAI/Te Protejo) es `CanalesOficiales`, aparte.
 *
 * Presentacional: recibe `onEnviar` (lo cablea quien la coloca, con el endpoint real).
 * Muestra el número de seguimiento que DEVUELVE el registro — nunca uno inventado.
 */
import { useState } from "react";
import type { MotivoPeticionServicio } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { MOTIVOS_SOPORTE, COPY_PUERTA_SOPORTE, confirmacionSoporte, tituloDeMotivo } from "@/lib/soporte/motivos-soporte";

interface PuertaSoporteProps {
    /** Registra la petición y devuelve su número de seguimiento. */
    onEnviar: (motivo: MotivoPeticionServicio) => Promise<{ numeroSeguimiento: string }>;
}

export function PuertaSoporte({ onEnviar }: PuertaSoporteProps) {
    const [seleccion, setSeleccion] = useState<MotivoPeticionServicio | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultado, setResultado] = useState<{ numeroSeguimiento: string; tituloMotivo: string } | null>(null);

    async function enviar() {
        if (!seleccion || enviando) return;
        setEnviando(true);
        setError(null);
        try {
            const { numeroSeguimiento } = await onEnviar(seleccion);
            setResultado({ numeroSeguimiento, tituloMotivo: tituloDeMotivo(seleccion) });
        } catch {
            // Neutral: nunca el mensaje del servidor (no filtramos detalle al padre).
            setError("No pudimos enviar tu solicitud. Inténtalo de nuevo.");
        } finally {
            setEnviando(false);
        }
    }

    if (resultado) {
        return (
            <div className="glass rounded-2xl p-5 mt-6">
                <p className="text-sm text-body">{confirmacionSoporte(resultado.tituloMotivo)}</p>
                <p className="mt-3 flex items-center gap-2 text-xs text-muted">
                    {COPY_PUERTA_SOPORTE.numeroSeguimientoLabel}
                    <code className="rounded bg-tinta/10 px-2 py-0.5 font-mono text-body">{resultado.numeroSeguimiento}</code>
                </p>
            </div>
        );
    }

    return (
        <div className="glass rounded-2xl p-5 mt-6">
            <fieldset>
                <legend className="text-sm font-semibold text-body">{COPY_PUERTA_SOPORTE.titulo}</legend>
                <p className="mt-1 text-xs text-muted">{COPY_PUERTA_SOPORTE.subtitulo}</p>

                <div className="mt-4 grid gap-2">
                    {MOTIVOS_SOPORTE.map((m) => (
                        <label
                            key={m.valor}
                            className="flex cursor-pointer items-start gap-3 rounded-[var(--radio-card)] bg-tinta/5 p-3 transition hover:bg-tinta/10"
                        >
                            <input
                                type="radio"
                                name="motivo-soporte"
                                value={m.valor}
                                checked={seleccion === m.valor}
                                onChange={() => setSeleccion(m.valor)}
                                className="mt-0.5"
                            />
                            <span>
                                <span className="block text-sm font-medium text-body">{m.titulo}</span>
                                {m.subtitulo && <span className="block text-xs text-muted">{m.subtitulo}</span>}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            {error && <p className="mt-3 text-xs text-estado-rubi">{error}</p>}

            <Button
                type="button"
                variant="primary"
                onClick={enviar}
                disabled={!seleccion}
                isLoading={enviando}
                className="mt-4"
            >
                {COPY_PUERTA_SOPORTE.enviar}
            </Button>
        </div>
    );
}

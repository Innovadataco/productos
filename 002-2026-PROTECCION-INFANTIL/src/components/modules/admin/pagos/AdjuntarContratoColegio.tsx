"use client";

/**
 * SPEC-796 · Superficie 1 (FORMA-SPEC796) — nuestro ADMIN adjunta el contrato firmado del colegio.
 *
 * Los tres momentos: elegir (muestra el nombre, NO sube solo) · subiendo (deshabilitado, «Subiendo…»)
 * · si falla (mensaje por categoría + Reintentar). Al lograrlo: «Contrato adjuntado.» + fecha + Ver/
 * Reemplazar (cada reemplazo es un hecho nuevo). NUNCA «firmado digitalmente/válido/verificado»: no
 * validamos la firma, solo lo tenemos en archivo (§0). La guardia real es del servidor.
 */
import { useRef, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

const FMT = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long" });

export function AdjuntarContratoColegio({
    suscripcionId,
    contratoInicial,
}: {
    suscripcionId: string;
    contratoInicial: { adjuntadoEn: string } | null;
}) {
    const [contrato, setContrato] = useState(contratoInicial);
    const [archivo, setArchivo] = useState<File | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const [error, setError] = useState("");
    const [reemplazando, setReemplazando] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const endpoint = `/api/admin/pagos/cliente/${encodeURIComponent(suscripcionId)}/contrato`;

    async function subir() {
        if (!archivo) return;
        setSubiendo(true);
        setError("");
        try {
            const fd = new FormData();
            fd.append("archivo", archivo);
            const res = await fetch(endpoint, { method: "POST", body: fd, credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (res.ok && body?.data?.adjuntadoEn) {
                setContrato({ adjuntadoEn: body.data.adjuntadoEn as string });
                setArchivo(null);
                setReemplazando(false);
                if (inputRef.current) inputRef.current.value = "";
            } else {
                setError(body?.error?.message || "No se pudo subir el contrato. Intente de nuevo.");
            }
        } catch {
            setError("No se pudo subir el contrato. Intente de nuevo.");
        } finally {
            setSubiendo(false);
        }
    }

    const mostrarAdjuntar = !contrato || reemplazando;

    return (
        <GlassCard data-testid="admin-contrato-colegio" className="p-6">
            <h3 className="text-lg font-semibold text-body">Contrato firmado</h3>

            {contrato && !reemplazando && (
                <div className="mt-3 space-y-2">
                    <p className="text-sm text-body">Contrato adjuntado.</p>
                    <p className="text-xs text-subtle">Registrado el {FMT.format(new Date(contrato.adjuntadoEn))}.</p>
                    <div className="flex flex-wrap gap-3">
                        <a
                            href={`${endpoint}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-cielo hover:underline"
                        >
                            Ver contrato
                        </a>
                        <button type="button" onClick={() => setReemplazando(true)} className="text-sm font-medium text-muted hover:text-body">
                            Reemplazar
                        </button>
                    </div>
                </div>
            )}

            {mostrarAdjuntar && (
                <div className="mt-3 space-y-3">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf"
                        disabled={subiendo}
                        onChange={(e) => {
                            setArchivo(e.target.files?.[0] ?? null);
                            setError("");
                        }}
                        className="block text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-tinta/10 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-body"
                        aria-label="Adjuntar contrato firmado (PDF)"
                    />
                    {archivo && <p className="text-xs text-subtle">{archivo.name}</p>}
                    <div className="flex items-center gap-3">
                        <Button variant="primary" onClick={subir} isLoading={subiendo} disabled={!archivo || subiendo}>
                            {subiendo ? "Subiendo…" : "Subir"}
                        </Button>
                        {reemplazando && !subiendo && (
                            <button type="button" onClick={() => { setReemplazando(false); setArchivo(null); setError(""); }} className="text-sm text-muted hover:text-body">
                                Cancelar
                            </button>
                        )}
                    </div>
                    {error && (
                        <div className="rounded-xl bg-ambar/10 px-4 py-2 text-sm text-ambar">
                            {error} <button type="button" onClick={subir} className="font-semibold underline">Reintentar</button>
                        </div>
                    )}
                </div>
            )}
        </GlassCard>
    );
}

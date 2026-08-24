"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatoUSD, type Acento } from "./util";

interface BonoValidado {
    bonoId: string;
    nombre: string;
    tipo: string;
    valor: number;
    descuentoEstimadoUSD: number;
}

/**
 * SPEC-211 (002-PI-111): bloque 5 — aplicar bono promocional (AS-005).
 * Flujo: valida el código (POST /api/pagos/suscripcion/validar-bono, muestra el
 * descuento estimado) y luego aplica de verdad vía POST /api/pagos/aplicar-bono
 * (SPEC-216). El bono queda pre-aplicado y se consume en la próxima renovación.
 */
export function AplicarBonoCard({
    suscripcionId,
    montoBaseUSD,
    acento,
}: {
    suscripcionId: string;
    montoBaseUSD: number;
    acento: Acento;
}) {
    const router = useRouter();
    const [codigo, setCodigo] = useState("");
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validado, setValidado] = useState<BonoValidado | null>(null);
    const [aplicado, setAplicado] = useState<number | null>(null);

    async function leerError(res: Response): Promise<string> {
        try {
            const json = (await res.json()) as { error?: { message?: string } };
            return json.error?.message ?? "No se pudo procesar el bono";
        } catch {
            return "No se pudo procesar el bono";
        }
    }

    async function validar() {
        setCargando(true);
        setError(null);
        setValidado(null);
        try {
            const res = await fetch("/api/pagos/suscripcion/validar-bono", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ suscripcionId, codigo: codigo.trim() }),
            });
            if (!res.ok) {
                setError(await leerError(res));
                return;
            }
            setValidado((await res.json()) as BonoValidado);
        } finally {
            setCargando(false);
        }
    }

    async function aplicar() {
        if (!validado) return;
        setCargando(true);
        setError(null);
        try {
            const res = await fetch("/api/pagos/aplicar-bono", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ suscripcionId, bonoId: validado.bonoId, montoBaseUSD }),
            });
            if (!res.ok) {
                setError(await leerError(res));
                return;
            }
            const json = (await res.json()) as { descuentoUSD: number };
            setAplicado(json.descuentoUSD);
            setValidado(null);
            setCodigo("");
            router.refresh();
        } finally {
            setCargando(false);
        }
    }

    return (
        <GlassCard data-testid="bloque-bono" className="p-6">
            <h2 className="text-lg font-bold text-body">Aplicar bono promocional</h2>
            <p className="mt-1 text-sm text-muted">Ingresa el código del bono para validarlo y aplicarlo a tu suscripción.</p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={codigo}
                    onChange={(e) => {
                        setCodigo(e.target.value);
                        setValidado(null);
                        setError(null);
                    }}
                    placeholder="Código del bono"
                    aria-label="Código del bono"
                    className="glass-input w-full max-w-xs rounded-xl px-4 py-2.5 text-sm text-body placeholder:text-subtle"
                />
                <button
                    type="button"
                    onClick={validar}
                    disabled={cargando || codigo.trim().length < 2}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${acento.boton}`}
                >
                    Validar
                </button>
            </div>

            {error && (
                <p role="alert" className="mt-3 text-sm font-medium text-rubi">
                    {error}
                </p>
            )}

            {validado && (
                <div className={`mt-4 rounded-xl border p-4 ${acento.borde} ${acento.fondoSuave}`}>
                    <p className="text-sm font-semibold text-body">
                        Bono {validado.nombre}: descuento estimado de {formatoUSD(validado.descuentoEstimadoUSD)}
                    </p>
                    <button
                        type="button"
                        onClick={aplicar}
                        disabled={cargando}
                        className={`mt-3 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${acento.boton}`}
                    >
                        Aplicar bono
                    </button>
                </div>
            )}

            {aplicado !== null && (
                <p className="mt-3 rounded-xl bg-pino/10 px-4 py-2 text-sm font-medium text-pino">
                    Bono aplicado: se descontarán {formatoUSD(aplicado)} de tu próximo pago.
                </p>
            )}
        </GlassCard>
    );
}

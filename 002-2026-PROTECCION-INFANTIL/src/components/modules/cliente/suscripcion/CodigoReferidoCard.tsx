"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Acento } from "./util";

/**
 * SPEC-211 (002-PI-111): bloque 4 — código de referido propio con botón copiar
 * y contador de referidos exitosos del año (AS-004).
 */
export function CodigoReferidoCard({
    codigo,
    referidosExitososEsteAnio,
    acento,
}: {
    codigo: string;
    referidosExitososEsteAnio: number;
    acento: Acento;
}) {
    const [copiado, setCopiado] = useState(false);

    async function copiar() {
        try {
            await navigator.clipboard.writeText(codigo);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            setCopiado(false);
        }
    }

    return (
        <GlassCard data-testid="bloque-referido" className="p-6">
            <h2 className="text-lg font-bold text-body">Tu código de referido</h2>
            <p className="mt-1 text-sm text-muted">Compártelo con otros colegios o familias y obtén beneficios.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className={`rounded-xl px-4 py-2 font-mono text-sm font-semibold ${acento.fondoSuave} ${acento.texto}`}>
                    {codigo}
                </code>
                <button
                    type="button"
                    onClick={copiar}
                    className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${acento.boton}`}
                >
                    {copiado ? "Copiado" : "Copiar"}
                </button>
            </div>
            <p className="mt-3 text-xs text-subtle">
                Referidos exitosos este año: <span className="font-semibold text-body">{referidosExitososEsteAnio}</span>
            </p>
        </GlassCard>
    );
}

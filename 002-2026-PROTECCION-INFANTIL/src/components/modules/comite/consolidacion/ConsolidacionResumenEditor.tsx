"use client";

// SPEC-237 (002-PI-mega-cola): editor del resumen consolidado. Editable solo
// para COMITE_VALIDACION; cada corrección exige motivo y queda en el
// historial append-only (`correccionesJson`).
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { CorreccionMetaDto } from "./tipos";
import { formatearEnBogota } from "@/lib/comite/sla";

export function ConsolidacionResumenEditor({
    resumenInicial,
    correcciones,
    puedeActuar,
    guardando,
    onCorregir,
}: {
    resumenInicial: string;
    correcciones: CorreccionMetaDto[];
    puedeActuar: boolean;
    guardando: boolean;
    onCorregir: (texto: string, motivo: string) => Promise<string | null>;
}) {
    const [texto, setTexto] = useState(resumenInicial);
    const [motivo, setMotivo] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleCorregir = async () => {
        if (!texto.trim()) {
            setError("El resumen no puede estar vacío");
            return;
        }
        if (!motivo.trim()) {
            setError("El motivo de la corrección es obligatorio");
            return;
        }
        setError(null);
        const fallo = await onCorregir(texto.trim(), motivo.trim());
        if (fallo) {
            setError(fallo);
        } else {
            setMotivo("");
        }
    };

    return (
        <section className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-body">Resumen consolidado</h3>
            <textarea
                aria-label="Resumen consolidado"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                readOnly={!puedeActuar}
                rows={10}
                maxLength={20000}
                className="glass-input w-full rounded-xl border p-3 text-sm text-body read-only:opacity-70"
            />
            {puedeActuar && (
                <div className="space-y-2">
                    <input
                        type="text"
                        aria-label="Motivo de la corrección"
                        placeholder="Motivo de la corrección (obligatorio)"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        maxLength={500}
                        className="glass-input w-full rounded-xl border px-3 py-2 text-sm text-body"
                    />
                    {error && (
                        <p role="alert" className="text-sm text-rubi">
                            {error}
                        </p>
                    )}
                    <Button onClick={handleCorregir} disabled={guardando} variant="outline" className="text-xs">
                        {guardando ? "Guardando..." : "Corregir resumen"}
                    </Button>
                </div>
            )}
            {correcciones.length > 0 && (
                <div className="space-y-2 border-t border-tinta/10 pt-3">
                    <h4 className="text-sm font-medium text-body">Historial de correcciones</h4>
                    <ul className="space-y-1 text-xs text-subtle">
                        {correcciones.map((c, i) => (
                            <li key={`${c.corregidoEn}-${i}`}>
                                {formatearEnBogota(new Date(c.corregidoEn))} · {c.nombre} · {c.motivo}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

"use client";

import { Button } from "@/components/ui/Button";

interface TextoOriginalPanelProps {
    puedeRevelarOriginal: boolean;
    textoOriginalRevelado: string | null;
    /** Texto vigente del reporte (para detectar que el original es idéntico). */
    textoActual: string;
    loadingRevelar: boolean;
    onRevelar: () => void;
}

/**
 * SPEC-592: el «Texto original» SOLO se muestra tras la acción explícita
 * «Revelar original» (que audita). Y si el original resulta IDÉNTICO al texto
 * vigente (reporte sin anonimización ni cambios), NO se repite el contenido:
 * una sola nota lo dice. Antes el detalle pintaba el mismo párrafo dos veces.
 */
export function TextoOriginalPanel({ puedeRevelarOriginal, textoOriginalRevelado, textoActual, loadingRevelar, onRevelar }: TextoOriginalPanelProps) {
    if (!puedeRevelarOriginal) return null;

    const esIdenticoAlActual = textoOriginalRevelado !== null && textoOriginalRevelado === textoActual;

    return (
        <div className="rounded-lg border border-rubi/20 bg-rubi/5 p-4">
            <h3 className="mb-2 font-medium text-estado-rubi">Texto original</h3>
            <p className="mb-3 text-sm text-subtle">
                Solo los administradores pueden revelar el texto original. El acceso queda auditado.
            </p>
            {textoOriginalRevelado === null ? (
                <Button onClick={onRevelar} disabled={loadingRevelar} variant="secondary">
                    {loadingRevelar ? "Revelando..." : "Revelar original"}
                </Button>
            ) : esIdenticoAlActual ? (
                <p className="whitespace-pre-wrap rounded-lg bg-rubi/10 p-3 text-estado-rubi">
                    El texto original es idéntico al texto vigente: no hay anonimizaciones ni cambios que mostrar.
                </p>
            ) : (
                <p className="whitespace-pre-wrap rounded-lg bg-rubi/10 p-3 text-estado-rubi">
                    {textoOriginalRevelado}
                </p>
            )}
        </div>
    );
}

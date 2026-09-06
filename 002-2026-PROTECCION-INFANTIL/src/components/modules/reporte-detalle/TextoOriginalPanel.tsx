"use client";

import { Button } from "@/components/ui/Button";

interface TextoOriginalPanelProps {
    puedeRevelarOriginal: boolean;
    textoOriginalRevelado: string | null;
    loadingRevelar: boolean;
    onRevelar: () => void;
}

export function TextoOriginalPanel({ puedeRevelarOriginal, textoOriginalRevelado, loadingRevelar, onRevelar }: TextoOriginalPanelProps) {
    if (!puedeRevelarOriginal) return null;

    return (
        <div className="rounded-lg border border-rubi/20 bg-rubi/5 p-4">
            <h3 className="mb-2 font-medium text-estado-rubi">Texto original</h3>
            <p className="mb-3 text-sm text-subtle">
                Solo los administradores pueden revelar el texto original. El acceso queda auditado.
            </p>
            {textoOriginalRevelado !== null ? (
                <p className="whitespace-pre-wrap rounded-lg bg-rubi/10 p-3 text-estado-rubi">
                    {textoOriginalRevelado}
                </p>
            ) : (
                <Button onClick={onRevelar} disabled={loadingRevelar} variant="secondary">
                    {loadingRevelar ? "Revelando..." : "Revelar original"}
                </Button>
            )}
        </div>
    );
}

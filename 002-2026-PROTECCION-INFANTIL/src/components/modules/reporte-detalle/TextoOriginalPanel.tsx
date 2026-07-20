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
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
            <h3 className="mb-2 font-medium text-red-800 dark:text-red-300">Texto original</h3>
            <p className="mb-3 text-sm text-subtle">
                Solo los administradores pueden revelar el texto original. El acceso queda auditado.
            </p>
            {textoOriginalRevelado !== null ? (
                <p className="whitespace-pre-wrap rounded-lg bg-red-100 dark:bg-red-900/30 p-3 text-red-900 dark:text-red-200">
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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatPlataforma } from "@/lib/plataforma";

type WizardData = {
    identificador: string;
    plataforma: string;
    otraPlataforma: string;
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    edadVictima: string;
    texto: string;
};

export function ReporteStepConfirmar({
    data,
    onSubmit,
    isSubmitting,
    error,
}: {
    data: WizardData;
    onSubmit: () => void;
    isSubmitting: boolean;
    error: string;
}) {
    const [checked, setChecked] = useState(false);

    const plataformaDisplay = formatPlataforma(data.plataforma, data.otraPlataforma, data.plataforma);

    return (
        <div className="space-y-5">
            <h2 className="text-lg font-semibold text-body">Revisa y confirma</h2>

            <div className="glass rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-subtle">Identificador</span>
                    <span className="font-medium text-body">{data.identificador}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-subtle">Plataforma</span>
                    <span className="font-medium text-body capitalize">{plataformaDisplay}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-subtle">Ubicación</span>
                    <span className="font-medium text-body">{data.ciudad}, {data.pais}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-subtle">Fecha del incidente</span>
                    <span className="font-medium text-body">{data.fechaIncidente || "No especificada"}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-subtle">Edad aproximada del menor</span>
                    <span className="font-medium text-body">{data.edadVictima || "No especificada"}</span>
                </div>
                <div>
                    <span className="text-subtle block mb-1">Descripción</span>
                    <p className="text-body whitespace-pre-wrap">{data.texto}</p>
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
                <span className="text-sm text-muted leading-relaxed">
                    Entiendo que este reporte es <strong>informativo y voluntario</strong>. No reemplaza una denuncia formal ante las autoridades competentes.
                </span>
            </label>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <Button
                variant="primary"
                isLoading={isSubmitting}
                disabled={!checked || isSubmitting}
                onClick={onSubmit}
                className="w-full"
            >
                Enviar reporte
            </Button>
        </div>
    );
}

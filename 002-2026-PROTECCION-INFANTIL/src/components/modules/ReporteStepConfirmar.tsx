"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type WizardData = {
    plataforma: string;
    ciudad: string;
    pais: string;
    fechaIncidente: string;
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

    return (
        <div className="space-y-5">
            <h2 className="text-lg font-semibold text-slate-800">Revisa y confirma</h2>

            <div className="glass rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-500">Plataforma</span>
                    <span className="font-medium text-slate-800 capitalize">{data.plataforma}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">Ubicación</span>
                    <span className="font-medium text-slate-800">{data.ciudad}, {data.pais}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">Fecha</span>
                    <span className="font-medium text-slate-800">{data.fechaIncidente || "No especificada"}</span>
                </div>
                <div>
                    <span className="text-slate-500 block mb-1">Descripción</span>
                    <p className="text-slate-800 whitespace-pre-wrap">{data.texto}</p>
                </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
                <span className="text-sm text-slate-700 leading-relaxed">
                    Entiendo que este reporte es <strong>informativo</strong> y{" "}
                    <strong>no reemplaza una denuncia formal</strong> ante las autoridades competentes.
                </span>
            </label>

            {error && <p className="text-sm text-red-600">{error}</p>}

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
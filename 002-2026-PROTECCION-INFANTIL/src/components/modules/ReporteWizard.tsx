"use client";

import { useState } from "react";
import { ReporteStepPlataforma } from "./ReporteStepPlataforma";
import { ReporteStepUbicacion } from "./ReporteStepUbicacion";
import { ReporteStepDescripcion } from "./ReporteStepDescripcion";
import { ReporteStepConfirmar } from "./ReporteStepConfirmar";
import { ConfirmacionReporte } from "./ConfirmacionReporte";
import { Button } from "@/components/ui/Button";

type WizardData = {
    identificador: string;
    plataforma: string;
    otraPlataforma: string;
    ciudad: string;
    pais: string;
    paisId: string;
    ciudadId: string;
    fechaIncidente: string;
    texto: string;
    esAnonimo: boolean;
};

export function ReporteWizard() {
    const [step, setStep] = useState(1);
    const [data, setData] = useState<WizardData>({
        identificador: "",
        plataforma: "",
        otraPlataforma: "",
        ciudad: "",
        pais: "",
        paisId: "",
        ciudadId: "",
        fechaIncidente: "",
        texto: "",
        esAnonimo: true,
    });
    const [resultado, setResultado] = useState<{ numeroSeguimiento: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError("");
        try {
            const res = await fetch("/api/reportes", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    identificador: data.identificador,
                    plataforma: data.plataforma,
                    otraPlataforma: data.otraPlataforma,
                    texto: data.texto,
                    fechaIncidente: data.fechaIncidente
                        ? new Date(data.fechaIncidente).toISOString()
                        : new Date().toISOString(),
                    ciudad: data.ciudad,
                    pais: data.pais,
                    paisId: data.paisId || null,
                    ciudadId: data.ciudadId === "otra" ? null : (data.ciudadId || null),
                }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || "Error al enviar el reporte");
                setIsSubmitting(false);
                return;
            }
            setResultado({ numeroSeguimiento: json.reporte.numeroSeguimiento });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de conexión");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (resultado) {
        return <ConfirmacionReporte numeroSeguimiento={resultado.numeroSeguimiento} />;
    }

    return (
        <div className="mx-auto max-w-xl">
            <div className="mb-6 flex items-center justify-between">
                {[1, 2, 3, 4].map((s) => (
                    <div key={s} className="flex flex-1 items-center">
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${s <= step
                                ? "bg-primary-600 text-white"
                                : "bg-slate-200 text-slate-500"
                                }`}
                        >
                            {s}
                        </div>
                        {s < 4 && (
                            <div
                                className={`mx-2 h-1 flex-1 rounded transition ${s < step ? "bg-primary-600" : "bg-slate-200"
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>

            {step === 1 && (
                <ReporteStepPlataforma
                    identificador={data.identificador}
                    plataforma={data.plataforma}
                    otraPlataforma={data.otraPlataforma}
                    onChange={(v: { identificador: string; plataforma: string; otraPlataforma: string }) => update(v)}
                />
            )}
            {step === 2 && (
                <ReporteStepUbicacion
                    ciudad={data.ciudad}
                    pais={data.pais}
                    fechaIncidente={data.fechaIncidente}
                    paisId={data.paisId}
                    ciudadId={data.ciudadId}
                    onChange={(v) => update(v)}
                />
            )}
            {step === 3 && (
                <ReporteStepDescripcion
                    value={data.texto}
                    onChange={(v: string) => update({ texto: v })}
                />
            )}
            {step === 4 && (
                <ReporteStepConfirmar
                    data={data}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    error={error}
                />
            )}

            <div className="mt-6 flex justify-between">
                {step > 1 && (
                    <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                        Atrás
                    </Button>
                )}
                {step < 4 && (
                    <Button
                        className="ml-auto"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={
                            (step === 1 && (!data.identificador.trim() || !data.plataforma)) ||
                            (step === 2 && (!data.paisId || !data.ciudadId || (data.ciudadId === "otra" && !data.ciudad))) ||
                            (step === 3 && data.texto.length < 20)
                        }
                    >
                        Siguiente
                    </Button>
                )}
            </div>
        </div>
    );
}
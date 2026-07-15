"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";

const STORAGE_KEY = "pi-onboarding-completed";
const DISABLED = process.env.NEXT_PUBLIC_DISABLE_ONBOARDING === "true";

const STEPS = [
    {
        title: "Bienvenido a Protección Infantil",
        description:
            "Esta plataforma te permite consultar identificadores reportados por la comunidad y reportar conductas de riesgo para menores.",
    },
    {
        title: "Consulta antes de interactuar",
        description:
            "Usa la barra de búsqueda en la página de inicio para verificar números, nicks o usuarios en redes sociales y mensajería.",
    },
    {
        title: "Reporta de forma segura",
        description:
            "Puedes reportar anónimamente o con una cuenta. Incluye la plataforma, fecha, ciudad y una descripción clara del incidente.",
    },
    {
        title: "Tus datos están protegidos",
        description:
            "La información personal se anonimiza automáticamente. Nunca mostramos textos originales en las consultas públicas.",
    },
];

export function OnboardingModal() {
    const { user, isLoading } = useAuth();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (isLoading || DISABLED || !user) return;
        const completed = typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "true";
        if (!completed) {
            setOpen(true);
        }
    }, [user, isLoading]);

    const complete = () => {
        localStorage.setItem(STORAGE_KEY, "true");
        setOpen(false);
        setStep(0);
    };

    if (!open) return null;

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) complete();
            }}
        >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex justify-center gap-1.5">
                    {STEPS.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1.5 w-6 rounded-full ${
                                i === step ? "bg-primary-600" : "bg-slate-200"
                            }`}
                        />
                    ))}
                </div>

                <h2 className="text-xl font-bold text-slate-900">{current.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{current.description}</p>

                <div className="mt-6 flex items-center justify-between">
                    <button
                        data-testid="onboarding-close"
                        onClick={complete}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800"
                    >
                        Omitir
                    </button>
                    <div className="flex gap-3">
                        {step > 0 && (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                            >
                                Atrás
                            </button>
                        )}
                        {isLast ? (
                            <button
                                onClick={complete}
                                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                            >
                                Comenzar
                            </button>
                        ) : (
                            <button
                                onClick={() => setStep(step + 1)}
                                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                            >
                                Siguiente
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { isOnboardingComplete, markOnboardingComplete } from "@/lib/onboarding";

export interface OnboardingTourProps {
    disabled?: boolean;
}

const STEPS = [
    {
        title: "Bienvenido a Protección Infantil",
        text: "Esta herramienta te ayuda a proteger a tu hijo/a de contactos de riesgo en redes sociales y mensajería.",
        icon: ShieldIcon,
    },
    {
        title: "Consultá cualquier número o nick",
        text: "Escribí un número de teléfono o nombre de usuario. Nuestra IA analiza reportes de otros padres y te da un score de riesgo del 0 al 100.",
        icon: SearchIcon,
    },
    {
        title: "Si ves algo sospechoso, reportalo",
        text: "Tu reporte ayuda a otros padres. Es anónimo opcional y pasa por clasificación IA. Juntos construimos una red de protección.",
        icon: FlagIcon,
    },
];

export function OnboardingTour({ disabled }: OnboardingTourProps) {
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (disabled) return;
        if (!isOnboardingComplete()) {
            setOpen(true);
        }
    }, [disabled]);

    const close = () => {
        markOnboardingComplete();
        setOpen(false);
        setStep(0);
    };

    const skip = () => {
        markOnboardingComplete();
        setOpen(false);
        setStep(0);
    };

    const next = () => {
        if (step === STEPS.length - 1) {
            close();
        } else {
            setStep((s) => s + 1);
        }
    };

    if (!mounted || !open) return null;

    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;
    const Icon = current.icon;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
            data-testid="onboarding-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) skip();
            }}
        >
            {/* Spotlight decorativo */}
            <div className="pointer-events-none absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 blur-3xl" />

            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all duration-300 animate-floatUp">
                <div className="mb-5 flex justify-center">
                    <div className="flex items-center justify-center rounded-2xl bg-primary-50 p-4">
                        <Icon className="h-10 w-10 text-primary-600" />
                    </div>
                </div>

                <div className="mb-6 flex justify-center gap-2">
                    {STEPS.map((_, i) => (
                        <span
                            key={i}
                            className={`h-2 w-2 rounded-full transition-all duration-300 ${
                                i === step ? "w-6 bg-primary-600" : "bg-slate-200"
                            }`}
                            aria-current={i === step ? "step" : undefined}
                        />
                    ))}
                </div>

                <h2 className="text-center text-xl font-bold text-slate-900" data-testid="onboarding-title">
                    {current.title}
                </h2>
                <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
                    {current.text}
                </p>

                <div className="mt-8 flex items-center justify-between gap-3">
                    <button
                        onClick={skip}
                        className="text-sm font-medium text-slate-500 hover:text-slate-800"
                        data-testid="onboarding-skip"
                    >
                        Saltar tour
                    </button>
                    <button
                        onClick={next}
                        className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        data-testid="onboarding-next"
                    >
                        {isLast ? "Empezar a usar" : "Siguiente"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ShieldIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

function SearchIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
        </svg>
    );
}

function FlagIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" x2="4" y1="22" y2="15" />
        </svg>
    );
}

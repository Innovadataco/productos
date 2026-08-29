"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OnboardingModal } from "@/components/modules/colegio/OnboardingModal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

type ResumenOnboarding = { estudiantes: number; cursos: number; profesores: number };

type OnboardingRespuesta = {
    estado: string;
    resumen?: ResumenOnboarding;
};

const TARJETAS_RESUMEN = [
    { key: "estudiantes", label: "Estudiantes", icon: "🎓" },
    { key: "cursos", label: "Cursos", icon: "📚" },
    { key: "profesores", label: "Profesores", icon: "👨‍🏫" },
] as const;

/**
 * SPEC-169 (Fase G) — Página dedicada para reactivar o continuar el onboarding.
 * SPEC-173 (H05): si el onboarding ya está completado, muestra un resumen amable
 * con los conteos del colegio y un CTA al inicio en vez del modal.
 */
export default function OnboardingPage() {
    const [onboarding, setOnboarding] = useState<OnboardingRespuesta | null>(null);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        let activo = true;
        fetch("/api/colegio/onboarding", { credentials: "include" })
            .then((res) => (res.ok ? res.json() : null))
            .then((json) => {
                if (!activo) return;
                setOnboarding((json?.onboarding as OnboardingRespuesta | undefined) ?? null);
                setCargando(false);
            })
            .catch(() => {
                if (activo) setCargando(false);
            });
        return () => {
            activo = false;
        };
    }, []);

    if (cargando) {
        return (
            <div className="flex items-center justify-center gap-3 p-8 text-muted">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-tinta/15 border-t-pino" />
                Cargando…
            </div>
        );
    }

    if (onboarding?.estado === "completado") {
        const resumen = onboarding.resumen ?? { estudiantes: 0, cursos: 0, profesores: 0 };
        return (
            <main className="flex items-center justify-center p-4 sm:p-6 lg:p-8">
                <GlassCard className="w-full max-w-lg text-center">
                    <div className="text-4xl">🎉</div>
                    <h1 className="mt-3 text-2xl font-bold text-body">Tu colegio ya está configurado</h1>
                    <p className="mt-2 text-sm text-muted">
                        Completaste la configuración inicial. El sistema ya puede generar alertas para tu comunidad
                        educativa.
                    </p>
                    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {TARJETAS_RESUMEN.map((tarjeta) => (
                            <div key={tarjeta.key} className="rounded-2xl border border-tinta/10 bg-papel/50 p-4">
                                <div className="text-2xl">{tarjeta.icon}</div>
                                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                                    {tarjeta.label}
                                </p>
                                <p className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                                    {resumen[tarjeta.key]}
                                </p>
                            </div>
                        ))}
                    </div>
                    <Link href="/dashboard/colegio" className="mt-6 inline-block">
                        <Button>Ir al inicio</Button>
                    </Link>
                </GlassCard>
            </main>
        );
    }

    return <OnboardingModal forceOpen />;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export interface PasoOnboarding {
    id: number;
    nombre: string;
    descripcion: string;
    estado: "pendiente" | "completado";
    ctaHref: string;
    ctaTexto: string;
}

export interface OnboardingPayload {
    estado: string;
    pasoActual: number;
    completadoEn: string | null;
    pasos: PasoOnboarding[];
}

interface OnboardingModalProps {
    forceOpen?: boolean;
    onOmitido?: () => void;
}

export function OnboardingModal({ forceOpen = false, onOmitido }: OnboardingModalProps) {
    const [onboarding, setOnboarding] = useState<OnboardingPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [open, setOpen] = useState(forceOpen);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch("/api/colegio/onboarding");
            if (!res.ok) return;
            const json = await res.json();
            setOnboarding(json.onboarding);
            if (json.onboarding.estado === "activo" || forceOpen) {
                setOpen(true);
            }
        } finally {
            setLoading(false);
        }
    }, [forceOpen]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    useEffect(() => {
        if (forceOpen) setOpen(true);
    }, [forceOpen]);

    async function omitir() {
        setUpdating(true);
        try {
            const res = await fetch("/api/colegio/onboarding", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: "omitido" }),
            });
            if (!res.ok) return;
            const json = await res.json();
            setOnboarding(json.onboarding);
            setOpen(false);
            onOmitido?.();
        } finally {
            setUpdating(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden="true" />
            </div>
        );
    }

    if (!onboarding) return null;

    const visible = open || forceOpen;

    return (
        <Modal
            isOpen={visible}
            onClose={() => {
                if (!forceOpen) setOpen(false);
            }}
            title="Active su protección"
            size="lg"
            showCloseButton={!forceOpen}
        >
            <div className="space-y-5">
                <p className="text-sm text-muted">
                    Completa estos pasos para que el sistema pueda generar alertas cuando detecte un riesgo asociado a
                    su comunidad educativa.
                </p>

                <ol className="space-y-3">
                    {onboarding.pasos.map((paso) => {
                        const completado = paso.estado === "completado";
                        return (
                            <li
                                key={paso.id}
                                className={`flex items-start gap-3 rounded-xl border p-4 transition ${
                                    completado
                                        ? "border-pino/20 bg-pino/[0.06]"
                                        : "border-tinta/10 bg-papel/50"
                                }`}
                            >
                                {completado ? (
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pino" aria-hidden="true" />
                                ) : (
                                    <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-body">{paso.nombre}</span>
                                        {completado && (
                                            <span className="inline-flex items-center rounded-full bg-pino/10 px-2 py-0.5 text-xs font-medium text-pino">
                                                Completado
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-sm text-muted">{paso.descripcion}</p>
                                    {!completado && (
                                        <Link
                                            href={paso.ctaHref}
                                            className="mt-2 inline-flex text-sm font-semibold text-accent hover:text-pino"
                                        >
                                            {paso.ctaTexto} →
                                        </Link>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    {!forceOpen && (
                        <Button variant="ghost" onClick={omitir} disabled={updating}>
                            {updating ? "Guardando…" : "Omitir por ahora"}
                        </Button>
                    )}
                    {forceOpen && onboarding.estado !== "activo" && (
                        <Button
                            variant="secondary"
                            onClick={async () => {
                                setUpdating(true);
                                try {
                                    const res = await fetch("/api/colegio/onboarding", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ estado: "activo" }),
                                    });
                                    if (!res.ok) return;
                                    const json = await res.json();
                                    setOnboarding(json.onboarding);
                                } finally {
                                    setUpdating(false);
                                }
                            }}
                            disabled={updating}
                        >
                            {updating ? "Reactivando…" : "Reactivar onboarding"}
                        </Button>
                    )}
                    <span className="text-xs text-subtle">
                        Paso sugerido:{" "}
                        {onboarding.pasoActual <= onboarding.pasos.length
                            ? onboarding.pasos[onboarding.pasoActual - 1]?.nombre
                            : "Resumen"}
                    </span>
                </div>
            </div>
        </Modal>
    );
}

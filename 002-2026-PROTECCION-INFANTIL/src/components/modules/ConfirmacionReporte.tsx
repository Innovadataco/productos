"use client";

import { useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export function ConfirmacionReporte({ numeroSeguimiento }: { numeroSeguimiento: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(numeroSeguimiento);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback silencioso
        }
    };

    return (
        <div className="mx-auto max-w-md text-center animate-floatUp">
            <GlassCard className="space-y-5">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                <h2 className="text-xl font-bold text-slate-900">Reporte recibido</h2>
                <p className="text-sm text-slate-600">
                    Tu número de seguimiento es:
                </p>

                <div className="flex items-center justify-center gap-3">
                    <code className="rounded-lg bg-slate-100 px-4 py-2 text-lg font-mono font-bold text-slate-800 tracking-wide">
                        {numeroSeguimiento}
                    </code>
                    <Button variant="outline" onClick={handleCopy} className="px-3 py-2 text-xs">
                        {copied ? "Copiado" : "Copiar"}
                    </Button>
                </div>

                <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800 text-left">
                    <strong>Guarda este número.</strong> Es la única forma de consultar el estado de tu reporte.
                </div>

                <div className="flex flex-col gap-3 pt-2">
                    <Link href={`/seguimiento?numero=${numeroSeguimiento}`}>
                        <Button variant="primary" className="w-full">Ver estado del reporte</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="outline" className="w-full">Volver al inicio</Button>
                    </Link>
                </div>
            </GlassCard>
        </div>
    );
}
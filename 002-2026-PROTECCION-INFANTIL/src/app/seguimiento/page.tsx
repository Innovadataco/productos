"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SeguimientoForm } from "@/components/modules/SeguimientoForm";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

type SeguimientoData = {
    numeroSeguimiento: string;
    estado: string;
    creadoEn: string;
    mensaje: string;
};

const ESTADO_VISUAL: Record<string, string> = {
    PENDIENTE: "Recibido",
    PROCESANDO: "En procesamiento",
    CLASIFICADO: "Procesado",
    CORREGIDO: "Procesado",
    REVISION_MANUAL: "En revisión",
    POSIBLE_SPAM: "En revisión",
    REQUIERE_ANONIMIZACION: "En revisión de privacidad",
    DUPLICADO: "Vinculado a reporte existente",
};

export default function SeguimientoPage() {
    const [numeroInicial, setNumeroInicial] = useState("");
    const [data, setData] = useState<SeguimientoData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const n = params.get("numero") || "";
            if (n) setNumeroInicial(n);
        }
    }, []);

    const handleSearch = async (numero: string) => {
        setIsLoading(true);
        setError("");
        setData(null);
        try {
            const res = await fetch(`/api/reportes/seguimiento/${encodeURIComponent(numero)}`, {
                credentials: "include",
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error?.message || "No se encontró el reporte. Verifica el número.");
                return;
            }
            setData(json);
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setIsLoading(false);
        }
    };

    const estadoVisual = data ? (ESTADO_VISUAL[data.estado] || data.estado) : null;

    const badgeClass =
        estadoVisual === "Recibido"
            ? "bg-slate-100 text-slate-700"
            : estadoVisual === "En procesamiento"
                ? "bg-blue-50 text-blue-700"
                : estadoVisual === "Procesado"
                    ? "bg-accent-50 text-accent-700"
                    : estadoVisual === "En revisión" || estadoVisual === "En revisión de privacidad"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600";

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-slate-900">Seguimiento de reporte</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Consulta el estado de un reporte con su número de seguimiento
                </p>
            </div>

            <GlassCard className="mb-6">
                <SeguimientoForm onSearch={handleSearch} />
            </GlassCard>

            {isLoading && (
                <div className="glass rounded-2xl p-8 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
                    <p className="mt-3 text-sm text-slate-500">Consultando...</p>
                </div>
            )}

            {error && (
                <div className="glass rounded-2xl p-6 text-center">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            {data && (
                <div className="glass rounded-2xl p-6 animate-floatUp">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">
                            {data.numeroSeguimiento}
                        </h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
                            {estadoVisual}
                        </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">{data.mensaje}</p>
                    <p className="text-xs text-slate-400">
                        Reportado el {new Date(data.creadoEn).toLocaleDateString("es-CO")}
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <Link href="/reportar">
                            <Button variant="outline" className="w-full">
                                Realizar otro reporte
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

            <CanalesOficiales />
        </main>
    );
}
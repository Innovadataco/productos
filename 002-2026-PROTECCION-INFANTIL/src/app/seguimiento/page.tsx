"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SeguimientoForm } from "@/components/modules/SeguimientoForm";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

type ClasificacionData = {
    categoria: string;
    categoriaLabel: string;
    confianza: number;
    contienePii: boolean;
    piiDetectada: string[];
};

type RankingData = {
    score: number;
    nivelRiesgo: "BAJO" | "MEDIO" | "ALTO";
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
};

type SeguimientoData = {
    numeroSeguimiento: string;
    estado: string;
    creadoEn: string;
    mensaje: string;
    identificador: string;
    plataforma: string;
    clasificacion: ClasificacionData | null;
    ranking: RankingData | null;
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

const NIVEL_STYLES = {
    BAJO: "bg-green-100 text-green-800",
    MEDIO: "bg-amber-100 text-amber-800",
    ALTO: "bg-red-100 text-red-800",
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

    useEffect(() => {
        if (numeroInicial) {
            handleSearch(numeroInicial);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [numeroInicial]);

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
                <SeguimientoForm onSearch={handleSearch} initialValue={numeroInicial} />
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
                <div className="glass rounded-2xl p-6 animate-floatUp space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500">{data.plataforma}</p>
                            <h2 className="text-lg font-semibold text-slate-800">{data.identificador}</h2>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}>
                            {estadoVisual}
                        </span>
                    </div>

                    <div className="rounded-xl bg-white/50 p-4">
                        <p className="text-sm text-slate-700 font-medium">{data.mensaje}</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Reportado el {new Date(data.creadoEn).toLocaleDateString("es-CO")}
                        </p>
                    </div>

                    {data.clasificacion && (
                        <div className="rounded-xl bg-white/50 p-4">
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">Clasificación del reporte</h3>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">
                                    {data.clasificacion.categoriaLabel}
                                </span>
                                <span className="text-xs text-slate-500">
                                    Confianza: {Math.round(data.clasificacion.confianza * 100)}%
                                </span>
                            </div>
                            {data.clasificacion.contienePii && (
                                <p className="text-xs text-slate-500 mt-2">
                                    El texto fue anonimizado para proteger datos personales.
                                </p>
                            )}
                        </div>
                    )}

                    {data.ranking && (
                        <div className="rounded-xl bg-white/50 p-4">
                            <h3 className="text-sm font-semibold text-slate-700 mb-2">Riesgo del identificador</h3>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-primary-700 font-mono">{data.ranking.score}</p>
                                    <p className="text-[10px] text-slate-500">Score 0-100</p>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${NIVEL_STYLES[data.ranking.nivelRiesgo]}`}>
                                    Riesgo {data.ranking.nivelRiesgo}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Basado en {data.ranking.totalReportes} reportes
                                ({data.ranking.reportesAutenticados} autenticados, {data.ranking.reportesAnonimos} anónimos).
                            </p>
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-200">
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SeguimientoForm } from "@/components/modules/SeguimientoForm";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import type { BadgeVariant } from "@/components/ui/Badge";

type ClasificacionData = {
    categoria: string;
    categoriaLabel: string;
    categoriaGrupo: string;
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
    estadoVisual: "En proceso" | "Procesado";
    estadoInterno: string;
    badge: "warning" | "success" | "muted";
    enProceso: boolean;
    mensaje: string;
    slaHoras: number;
    creadoEn: string;
    actualizadoEn: string;
    identificador: string;
    plataforma: string;
    clasificacion: ClasificacionData | null;
    ranking: RankingData | null;
};

function badgeVariant(badge: SeguimientoData["badge"]): BadgeVariant {
    switch (badge) {
        case "warning":
            return "warning";
        case "success":
            return "success";
        case "muted":
        default:
            return "neutral";
    }
}

function riesgoVariant(nivel: string) {
    switch (nivel) {
        case "BAJO":
            return "success";
        case "MEDIO":
            return "warning";
        case "ALTO":
            return "danger";
        default:
            return "neutral";
    }
}

const infoBox = "rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 p-4";

export function SeguimientoClient() {
    const searchParams = useSearchParams();
    const [numeroInicial] = useState(() => searchParams.get("numero") || "");
    const [data, setData] = useState<SeguimientoData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSearch = useCallback(async (numero: string) => {
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
    }, []);

    const searchedRef = useRef(false);
    useEffect(() => {
        if (numeroInicial && !searchedRef.current) {
            searchedRef.current = true;
            handleSearch(numeroInicial);
        }
    }, [numeroInicial, handleSearch]);

    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold text-body">Seguimiento de reporte</h1>
                <p className="mt-1 text-sm text-muted">
                    Consulta el estado de un reporte con su número de seguimiento
                </p>
            </div>

            <GlassCard className="mb-6">
                <SeguimientoForm onSearch={handleSearch} initialValue={numeroInicial} />
            </GlassCard>

            {isLoading && (
                <div className="glass rounded-2xl p-8 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600 dark:border-sky-800 dark:border-t-sky-400" />
                    <p className="mt-3 text-sm text-muted">Consultando...</p>
                </div>
            )}

            {error && (
                <div className="mx-auto max-w-xl">
                    <ErrorState
                        title="No encontramos información"
                        description={error}
                        onRetry={() => {
                            setError("");
                            if (numeroInicial) handleSearch(numeroInicial);
                        }}
                    />
                </div>
            )}

            {data && (
                <div className="glass rounded-2xl p-6 animate-floatUp space-y-5">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-subtle">{data.plataforma}</p>
                            <h2 className="text-lg font-semibold text-body">{data.identificador}</h2>
                        </div>
                        <Badge variant={badgeVariant(data.badge)}>{data.estadoVisual}</Badge>
                    </div>

                    <div className={infoBox}>
                        <p className="text-sm font-medium text-body">{data.mensaje}</p>
                        <p className="mt-1 text-xs text-subtle">
                            Reportado el {new Date(data.creadoEn).toLocaleDateString("es-CO")}
                        </p>
                    </div>

                    {data.clasificacion && (
                        <div className={infoBox}>
                            <h3 className="mb-2 text-sm font-semibold text-body">Clasificación del reporte</h3>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="info">{data.clasificacion.categoriaGrupo}</Badge>
                            </div>
                            {data.clasificacion.contienePii && (
                                <p className="mt-2 text-xs text-muted">
                                    El texto fue anonimizado para proteger datos personales.
                                </p>
                            )}
                        </div>
                    )}

                    {data.ranking && (
                        <div className={infoBox}>
                            <h3 className="mb-2 text-sm font-semibold text-body">Riesgo del identificador</h3>
                            <div className="flex items-center gap-4">
                                <div className="text-center">
                                    <p className="font-mono text-2xl font-bold text-body">{data.ranking.score}</p>
                                    <p className="text-[10px] text-subtle">Score 0-100</p>
                                </div>
                                <Badge variant={riesgoVariant(data.ranking.nivelRiesgo)}>
                                    Riesgo {data.ranking.nivelRiesgo}
                                </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted">
                                Basado en {data.ranking.totalReportes} reportes
                                ({data.ranking.reportesAutenticados} autenticados, {data.ranking.reportesAnonimos} anónimos).
                            </p>
                        </div>
                    )}

                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
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

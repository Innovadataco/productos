"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SeguimientoForm } from "@/components/modules/SeguimientoForm";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import type { BadgeVariant } from "@/components/ui/Badge";
import { CATEGORIAS_LABELS } from "@/lib/labels";
import { EstadoTransicion } from "./EstadoTransicion";

type ClasificacionData = {
    categoria: string;
    categoriaLabel: string;
    categoriaGrupo: string;
    categoriasSecundarias?: string[];
    contienePii: boolean;
};

type RankingData = {
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
};

// SPEC-324: un reporte ajeno. Estos 4 campos son TODO lo que el backend manda —
// no hay texto ni autor en el payload, así que la pantalla no puede mostrarlos.
type OtroReporte = {
    id: string;
    creadoEn: string;
    pais: string | null;
    ciudad: string | null;
    categoriaLabel: string | null;
    // SPEC-439: el TIPO de autor, nunca su identidad.
    esAnonimo: boolean;
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
    actividad: "alta" | "baja" | null;
    ranking: RankingData | null;
    // null para el visitante anónimo (su pantalla es la de siempre).
    otrosReportes: OtroReporte[] | null;
};

/** Fecha y hora del evento en hora de Colombia (nunca UTC en pantalla). */
function fechaHoraColombia(iso: string): string {
    return new Date(iso).toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function lugarDe(r: OtroReporte): string {
    return [r.ciudad, r.pais].filter(Boolean).join(", ") || "Sin ubicación";
}

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


const infoBox = "rounded-xl border border-tinta/10 bg-tinta/5 p-4";

// Severidad fija por conducta (spec 089-US4): permite ordenar por gravedad sin backend.
const SEVERIDAD_CONDUCTA: Record<string, number> = {
    CONTACTO_INSISTENTE: 30,
    SOLICITUD_MATERIAL: 80,
    OFRECIMIENTO_REGALOS: 60,
    SUPLANTACION_IDENTIDAD: 70,
    SOLICITUD_ENCUENTRO: 90,
    COMPARTIMIENTO_SEXUAL: 95,
    EXTORSION: 85,
    CONTENIDO_GENERADO_IA: 75,
    DIFUSION_NO_CONSENTIDA: 90,
    DOXING: 85,
    SPAM: 0,
    OTRO: 20,
};

// SPAM/OTRO no son conductas de riesgo y nunca se muestran al usuario.
const CONDUCTAS_SIN_RIESGO = new Set(["SPAM", "OTRO"]);

function conductasOrdenadas(clasificacion: ClasificacionData): string[] {
    const todas = [clasificacion.categoria, ...(clasificacion.categoriasSecundarias ?? [])];
    const unicas = [...new Set(todas)];
    return unicas
        .filter((c) => !CONDUCTAS_SIN_RIESGO.has(c))
        .sort((a, b) => (SEVERIDAD_CONDUCTA[b] ?? 0) - (SEVERIDAD_CONDUCTA[a] ?? 0));
}

export function SeguimientoClient() {
    const searchParams = useSearchParams();
    // Spec 091-US2: sin query param, el RPT puede llegar por sessionStorage (URL limpia).
    const [numeroInicial] = useState(() => {
        const porUrl = searchParams.get("numero");
        if (porUrl) return porUrl;
        if (typeof window !== "undefined") {
            const guardado = sessionStorage.getItem("seguimiento.rpt");
            if (guardado) {
                sessionStorage.removeItem("seguimiento.rpt");
                return guardado;
            }
        }
        return "";
    });
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
                <h1 className="text-2xl font-bold text-body">Consulta el estado de tu reporte</h1>
                <p className="mt-1 text-sm text-muted">
                    Ingresa el número de seguimiento para conocer el estado actual del reporte.
                </p>
            </div>

            <GlassCard className="mb-6">
                <SeguimientoForm onSearch={handleSearch} initialValue={numeroInicial} />
            </GlassCard>

            {isLoading && (
                <div className="glass rounded-2xl p-8 text-center">
                    <Cargando texto="Consultando..." />
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
                        <div className="flex items-center gap-3">
                            <EstadoTransicion enProceso={data.enProceso} />
                            <Badge variant={badgeVariant(data.badge)}>{data.estadoVisual}</Badge>
                        </div>
                    </div>

                    <div className={infoBox}>
                        <p className="text-sm font-medium text-body">{data.mensaje}</p>
                        <p className="mt-1 text-xs text-subtle">
                            Reportado el {new Date(data.creadoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
                        </p>
                        <p className="mt-2 text-xs font-medium text-body">Gracias por reportar.</p>
                    </div>

                    {data.clasificacion && (
                        <div className={infoBox}>
                            <h3 className="mb-2 text-sm font-semibold text-body">Conductas identificadas</h3>
                            {conductasOrdenadas(data.clasificacion).length === 0 ? (
                                <p className="text-sm text-muted">No se identifica riesgo</p>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2">
                                    {conductasOrdenadas(data.clasificacion).map((c) => (
                                        <Badge key={c} variant="info">
                                            {CATEGORIAS_LABELS[c] ?? c}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            {data.clasificacion.contienePii && (
                                <p className="mt-2 text-xs text-muted">
                                    El texto fue anonimizado para proteger datos personales.
                                </p>
                            )}
                        </div>
                    )}

                    {data.ranking && (
                        <div className={infoBox}>
                            <h3 className="mb-2 text-sm font-semibold text-body">Actividad de la cuenta</h3>
                            <Badge variant="info">
                                Actividad {data.actividad === "alta" ? "alta" : "baja"} de reportes
                            </Badge>
                            <p className="mt-2 text-xs text-muted">
                                Basado en {data.ranking.totalReportes} reportes
                                ({data.ranking.reportesAutenticados} autenticados, {data.ranking.reportesAnonimos} anónimos).
                            </p>
                        </div>
                    )}

                    {/* SPEC-324: otros reportes del MISMO identificador. Solo fecha y
                        hora, país, ciudad y clasificación — el payload no trae texto
                        ni autor, y esta lista no puede inventarlos. */}
                    {data.otrosReportes && data.otrosReportes.length > 0 && (
                        <div className={infoBox}>
                            <h3 className="text-sm font-semibold text-body">Otros reportes de esta cuenta</h3>
                            <p className="mt-1 text-xs text-subtle">
                                Otras personas reportaron la misma cuenta. Se muestra cuándo y dónde
                                ocurrió y qué conducta identificó el sistema; nunca el texto ni quién reportó.
                            </p>
                            <ul className="mt-3 space-y-2">
                                {data.otrosReportes.map((r) => (
                                    <li
                                        key={r.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-tinta/5 px-3 py-2"
                                    >
                                        <div className="text-xs">
                                            <p className="font-medium text-body">{fechaHoraColombia(r.creadoEn)}</p>
                                            <p className="text-subtle">{lugarDe(r)}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-subtle">{r.esAnonimo ? "anónimo" : "otro padre"}</span>
                                            {r.categoriaLabel && <Badge variant="info">{r.categoriaLabel}</Badge>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="space-y-3 border-t border-tinta/10 pt-4">
                        {/* SPEC-340 (A-68 §2.5): el CTA "Reportar de nuevo a este
                            identificador" de SPEC-324 se retiró — superado: el camino
                            correcto es "Agregar otro evento" DESDE el reporte, en Mis
                            reportes, con los datos heredados. */}
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatCategoria } from "@/lib/labels";

type BadgeVisual = "warning" | "success" | "muted";

interface DetalleReporte {
    id: string;
    identificador: string;
    plataforma: string;
    ciudad: string;
    pais: string;
    creadoEn: string;
    estadoVisual: string;
    badge: BadgeVisual;
    enProceso: boolean;
}

interface VotoModelo {
    modelo: string;
    categorias: Array<{ categoria: string; cumple: boolean; preguntasCumplidas: string[] }>;
}

interface DetalleResponse {
    reporte: DetalleReporte;
    clasificacion: {
        categoria: string;
        categoriaLabel: string;
        confianza: number;
        categoriasSecundarias: Array<{ categoria: string; score: number }>;
    } | null;
    votosModelos: VotoModelo[];
    porcentajes: Record<string, number>;
    analisis: string | null;
}

function estadoBadgeClass(badge: BadgeVisual): string {
    const base = "rounded-full px-3 py-1 text-xs font-medium ";
    switch (badge) {
        case "warning":
            return base + "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
        case "success":
            return base + "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
        case "muted":
        default:
            return base + "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    }
}

/**
 * Detalle PRIVADO de un reporte del usuario (spec 090, US3).
 * Muestra la matriz de la rúbrica (categorías × modelos) y el análisis
 * determinista. Sin "% de riesgo" global: solo presencia por categoría.
 */
export function MisReporteDetalle({ reporteId }: { reporteId: string }) {
    const router = useRouter();
    const [data, setData] = useState<DetalleResponse | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setError("");
        fetch(`/api/reportes/mis-reportes/${encodeURIComponent(reporteId)}`, { credentials: "include" })
            .then(async (res) => {
                if (res.status === 401) {
                    router.push("/login");
                    return;
                }
                if (res.status === 403) throw new Error("Este reporte pertenece a otro usuario.");
                if (res.status === 404) throw new Error("No encontramos este reporte.");
                if (!res.ok) throw new Error("Error al cargar el detalle del reporte");
                setData(await res.json());
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Error"))
            .finally(() => setLoading(false));
    }, [reporteId, router]);

    if (loading) {
        return (
            <div className="glass rounded-2xl p-8 text-center animate-pulse">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-accent" />
                <p className="mt-3 text-sm text-subtle">Cargando detalle...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <ErrorState
                title="No pudimos cargar el detalle"
                description={error || "Ocurrió un problema al consultar la información."}
                onRetry={() => window.location.reload()}
            />
        );
    }

    const { reporte, clasificacion, votosModelos, porcentajes, analisis } = data;
    const modelos = votosModelos.map((v) => v.modelo);
    const categorias = Object.keys(porcentajes).sort();
    const cumplePorModelo = new Map<string, Map<string, boolean>>(
        votosModelos.map((v) => [v.modelo, new Map(v.categorias.map((c) => [c.categoria, c.cumple]))])
    );

    return (
        <div className="space-y-6">
            <div>
                <Link href="/mis-reportes" className="text-sm text-accent hover:underline">
                    ← Volver a mis reportes
                </Link>
                <h1 className="mt-2 text-2xl font-bold text-body">Detalle del reporte</h1>
            </div>

            <GlassCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="font-semibold text-body truncate">{reporte.identificador}</h2>
                        <p className="text-sm text-muted">
                            {reporte.plataforma} · {reporte.ciudad}, {reporte.pais}
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">
                            Reportado el {new Date(reporte.creadoEn).toLocaleDateString("es-CO")}
                        </p>
                    </div>
                    <span className={estadoBadgeClass(reporte.badge)}>{reporte.estadoVisual}</span>
                </div>
                {clasificacion && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(() => {
                            // Spec 093-US2: SPAM y OTRO nunca se muestran; sin riesgo → mensaje neutro
                            const conductas = [
                                { categoria: clasificacion.categoria, label: clasificacion.categoriaLabel },
                                ...clasificacion.categoriasSecundarias.map((s) => ({
                                    categoria: s.categoria,
                                    label: formatCategoria(s.categoria),
                                })),
                            ].filter((c) => c.categoria !== "SPAM" && c.categoria !== "OTRO");
                            if (conductas.length === 0) {
                                return <p className="text-sm text-muted">No se identifica riesgo</p>;
                            }
                            return (
                                <>
                                    <span className="text-xs text-muted">Conductas identificadas:</span>
                                    {conductas.map((c) => (
                                        <span
                                            key={c.categoria}
                                            className="rounded-full bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-xs font-medium text-accent"
                                        >
                                            {c.label}
                                        </span>
                                    ))}
                                </>
                            );
                        })()}
                    </div>
                )}
            </GlassCard>

            {!clasificacion ? (
                <GlassCard className="p-6">
                    <p className="text-sm text-muted">
                        Tu reporte aún está en proceso. Cuando la clasificación termine, aquí verás el detalle de la
                        evaluación por categoría.
                    </p>
                </GlassCard>
            ) : (
                <>
                    <GlassCard className="p-6">
                        <h3 className="text-lg font-semibold text-body">Evaluación por categoría</h3>
                        <p className="mt-1 text-xs text-muted">
                            Cada modelo evalúa el texto con una rúbrica de preguntas factuales. La columna final
                            indica en cuántos modelos la categoría estuvo presente.
                        </p>
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2 pr-3 text-left font-medium text-muted">Categoría</th>
                                        {modelos.map((m) => (
                                            <th key={m} className="py-2 px-2 text-center font-medium text-muted">
                                                {m}
                                            </th>
                                        ))}
                                        <th className="py-2 pl-3 text-right font-medium text-muted">Presencia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {categorias.map((cat) => (
                                        <tr key={cat} className="border-b border-slate-100 dark:border-slate-800">
                                            <td className="py-2 pr-3 text-body">{formatCategoria(cat)}</td>
                                            {modelos.map((m) => {
                                                const cumple = cumplePorModelo.get(m)?.get(cat);
                                                return (
                                                    <td key={m} className="py-2 px-2 text-center">
                                                        {cumple ? (
                                                            <span className="text-emerald-600 dark:text-emerald-400" aria-label={`${m}: cumple`}>
                                                                ✓
                                                            </span>
                                                        ) : (
                                                            <span className="text-subtle" aria-label={`${m}: no cumple`}>
                                                                —
                                                            </span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="py-2 pl-3 text-right font-mono text-body">
                                                {Math.round((porcentajes[cat] ?? 0) * 100)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </GlassCard>

                    {analisis && (
                        <GlassCard className="p-6">
                            <h3 className="text-lg font-semibold text-body">Análisis</h3>
                            <p className="mt-2 text-sm text-muted">{analisis}</p>
                        </GlassCard>
                    )}
                </>
            )}
        </div>
    );
}

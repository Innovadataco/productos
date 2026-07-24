"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BadgeVisual = "warning" | "success" | "muted";

type ClasificacionItem = {
    categoria: string;
    categoriaLabel: string;
    categoriaGrupo: string;
};

// Spec 089/091: sin score ni etiqueta de riesgo — solo hechos agregados.
type RankingItem = {
    totalReportes: number;
};

type ReporteItem = {
    id: string;
    identificador: string;
    plataforma: string;
    estadoVisual: string;
    badge: BadgeVisual;
    mensaje: string;
    slaHoras: number;
    numeroSeguimiento: string | null;
    ciudad: string;
    pais: string;
    esAnonimo: boolean;
    creadoEn: string;
    clasificacion: ClasificacionItem | null;
    ranking: RankingItem | null;
};

type ConsultaInline = {
    tieneReportes: boolean;
    actividad?: string;
    totalReportes?: number;
    resumenPlataformas?: string;
    categorias?: { categoria: string; total: number }[];
    mensaje?: string;
};

export function MisReportesList({ items }: { items: ReporteItem[] }) {
    const router = useRouter();
    const [expandidoId, setExpandidoId] = useState<string | null>(null);
    const [consultaInline, setConsultaInline] = useState<ConsultaInline | null>(null);
    const [cargandoInline, setCargandoInline] = useState(false);

    // Sin numeroSeguimiento: la consulta se expande INLINE vía POST (el identificador
    // nunca viaja en la URL, spec 091-US1). Con RPT: se navega al seguimiento.
    async function verIdentificador(r: ReporteItem) {
        if (r.numeroSeguimiento) {
            // Spec 093-US4: el número viaja por sessionStorage, no por query string.
            sessionStorage.setItem("seguimiento.rpt", r.numeroSeguimiento);
            router.push("/seguimiento");
            return;
        }
        if (expandidoId === r.id) {
            setExpandidoId(null);
            setConsultaInline(null);
            return;
        }
        setExpandidoId(r.id);
        setCargandoInline(true);
        setConsultaInline(null);
        try {
            const res = await fetch("/api/consulta", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identificador: r.identificador }),
            });
            const json = await res.json();
            setConsultaInline(json as ConsultaInline);
        } catch {
            setConsultaInline({ tieneReportes: false, mensaje: "No se pudo cargar la consulta." });
        } finally {
            setCargandoInline(false);
        }
    }

    if (items.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center">
                <p className="text-muted">Aún no has realizado reportes.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((r) => (
                <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver seguimiento del reporte ${r.numeroSeguimiento || r.identificador}`}
                    onClick={() => verIdentificador(r)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void verIdentificador(r);
                        }
                    }}
                    className="glass rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent"
                >
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-body truncate">{r.identificador}</h3>
                            {r.esAnonimo && (
                                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-muted">
                                    Anónimo
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted">
                            {r.plataforma} · {r.ciudad}, {r.pais}
                        </p>
                        {r.numeroSeguimiento && (
                            <p className="text-xs text-subtle font-mono mt-0.5">{r.numeroSeguimiento}</p>
                        )}
                        {r.clasificacion && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="rounded-full bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium text-accent">
                                    {r.clasificacion.categoriaGrupo}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-2">
                        <div className="flex items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${estadoBadgeClass(r.badge)}`}>
                                {r.estadoVisual}
                            </span>
                            <span className="text-xs text-subtle whitespace-nowrap">
                                {new Date(r.creadoEn).toLocaleDateString("es-CO")}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/mis-reportes/${r.id}`);
                            }}
                            className="text-xs font-medium text-accent hover:underline focus:outline-none focus:ring-2 focus:ring-accent rounded"
                            aria-label={`Ver detalle del reporte ${r.numeroSeguimiento || r.identificador}`}
                        >
                            Ver detalle
                        </button>
                        <p className="text-xs text-muted max-w-xs text-right">{r.mensaje}</p>
                        {r.ranking && (
                            <span className="text-[10px] text-subtle">{r.ranking.totalReportes} reportes registrados</span>
                        )}
                    </div>

                    {expandidoId === r.id && (
                        <div
                            className="w-full border-t border-slate-200 dark:border-slate-700 pt-3"
                            data-testid={`consulta-inline-${r.id}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {cargandoInline ? (
                                <p className="text-xs text-muted">Consultando...</p>
                            ) : consultaInline ? (
                                consultaInline.tieneReportes ? (
                                    <div className="space-y-1.5 text-xs text-muted">
                                        <p className="font-medium text-body">
                                            {consultaInline.resumenPlataformas ?? `${consultaInline.totalReportes ?? 0} reportes`}
                                        </p>
                                        <p>
                                            Actividad {consultaInline.actividad ?? "baja"} de reportes ·{" "}
                                            {(consultaInline.categorias ?? []).map((c) => `${c.categoria} (${c.total})`).join(" · ") || "sin categorías de riesgo"}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted">{consultaInline.mensaje ?? "Sin reportes registrados."}</p>
                                )
                            ) : null}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
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

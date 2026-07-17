"use client";

import { useState, useEffect } from "react";

type NivelRiesgo = "BAJO" | "MEDIO" | "ALTO" | "CRITICO";

type SimulacionItem = {
    identificador: string;
    plataformaNombre: string;
    score: number;
    scoreAjustado: number;
    nivelActual: NivelRiesgo;
    nivelAjustado: NivelRiesgo;
    cambioNivel: number;
    pesoAnonimoPromedio: number;
    pesoAutenticadoPromedio: number;
    totalReportes: number;
    reportesAnonimos: number;
    reportesAutenticados: number;
};

type Resumen = {
    totalItems: number;
    totalPages: number;
    currentPage: number;
    subidas: number;
    bajadas: number;
    sinCambio: number;
};

const NIVEL_LABELS: Record<NivelRiesgo, string> = {
    BAJO: "Bajo",
    MEDIO: "Medio",
    ALTO: "Alto",
    CRITICO: "Crítico",
};

const NIVEL_COLORS: Record<NivelRiesgo, string> = {
    BAJO: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    MEDIO: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ALTO: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    CRITICO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function AdminAntiAbusoSimulacion() {
    const [data, setData] = useState<{ resumen: Resumen; detalles: SimulacionItem[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/admin/anti-abuso/simulacion-score?page=${page}`, { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error("Error cargando simulación");
                return r.json();
            })
            .then(setData)
            .catch(() => setError("Error cargando simulación"))
            .finally(() => setLoading(false));
    }, [page]);

    if (loading) {
        return (
            <div className="space-y-6" aria-busy="true" aria-label="Cargando simulación">
                <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
                    ))}
                </div>
                <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
            </div>
        );
    }

    if (error) return <p className="text-red-600" role="alert">{error}</p>;
    if (!data) return null;

    const { resumen, detalles } = data;

    return (
        <section className="space-y-6" aria-labelledby="anti-abuso-title">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 id="anti-abuso-title" className="text-2xl font-bold text-body">Anti-abuso</h1>
                    <p className="mt-1 text-sm text-muted">
                        Simulación en seco del ajuste de score por señal de fuente.
                        El feature flag sigue desactivado; esta vista no altera datos.
                    </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Flag: scoring.source_weight.enabled = false
                </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Identificadores analizados" value={resumen.totalItems} />
                <MetricCard label="Subidas de nivel" value={resumen.subidas} tone="up" />
                <MetricCard label="Bajadas de nivel" value={resumen.bajadas} tone="down" />
                <MetricCard label="Sin cambio" value={resumen.sinCambio} />
            </div>

            <div className="glass rounded-2xl p-6">
                <h2 className="mb-4 text-lg font-semibold text-body">Comparación score actual vs. ajustado</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                            <tr>
                                <th className="px-4 py-3 font-medium">Identificador</th>
                                <th className="px-4 py-3 font-medium">Plataforma</th>
                                <th className="px-4 py-3 font-medium">Reportes</th>
                                <th className="px-4 py-3 font-medium">Peso anónimo</th>
                                <th className="px-4 py-3 font-medium">Peso autenticado</th>
                                <th className="px-4 py-3 font-medium">Score actual</th>
                                <th className="px-4 py-3 font-medium">Score ajustado</th>
                                <th className="px-4 py-3 font-medium">Nivel actual</th>
                                <th className="px-4 py-3 font-medium">Nivel ajustado</th>
                                <th className="px-4 py-3 font-medium">Cambio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {detalles.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-4 py-6 text-center text-subtle">
                                        No hay identificadores para simular.
                                    </td>
                                </tr>
                            ) : (
                                detalles.map((row) => (
                                    <tr key={`${row.identificador}-${row.plataformaNombre}`}>
                                        <td className="px-4 py-3 font-mono text-body">{row.identificador}</td>
                                        <td className="px-4 py-3 text-body">{row.plataformaNombre}</td>
                                        <td className="px-4 py-3 text-body">
                                            {row.totalReportes}
                                            <span className="ml-2 text-xs text-muted">
                                                ({row.reportesAnonimos}A / {row.reportesAutenticados}Auth)
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-body">{row.pesoAnonimoPromedio.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-body">{row.pesoAutenticadoPromedio.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-body">{row.score}</td>
                                        <td className="px-4 py-3 text-body">{row.scoreAjustado}</td>
                                        <td className="px-4 py-3">
                                            <NivelBadge nivel={row.nivelActual} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <NivelBadge nivel={row.nivelAjustado} />
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.cambioNivel === 0 ? (
                                                <span className="text-subtle">—</span>
                                            ) : (
                                                <span className={`font-semibold ${row.cambioNivel > 0 ? "text-red-600" : "text-green-600"}`}>
                                                    {row.cambioNivel > 0 ? `▲ ${row.cambioNivel}` : `▼ ${Math.abs(row.cambioNivel)}`}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {resumen.totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-body hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                        >
                            Anterior
                        </button>
                        <span className="text-sm text-muted">
                            Página {resumen.currentPage} de {resumen.totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(resumen.totalPages, p + 1))}
                            disabled={page >= resumen.totalPages}
                            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-body hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:hover:bg-slate-700"
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: "up" | "down" }) {
    const toneClass =
        tone === "up"
            ? "text-red-600"
            : tone === "down"
            ? "text-green-600"
            : "text-body";
    return (
        <article className="glass rounded-2xl p-6 transition hover:shadow-md motion-reduce:transition-none">
            <p className="text-sm font-medium text-muted">{label}</p>
            <p className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</p>
        </article>
    );
}

function NivelBadge({ nivel }: { nivel: NivelRiesgo }) {
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${NIVEL_COLORS[nivel]}`}>
            {NIVEL_LABELS[nivel]}
        </span>
    );
}

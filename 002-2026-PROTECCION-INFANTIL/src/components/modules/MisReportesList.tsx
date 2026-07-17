"use client";

type ClasificacionItem = {
    categoria: string;
    categoriaLabel: string;
    confianza: number;
};

type RankingItem = {
    score: number;
    nivelRiesgo: "BAJO" | "MEDIO" | "ALTO";
    totalReportes: number;
};

type ReporteItem = {
    id: string;
    identificador: string;
    plataforma: string;
    estadoVisual: string;
    numeroSeguimiento: string | null;
    ciudad: string;
    pais: string;
    esAnonimo: boolean;
    creadoEn: string;
    clasificacion: ClasificacionItem | null;
    ranking: RankingItem | null;
};

const NIVEL_STYLES = {
    BAJO: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    MEDIO: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    ALTO: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
};

export function MisReportesList({ items }: { items: ReporteItem[] }) {
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
                    className="glass rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition hover:-translate-y-0.5 hover:shadow-md"
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
                                    {r.clasificacion.categoriaLabel}
                                </span>
                                <span className="text-[10px] text-subtle">
                                    Confianza {Math.round(r.clasificacion.confianza * 100)}%
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-2">
                        <div className="flex items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-medium ${estadoBadgeClass(r.estadoVisual)}`}>
                                {r.estadoVisual}
                            </span>
                            <span className="text-xs text-subtle whitespace-nowrap">
                                {new Date(r.creadoEn).toLocaleDateString("es-CO")}
                            </span>
                        </div>
                        {r.ranking && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-accent">{r.ranking.score}</span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${NIVEL_STYLES[r.ranking.nivelRiesgo]}`}>
                                    {r.ranking.nivelRiesgo}
                                </span>
                                <span className="text-[10px] text-subtle">{r.ranking.totalReportes} reportes</span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function estadoBadgeClass(estadoVisual: string): string {
    const base = "rounded-full px-3 py-1 text-xs font-medium ";
    switch (estadoVisual) {
        case "Recibido":
            return base + "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
        case "En procesamiento":
            return base + "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300";
        case "Procesado":
            return base + "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
        case "En revisión":
        case "En revisión de privacidad":
            return base + "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
        case "Vinculado a reporte existente":
            return base + "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
        default:
            return base + "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    }
}

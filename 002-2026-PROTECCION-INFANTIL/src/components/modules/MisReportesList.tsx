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
    BAJO: "bg-green-100 text-green-800",
    MEDIO: "bg-amber-100 text-amber-800",
    ALTO: "bg-red-100 text-red-800",
};

export function MisReportesList({ items }: { items: ReporteItem[] }) {
    if (items.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center">
                <p className="text-slate-600">Aún no has realizado reportes.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {items.map((r) => (
                <div
                    key={r.id}
                    className="glass rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-800 truncate">
                                {r.identificador}
                            </h3>
                            {r.esAnonimo && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    Anónimo
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500">
                            {r.plataforma} · {r.ciudad}, {r.pais}
                        </p>
                        {r.numeroSeguimiento && (
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                                {r.numeroSeguimiento}
                            </p>
                        )}
                        {r.clasificacion && (
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                                    {r.clasificacion.categoriaLabel}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    Confianza {Math.round(r.clasificacion.confianza * 100)}%
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-2">
                        <div className="flex items-center gap-2">
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-medium ${estadoBadgeClass(r.estadoVisual)}`}
                            >
                                {r.estadoVisual}
                            </span>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                {new Date(r.creadoEn).toLocaleDateString("es-CO")}
                            </span>
                        </div>
                        {r.ranking && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold text-primary-700">
                                    {r.ranking.score}
                                </span>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${NIVEL_STYLES[r.ranking.nivelRiesgo]}`}>
                                    {r.ranking.nivelRiesgo}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    {r.ranking.totalReportes} reportes
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function estadoBadgeClass(estadoVisual: string): string {
    switch (estadoVisual) {
        case "Recibido":
            return "bg-slate-100 text-slate-700";
        case "En procesamiento":
            return "bg-blue-50 text-blue-700";
        case "Procesado":
            return "bg-accent-50 text-accent-700";
        case "En revisión":
        case "En revisión de privacidad":
            return "bg-amber-50 text-amber-700";
        case "Vinculado a reporte existente":
            return "bg-slate-100 text-slate-600";
        default:
            return "bg-slate-100 text-slate-700";
    }
}

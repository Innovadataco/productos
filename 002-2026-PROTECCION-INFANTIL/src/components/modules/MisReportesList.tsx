"use client";

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
                    className="glass rounded-xl p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
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
                    </div>

                    <div className="flex items-center gap-3 mt-2 sm:mt-0">
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${estadoBadgeClass(r.estadoVisual)}`}
                        >
                            {r.estadoVisual}
                        </span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                            {new Date(r.creadoEn).toLocaleDateString("es-CO")}
                        </span>
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
"use client";
import { useMemo, useState } from "react";

interface Props {
    filas: Array<Record<string, unknown>>;
    porPagina?: number;
}

export function TablaBI({ filas, porPagina = 25 }: Props) {
    const [pagina, setPagina] = useState(0);
    const columnas = useMemo(() => (filas[0] ? Object.keys(filas[0]) : []), [filas]);
    const paginas = Math.max(1, Math.ceil(filas.length / porPagina));
    const visibles = filas.slice(pagina * porPagina, (pagina + 1) * porPagina);
    return (
        <div data-testid="tabla-bi" className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <tr>
                        {columnas.map((c) => (
                            <th key={c} className="px-3 py-2 font-semibold">
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {visibles.map((fila, i) => (
                        <tr key={i} className="border-b border-slate-100">
                            {columnas.map((c) => (
                                <td key={c} className="px-3 py-2 text-slate-800">
                                    {String(fila[c] ?? "")}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {paginas > 1 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-600" data-testid="tabla-paginacion">
                    <button
                        type="button"
                        onClick={() => setPagina((p) => Math.max(0, p - 1))}
                        disabled={pagina === 0}
                        className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-40"
                    >
                        Anterior
                    </button>
                    <span>
                        Página {pagina + 1} de {paginas}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
                        disabled={pagina >= paginas - 1}
                        className="rounded border border-slate-300 px-2 py-0.5 disabled:opacity-40"
                    >
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
}

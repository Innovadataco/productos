"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";

const PAGE_SIZE_OPTIONS = ["10", "25", "50"];

const CATEGORIAS: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    OTRO: "Otro",
};

const FUENTES: Record<string, string> = {
    correccion_admin: "Corrección admin",
    importacion: "Importación",
    feedback_usuario: "Feedback usuario",
};

type DatasetItem = {
    id: string;
    texto: string;
    clasificacionCorrecta: string;
    fuente: string;
    textoAnonimizado: boolean;
    creadoEn: string;
    correccion: {
        categoriaOriginal: string;
        categoriaCorregida: string;
    } | null;
};

function formatCategoria(categoria: string) {
    return CATEGORIAS[categoria] || categoria;
}

export default function DatasetEntrenamientoPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [items, setItems] = useState<DatasetItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [total, setTotal] = useState(0);
    const [anonimizados, setAnonimizados] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const page = Math.max(1, Number(searchParams.get("page") || "1"));
    const pageSize = searchParams.get("pageSize") || "25";

    const buildQueryString = useCallback(
        (override: Record<string, string> = {}) => {
            const params = new URLSearchParams();
            params.set("pageSize", pageSize);
            params.set("page", String(page));
            Object.entries(override).forEach(([k, v]) => {
                if (v) params.set(k, v);
                else params.delete(k);
            });
            return params.toString();
        },
        [pageSize, page]
    );

    const fetchDataset = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/dataset-entrenamiento?${buildQueryString()}`, {
                credentials: "include",
            });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando dataset");
            const json = await res.json();
            setItems(json.items || []);
            setTotal(json.total || 0);
            setAnonimizados(json.anonimizados || 0);
            setTotalPages(json.totalPages || 0);
            setError("");
        } catch {
            setError("Error cargando dataset de entrenamiento");
        } finally {
            setLoading(false);
        }
    }, [buildQueryString]);

    useEffect(() => {
        fetchDataset();
    }, [fetchDataset]);

    const goToPage = (newPage: number) => {
        router.push(`${pathname}?${buildQueryString({ page: String(newPage) })}`);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Dataset de entrenamiento</h1>
                <p className="text-sm text-muted">
                    Registros utilizados para mejorar el clasificador de IA. Solo se listan los registros con texto anonimizado.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="glass rounded-2xl p-4">
                    <p className="text-xs font-medium text-subtle uppercase tracking-wide">Total registros</p>
                    <p className="mt-1 text-2xl font-bold text-body">{total}</p>
                </div>
                <div className="glass rounded-2xl p-4">
                    <p className="text-xs font-medium text-subtle uppercase tracking-wide">Anonimizados</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{anonimizados}</p>
                </div>
                <div className="glass rounded-2xl p-4">
                    <p className="text-xs font-medium text-subtle uppercase tracking-wide">Pendientes de anonimizar</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{Math.max(0, total - anonimizados)}</p>
                </div>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
                    {error}
                </div>
            )}

            <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-subtle">
                            <tr>
                                <th className="px-4 py-3 font-medium">Texto</th>
                                <th className="px-4 py-3 font-medium">Clasificación</th>
                                <th className="px-4 py-3 font-medium">Fuente</th>
                                <th className="px-4 py-3 font-medium">Anonimización</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                        <p className="mt-2 text-xs">Cargando...</p>
                                    </td>
                                </tr>
                            ) : items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-subtle">
                                        No hay registros anonimizados en el dataset todavía. Los registros pendientes se procesan en segundo plano.
                                    </td>
                                </tr>
                            ) : (
                                items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                        <td className="px-4 py-3 max-w-md">
                                            <p className="truncate text-body" title={item.texto}>
                                                {item.texto}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-body">
                                            {formatCategoria(item.clasificacionCorrecta)}
                                            {item.correccion && (
                                                <span className="ml-2 text-xs text-subtle">
                                                    (corregido desde {formatCategoria(item.correccion.categoriaOriginal)})
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-subtle">{FUENTES[item.fuente] || item.fuente}</td>
                                        <td className="px-4 py-3">
                                            {item.textoAnonimizado ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                                                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                                                    Anonimizado
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                    <ExclamationIcon className="h-3.5 w-3.5" />
                                                    Sin anonimizar
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-subtle whitespace-nowrap">
                                            {new Date(item.creadoEn).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                        <p className="text-sm text-subtle">
                            Página {page} de {totalPages} · {total} registros
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => goToPage(page - 1)} disabled={page <= 1} variant="outline">
                                Anterior
                            </Button>
                            <Button onClick={() => goToPage(page + 1)} disabled={page >= totalPages} variant="outline">
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ShieldCheckIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
    );
}

function ExclamationIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
    );
}

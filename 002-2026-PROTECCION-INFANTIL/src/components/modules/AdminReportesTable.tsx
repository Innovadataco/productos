"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { AdminReporteDetalle } from "./AdminReporteDetalle";

const ESTADOS = [
    { value: "", label: "Todos los estados" },
    { value: "PENDIENTE", label: "Pendiente" },
    { value: "PROCESANDO", label: "Procesando" },
    { value: "CLASIFICADO", label: "Clasificado" },
    { value: "REVISION_MANUAL", label: "Revisión manual" },
    { value: "POSIBLE_SPAM", label: "Posible spam" },
    { value: "REQUIERE_ANONIMIZACION", label: "Requiere anonimización" },
    { value: "CORREGIDO", label: "Corregido" },
];

const CATEGORIAS = [
    { value: "", label: "Todas las categorías" },
    { value: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
    { value: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
    { value: "OFRECIMIENTO_REGALOS", label: "Ofrecimiento de regalos" },
    { value: "SUPLANTACION_IDENTIDAD", label: "Suplantación de identidad" },
    { value: "SOLICITUD_ENCUENTRO", label: "Solicitud de encuentro" },
    { value: "COMPARTIMIENTO_SEXUAL", label: "Compartimiento sexual" },
    { value: "EXTORSION", label: "Extorsión" },
    { value: "CONTENIDO_GENERADO_IA", label: "Contenido generado por IA" },
    { value: "DIFUSION_NO_CONSENTIDA", label: "Difusión no consentida" },
    { value: "DOXING", label: "Doxing" },
    { value: "SPAM", label: "Spam" },
    { value: "OTRO", label: "Otro" },
];

const PAGE_SIZE_OPTIONS = ["10", "25", "50"];

type ReporteListItem = {
    id: string;
    identificador: string;
    numeroSeguimiento: string;
    estado: string;
    esAnonimo: boolean;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
    esRafaga: boolean;
    eliminado: boolean;
    creadoEn: string;
    fechaIncidente: string;
    ciudad: string;
    pais: string;
    plataforma: { id: string; nombre: string; clave: string };
    clasificacion: {
        categoria: string;
        confianza: number;
        correccion: { categoriaCorregida: string } | null;
    } | null;
};

type Plataforma = { id: string; nombre: string };

function formatEstado(estado: string) {
    return estado.replace(/_/g, " ");
}

function formatCategoria(categoria: string) {
    return CATEGORIAS.find((c) => c.value === categoria)?.label || categoria;
}

export function AdminReportesTable() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [reportes, setReportes] = useState<ReporteListItem[]>([]);
    const [plataformas, setPlataformas] = useState<Plataforma[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [selectedReporteId, setSelectedReporteId] = useState<string | null>(null);

    const [estado, setEstado] = useState(searchParams.get("estado") || "");
    const [plataformaId, setPlataformaId] = useState(searchParams.get("plataformaId") || "");
    const [categoria, setCategoria] = useState(searchParams.get("categoria") || "");
    const [fechaDesde, setFechaDesde] = useState(searchParams.get("fechaDesde") || "");
    const [fechaHasta, setFechaHasta] = useState(searchParams.get("fechaHasta") || "");
    const [incluirEliminados, setIncluirEliminados] = useState(searchParams.get("incluirEliminados") === "true");
    const [pageSize, setPageSize] = useState(searchParams.get("pageSize") || "25");
    const [q, setQ] = useState(searchParams.get("q") || "");

    const page = Math.max(1, Number(searchParams.get("page") || "1"));

    useEffect(() => {
        fetch("/api/plataformas", { credentials: "include" })
            .then((r) => r.json())
            .then((json) => setPlataformas(json.plataformas || []))
            .catch(() => setError("Error cargando plataformas"));
    }, []);

    const buildQueryString = useCallback(
        (override: Record<string, string> = {}) => {
            const params = new URLSearchParams();
            if (estado) params.set("estado", estado);
            if (plataformaId) params.set("plataformaId", plataformaId);
            if (categoria) params.set("categoria", categoria);
            if (fechaDesde) params.set("fechaDesde", fechaDesde);
            if (fechaHasta) params.set("fechaHasta", fechaHasta);
            if (incluirEliminados) params.set("incluirEliminados", "true");
            if (q.trim()) params.set("q", q.trim());
            params.set("pageSize", pageSize);
            params.set("page", String(page));
            Object.entries(override).forEach(([k, v]) => {
                if (v) params.set(k, v);
                else params.delete(k);
            });
            return params.toString();
        },
        [estado, plataformaId, categoria, fechaDesde, fechaHasta, incluirEliminados, pageSize, page, q]
    );

    const fetchReportes = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/reportes-revision?${buildQueryString()}`, {
                credentials: "include",
            });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando reportes");
            const json = await res.json();
            setError("");
            setReportes(json.reportes || []);
            setPagination(json.pagination);
        } catch {
            setError("Error cargando reportes");
        } finally {
            setLoading(false);
        }
    }, [buildQueryString]);

    useEffect(() => {
        fetchReportes();
    }, [fetchReportes]);

    const applyFilters = () => {
        router.push(`${pathname}?${buildQueryString({ page: "1" })}`);
    };

    const goToPage = (newPage: number) => {
        router.push(`${pathname}?${buildQueryString({ page: String(newPage) })}`);
    };

    const plataformaOptions = [
        { value: "", label: "Todas las plataformas" },
        ...plataformas.map((p) => ({ value: p.id, label: p.nombre })),
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Bandeja de reportes</h1>
                <p className="text-sm text-muted">Revisar, clasificar y gestionar los reportes de la comunidad.</p>
            </div>

            <div className="glass rounded-2xl p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="lg:col-span-4">
                        <Input
                            label="Buscar"
                            type="text"
                            placeholder="RPT-XXXX o identificador/nick"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    applyFilters();
                                }
                            }}
                        />
                    </div>
                    <Select label="Estado" options={ESTADOS} value={estado} onChange={(e) => setEstado(e.target.value)} />
                    <Select label="Plataforma" options={plataformaOptions} value={plataformaId} onChange={(e) => setPlataformaId(e.target.value)} />
                    <Select label="Categoría" options={CATEGORIAS} value={categoria} onChange={(e) => setCategoria(e.target.value)} />
                    <div>
                        <label className="block text-sm font-medium text-body mb-1.5">Mostrar</label>
                        <div className="relative">
                            <select
                                className="w-full rounded-xl px-4 py-3 text-sm text-body outline-none transition glass-input ring-accent-input appearance-none pr-10"
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(e.target.value);
                                    router.push(`${pathname}?${buildQueryString({ page: "1", pageSize: e.target.value })}`);
                                }}
                            >
                                {PAGE_SIZE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s} por página</option>
                                ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle">
                                <ChevronIcon className="h-4 w-4" />
                            </span>
                        </div>
                    </div>
                    <Input label="Desde" type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
                    <Input label="Hasta" type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
                    <div className="flex items-center gap-2 pt-6">
                        <input
                            id="incluirEliminados"
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                            checked={incluirEliminados}
                            onChange={(e) => setIncluirEliminados(e.target.checked)}
                        />
                        <label htmlFor="incluirEliminados" className="text-sm text-body">Incluir dados de baja</label>
                    </div>
                    <div className="flex items-end">
                        <Button onClick={applyFilters}>Aplicar filtros</Button>
                    </div>
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
                                <th className="px-4 py-3 font-medium">Seguimiento</th>
                                <th className="px-4 py-3 font-medium">Plataforma</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Señales</th>
                                <th className="px-4 py-3 font-medium">Categoría</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                                <th className="px-4 py-3 font-medium">Origen</th>
                                <th className="px-4 py-3 font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-subtle">
                                        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                                        <p className="mt-2 text-xs">Cargando...</p>
                                    </td>
                                </tr>
                            ) : reportes.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-subtle">
                                        No hay reportes que coincidan con los filtros.
                                    </td>
                                </tr>
                            ) : (
                                reportes.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                        <td className="px-4 py-3 font-mono text-xs text-body">{r.numeroSeguimiento}</td>
                                        <td className="px-4 py-3 text-body">{r.plataforma.nombre}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-body">
                                                    {formatEstado(r.estado)}
                                                </span>
                                                {r.eliminado && (
                                                    <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                                                        Eliminado
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {r.prioridadAlta && (
                                                    <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                                                        Prioridad
                                                    </span>
                                                )}
                                                {r.esRafaga && (
                                                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                                        Ráfaga
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-body">
                                            {r.clasificacion?.correccion
                                                ? `${formatCategoria(r.clasificacion.correccion.categoriaCorregida)} (corregido)`
                                                : r.clasificacion
                                                    ? formatCategoria(r.clasificacion.categoria)
                                                    : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-subtle">{new Date(r.creadoEn).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-subtle">{r.esAnonimo ? "Anónimo" : "Autenticado"}</td>
                                        <td className="px-4 py-3">
                                            <Button onClick={() => setSelectedReporteId(r.id)} variant="outline" className="py-2 px-3 text-xs">
                                                Ver detalle
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                        <p className="text-sm text-subtle">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total} reportes
                        </p>
                        <div className="flex gap-2">
                            <Button onClick={() => goToPage(page - 1)} disabled={page <= 1} variant="outline">
                                Anterior
                            </Button>
                            <Button onClick={() => goToPage(page + 1)} disabled={page >= pagination.totalPages} variant="outline">
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {selectedReporteId && (
                <AdminReporteDetalle
                    reporteId={selectedReporteId}
                    onClose={() => setSelectedReporteId(null)}
                    onRefresh={fetchReportes}
                />
            )}
        </div>
    );
}

function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

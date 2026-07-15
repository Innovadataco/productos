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
    { value: "OTRO", label: "Otro" },
];

const PAGE_SIZE_OPTIONS = ["10", "25", "50"];

type ReporteListItem = {
    id: string;
    identificador: string;
    numeroSeguimiento: string;
    estado: string;
    esAnonimo: boolean;
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
    const [pageSize, setPageSize] = useState(searchParams.get("pageSize") || "25");

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
            params.set("pageSize", pageSize);
            params.set("page", String(page));
            Object.entries(override).forEach(([k, v]) => {
                if (v) params.set(k, v);
                else params.delete(k);
            });
            return params.toString();
        },
        [estado, plataformaId, categoria, fechaDesde, fechaHasta, pageSize, page]
    );

    const fetchReportes = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/reportes-revision?${buildQueryString()}`, {
                credentials: "include",
            });
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
            <h1 className="text-2xl font-bold text-slate-900">Bandeja de reportes</h1>

            <div className="rounded-2xl border border-white/20 bg-white/70 p-4 backdrop-blur-lg">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Select
                        label="Estado"
                        options={ESTADOS}
                        value={estado}
                        onChange={(e) => setEstado(e.target.value)}
                    />
                    <Select
                        label="Plataforma"
                        options={plataformaOptions}
                        value={plataformaId}
                        onChange={(e) => setPlataformaId(e.target.value)}
                    />
                    <Select
                        label="Categoría"
                        options={CATEGORIAS}
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value)}
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Mostrar</label>
                        <select
                            className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 appearance-none"
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
                    </div>
                    <Input
                        label="Desde"
                        type="date"
                        value={fechaDesde}
                        onChange={(e) => setFechaDesde(e.target.value)}
                    />
                    <Input
                        label="Hasta"
                        type="date"
                        value={fechaHasta}
                        onChange={(e) => setFechaHasta(e.target.value)}
                    />
                    <div className="flex items-end">
                        <Button onClick={applyFilters}>Aplicar filtros</Button>
                    </div>
                </div>
            </div>

            {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}

            <div className="rounded-2xl border border-white/20 bg-white/70 backdrop-blur-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100/50 text-slate-600">
                            <tr>
                                <th className="px-4 py-3 font-medium">Seguimiento</th>
                                <th className="px-4 py-3 font-medium">Plataforma</th>
                                <th className="px-4 py-3 font-medium">Estado</th>
                                <th className="px-4 py-3 font-medium">Categoría</th>
                                <th className="px-4 py-3 font-medium">Fecha</th>
                                <th className="px-4 py-3 font-medium">Origen</th>
                                <th className="px-4 py-3 font-medium">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Cargando...</td></tr>
                            ) : reportes.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay reportes que coincidan con los filtros.</td></tr>
                            ) : (
                                reportes.map((r) => (
                                    <tr key={r.id} className="hover:bg-slate-50/60">
                                        <td className="px-4 py-3 font-mono text-xs">{r.numeroSeguimiento}</td>
                                        <td className="px-4 py-3">{r.plataforma.nombre}</td>
                                        <td className="px-4 py-3">{formatEstado(r.estado)}</td>
                                        <td className="px-4 py-3">
                                            {r.clasificacion?.correccion
                                                ? `${formatCategoria(r.clasificacion.correccion.categoriaCorregida)} (corregido)`
                                                : r.clasificacion
                                                    ? formatCategoria(r.clasificacion.categoria)
                                                    : "—"}
                                        </td>
                                        <td className="px-4 py-3">{new Date(r.creadoEn).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">{r.esAnonimo ? "Anónimo" : "Autenticado"}</td>
                                        <td className="px-4 py-3">
                                            <Button onClick={() => setSelectedReporteId(r.id)} variant="outline">Ver detalle</Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                        <p className="text-sm text-slate-600">
                            Página {pagination.page} de {pagination.totalPages} · {pagination.total} reportes
                        </p>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => goToPage(page - 1)}
                                disabled={page <= 1}
                                variant="outline"
                            >
                                Anterior
                            </Button>
                            <Button
                                onClick={() => goToPage(page + 1)}
                                disabled={page >= pagination.totalPages}
                                variant="outline"
                            >
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

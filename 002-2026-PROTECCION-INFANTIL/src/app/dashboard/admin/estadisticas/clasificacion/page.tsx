"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/modules/BarChart";
import { DonutChart } from "@/components/modules/DonutChart";
import { DashboardSubNav } from "../components/DashboardSubNav";

const CATEGORIA_LABELS: Record<string, string> = {
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

const ESTADO_LABELS: Record<string, string> = {
    REVISION_MANUAL: "En revisión",
    CLASIFICADO: "Clasificado",
    CORREGIDO: "Corregido",
    REPORTE_FALSO: "Reporte falso",
};

function formatCategoria(categoria: string) {
    return CATEGORIA_LABELS[categoria] || categoria;
}

type MetricaOperador = {
    operadorId: string;
    nombre: string;
    atendidos: number;
    confirmados: number;
    corregidos: number;
    dadosDeBaja: number;
    escalados: number;
    tiempoPromedioMin: number;
};

type TablaReporte = {
    id: string;
    identificador: string;
    numeroSeguimiento: string;
    estado: string;
    prioridadAlta: boolean;
    creadoEn: string;
    ciudad: string | null;
    pais: string | null;
    operador: { id: string; email: string; nombre: string | null } | null;
    clasificacion: { categoria: string } | null;
};

type DashboardData = {
    indicadores: {
        sinAsignar: number;
        enGestion: number;
        atendidosHoy: number;
        tiempoPromedioGestionMin: number;
        escaladosPendientes: number;
    };
    casosPorDia: { dia: string; accion: string; count: number }[];
    distribucionOperador: { operadorId: string; nombre: string; count: number }[];
    clasificacionesPorCategoria: { categoria: string; count: number }[];
    escaladosPorOperador: { operadorId: string; nombre: string; count: number }[];
    metricasOperador: MetricaOperador[];
    tabla: {
        reportes: TablaReporte[];
        pagination: { page: number; pageSize: number; total: number; totalPages: number };
    };
};

export default function AdminEstadisticasClasificacionPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filters, setFilters] = useState({
        fechaDesde: "",
        fechaHasta: "",
        operadorId: "",
        estado: "",
        categoria: "",
        busqueda: "",
        page: 1,
        pageSize: 20,
    });

    async function cargar(nextPage = 1) {
        setLoading(true);
        setError("");
        const params = new URLSearchParams();
        if (filters.fechaDesde) params.set("fechaDesde", filters.fechaDesde);
        if (filters.fechaHasta) params.set("fechaHasta", filters.fechaHasta);
        if (filters.operadorId) params.set("operadorId", filters.operadorId);
        if (filters.estado) params.set("estado", filters.estado);
        if (filters.categoria) params.set("categoria", filters.categoria);
        if (filters.busqueda) params.set("busqueda", filters.busqueda);
        params.set("page", String(nextPage));
        params.set("pageSize", String(filters.pageSize));

        try {
            const res = await fetch(`/api/admin/estadisticas/clasificacion?${params.toString()}`, { credentials: "include" });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                setData(json);
                setFilters((f) => ({ ...f, page: nextPage }));
            } else {
                setError(json?.error?.message || "Error cargando tablero");
            }
        } catch {
            setError("Error de red cargando tablero");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const casosPorDiaAgrupado = useMemo(() => {
        const map = new Map<string, number>();
        (data?.casosPorDia || []).forEach((d) => {
            const dia = d.dia.slice(5);
            map.set(dia, (map.get(dia) || 0) + d.count);
        });
        return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
    }, [data]);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Clasificación</h1>
                <p className="text-sm text-muted">Tablero de monitoreo operativo de la cola de revisión manual.</p>
            </div>

            <DashboardSubNav />

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-muted">
                    Rango: <span className="font-medium text-body">últimos 30 días</span> (configurable con filtros)
                </div>
                <Button variant="outline" onClick={() => cargar(1)} isLoading={loading}>
                    Actualizar
                </Button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard label="Sin asignar" value={data?.indicadores.sinAsignar ?? 0} />
                <MetricCard label="En gestión ahora" value={data?.indicadores.enGestion ?? 0} />
                <MetricCard label="Atendidos hoy" value={data?.indicadores.atendidosHoy ?? 0} />
                <MetricCard label="Tiempo promedio (min)" value={data?.indicadores.tiempoPromedioGestionMin ?? 0} />
                <MetricCard label="Escalados pendientes" value={data?.indicadores.escaladosPendientes ?? 0} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-4 sm:col-span-2 lg:col-span-2">
                    <h2 className="mb-4 text-lg font-semibold text-body">Casos por día</h2>
                    <BarChart
                        ariaLabel="Casos atendidos por día"
                        data={casosPorDiaAgrupado}
                    />
                </GlassCard>

                <GlassCard className="p-4">
                    <h2 className="mb-4 text-lg font-semibold text-body">Distribución por operador</h2>
                    <DonutChart
                        ariaLabel="Distribución de casos atendidos por operador"
                        data={(data?.distribucionOperador || []).map((d) => ({ label: d.nombre, value: d.count }))}
                    />
                </GlassCard>

                <GlassCard className="p-4">
                    <h2 className="mb-4 text-lg font-semibold text-body">Clasificaciones revisadas</h2>
                    <DonutChart
                        ariaLabel="Clasificaciones revisadas por categoría"
                        data={(data?.clasificacionesPorCategoria || []).map((d) => ({ label: formatCategoria(d.categoria), value: d.count }))}
                    />
                </GlassCard>
            </div>

            <GlassCard className="p-4">
                <h2 className="mb-4 text-lg font-semibold text-body">Tasa de escalamiento por operador</h2>
                <BarChart
                    ariaLabel="Escalados por operador"
                    data={(data?.escaladosPorOperador || []).map((d) => ({ label: d.nombre, value: d.count }))}
                />
            </GlassCard>

            <GlassCard className="p-4">
                <h2 className="mb-4 text-lg font-semibold text-body">Métricas por operador</h2>
                {data?.metricasOperador.length === 0 ? (
                    <p className="py-6 text-sm text-muted">Aún no hay operación registrada.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-800">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Operador</th>
                                    <th className="pb-3 font-medium">Atendidos</th>
                                    <th className="pb-3 font-medium">Confirmados</th>
                                    <th className="pb-3 font-medium">Corregidos</th>
                                    <th className="pb-3 font-medium">Dados de baja</th>
                                    <th className="pb-3 font-medium">Escalados</th>
                                    <th className="pb-3 font-medium">Tiempo promedio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {(data?.metricasOperador || []).map((op) => (
                                    <tr key={op.operadorId}>
                                        <td className="py-3 pr-3 text-body">{op.nombre}</td>
                                        <td className="py-3 pr-3 text-muted">{op.atendidos}</td>
                                        <td className="py-3 pr-3 text-muted">{op.confirmados}</td>
                                        <td className="py-3 pr-3 text-muted">{op.corregidos}</td>
                                        <td className="py-3 pr-3 text-muted">{op.dadosDeBaja}</td>
                                        <td className="py-3 pr-3 text-muted">{op.escalados}</td>
                                        <td className="py-3 pr-3 text-muted">
                                            {op.tiempoPromedioMin > 0 ? `${op.tiempoPromedioMin} min` : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            <GlassCard className="p-4">
                <h2 className="mb-4 text-lg font-semibold text-body">Casos operativos</h2>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Input
                        label="Desde"
                        type="date"
                        value={filters.fechaDesde}
                        onChange={(e) => setFilters((f) => ({ ...f, fechaDesde: e.target.value }))}
                    />
                    <Input
                        label="Hasta"
                        type="date"
                        value={filters.fechaHasta}
                        onChange={(e) => setFilters((f) => ({ ...f, fechaHasta: e.target.value }))}
                    />
                    <div>
                        <label className="mb-1 block text-sm font-medium text-body">Estado</label>
                        <select
                            value={filters.estado}
                            onChange={(e) => setFilters((f) => ({ ...f, estado: e.target.value }))}
                            className="w-full rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm text-body outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-slate-700 dark:bg-slate-900/60"
                        >
                            <option value="">Todos</option>
                            {Object.entries(ESTADO_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                    </div>
                    <Input
                        label="Búsqueda"
                        placeholder="identificador, seguimiento, operador..."
                        value={filters.busqueda}
                        onChange={(e) => setFilters((f) => ({ ...f, busqueda: e.target.value }))}
                    />
                </div>
                <div className="mb-4 flex justify-end">
                    <Button variant="outline" onClick={() => cargar(1)} isLoading={loading}>
                        Aplicar filtros
                    </Button>
                </div>

                {loading && !data ? (
                    <div className="flex items-center gap-3 py-8 text-muted">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                        Cargando...
                    </div>
                ) : data?.tabla.reportes.length === 0 ? (
                    <p className="py-6 text-sm text-muted">No hay casos que coincidan con los filtros.</p>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-slate-200 dark:border-slate-800">
                                    <tr className="text-subtle">
                                        <th className="pb-3 font-medium">Seguimiento</th>
                                        <th className="pb-3 font-medium">Identificador</th>
                                        <th className="pb-3 font-medium">Estado</th>
                                        <th className="pb-3 font-medium">Operador</th>
                                        <th className="pb-3 font-medium">Categoría</th>
                                        <th className="pb-3 font-medium">Ubicación</th>
                                        <th className="pb-3 font-medium">Creado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {data?.tabla.reportes.map((r) => (
                                        <tr key={r.id}>
                                            <td className="py-3 pr-3 font-mono text-xs text-muted">{r.numeroSeguimiento}</td>
                                            <td className="py-3 pr-3 text-body">{r.identificador}</td>
                                            <td className="py-3 pr-3">
                                                <Badge variant={r.estado === "REVISION_MANUAL" ? "warning" : "success"}>
                                                    {ESTADO_LABELS[r.estado] || r.estado}
                                                </Badge>
                                                {r.prioridadAlta && (
                                                    <Badge variant="danger" className="ml-2 text-[10px]">
                                                        Escalado
                                                    </Badge>
                                                )}
                                            </td>
                                            <td className="py-3 pr-3 text-muted">{r.operador?.nombre || r.operador?.email || "Sin asignar"}</td>
                                            <td className="py-3 pr-3 text-muted">
                                                {r.clasificacion ? formatCategoria(r.clasificacion.categoria) : "—"}
                                            </td>
                                            <td className="py-3 pr-3 text-muted">
                                                {[r.ciudad, r.pais].filter(Boolean).join(", ") || "—"}
                                            </td>
                                            <td className="py-3 pr-3 text-muted">
                                                {new Date(r.creadoEn).toLocaleDateString("es-CO")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {data && data.tabla.pagination.totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <Button
                                    variant="outline"
                                    disabled={data.tabla.pagination.page <= 1}
                                    onClick={() => cargar(data.tabla.pagination.page - 1)}
                                >
                                    Anterior
                                </Button>
                                <span className="text-sm text-muted">
                                    Página {data.tabla.pagination.page} de {data.tabla.pagination.totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    disabled={data.tabla.pagination.page >= data.tabla.pagination.totalPages}
                                    onClick={() => cargar(data.tabla.pagination.page + 1)}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </GlassCard>
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: number }) {
    return (
        <article className="glass rounded-2xl p-5 transition hover:shadow-md motion-reduce:transition-none">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-3xl font-bold text-body">{value}</p>
        </article>
    );
}

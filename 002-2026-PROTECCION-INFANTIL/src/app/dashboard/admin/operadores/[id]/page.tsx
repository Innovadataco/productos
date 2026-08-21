"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";
import { AdminReporteDetalle } from "@/components/modules/AdminReporteDetalle";

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
    SPAM: "Spam",
    OTRO: "Otro",
};

const PAGE_SIZE = 25;

type OperadorHeader = {
    id: string;
    email: string;
    nombre: string | null;
    cupoMaximo: number;
};

type CasoAbierto = {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    categoria: string | null;
    estado: string;
    asignadoEn: string;
    tiempoDesdeAsignacionMs: number;
};

type CategoriaConteo = {
    categoria: string;
    total: number;
};

type Metricas = {
    operador: OperadorHeader;
    casosAbiertos: CasoAbierto[];
    casosResueltos24h: number;
    casosResueltos7d: number;
    casosResueltos30d: number;
    tiempoMedioResolucionMs: number | null;
    casosPorCategoria: CategoriaConteo[];
    tasaEscalamientoComite: number | null;
};

type CasoItem = {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    estado: string;
    categoria: string | null;
    asignadoEn: string;
};

type Paginacion = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

function formatCategoria(categoria: string | null): string {
    if (!categoria) return "—";
    return CATEGORIAS[categoria] || categoria.replace(/_/g, " ");
}

function formatEstado(estado: string): string {
    return estado.replace(/_/g, " ");
}

function formatDuracion(ms: number): string {
    const totalMinutos = Math.floor(ms / 60000);
    const dias = Math.floor(totalMinutos / 1440);
    const horas = Math.floor((totalMinutos % 1440) / 60);
    const minutos = totalMinutos % 60;
    if (dias > 0) return `${dias}d ${horas}h`;
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

function formatPorcentaje(value: number | null): string {
    if (value === null) return "—";
    return `${Math.round(value * 100)}%`;
}

export default function AdminOperadorDetallePage() {
    const params = useParams();
    const router = useRouter();
    const operadorId = String(params.id);

    const [metricas, setMetricas] = useState<Metricas | null>(null);
    const [loadingMetricas, setLoadingMetricas] = useState(true);
    const [errorMetricas, setErrorMetricas] = useState("");

    const [casos, setCasos] = useState<CasoItem[]>([]);
    const [pagination, setPagination] = useState<Paginacion>({
        page: 1,
        pageSize: PAGE_SIZE,
        total: 0,
        totalPages: 0,
    });
    const [loadingCasos, setLoadingCasos] = useState(true);
    const [errorCasos, setErrorCasos] = useState("");
    const [estadoFiltro, setEstadoFiltro] = useState("CORREGIDO");
    const [page, setPage] = useState(1);

    const [selectedReporteId, setSelectedReporteId] = useState<string | null>(null);

    const cargarMetricas = useCallback(async () => {
        setLoadingMetricas(true);
        setErrorMetricas("");
        try {
            const res = await fetch(`/api/admin/operadores/${encodeURIComponent(operadorId)}/metricas`, {
                credentials: "include",
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMetricas(data);
            } else {
                setErrorMetricas(data?.error?.message || "Error cargando métricas del operador");
            }
        } catch {
            setErrorMetricas("Error de red cargando métricas del operador");
        } finally {
            setLoadingMetricas(false);
        }
    }, [operadorId]);

    const cargarCasos = useCallback(async () => {
        setLoadingCasos(true);
        setErrorCasos("");
        try {
            const query = new URLSearchParams({
                page: String(page),
                pageSize: String(PAGE_SIZE),
            });
            if (estadoFiltro) query.set("estado", estadoFiltro);
            const res = await fetch(
                `/api/admin/operadores/${encodeURIComponent(operadorId)}/casos?${query.toString()}`,
                { credentials: "include" }
            );
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setCasos(data.items || []);
                setPagination(data.pagination || { page, pageSize: PAGE_SIZE, total: 0, totalPages: 0 });
            } else {
                setErrorCasos(data?.error?.message || "Error cargando casos del operador");
            }
        } catch {
            setErrorCasos("Error de red cargando casos del operador");
        } finally {
            setLoadingCasos(false);
        }
    }, [operadorId, estadoFiltro, page]);

    useEffect(() => {
        cargarMetricas();
    }, [cargarMetricas]);

    useEffect(() => {
        cargarCasos();
    }, [cargarCasos]);

    const nombreOperador = metricas?.operador.nombre || metricas?.operador.email || "Operador";

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-body">{nombreOperador}</h1>
                    <p className="text-sm text-muted">
                        {metricas?.operador.email} · Cupo {metricas?.operador.cupoMaximo ?? "—"} ·{" "}
                        {metricas?.casosAbiertos.length ?? 0} casos abiertos
                    </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/dashboard/admin/operadores/asignar")}>
                    Volver a asignar
                </Button>
            </div>

            {errorMetricas && (
                <ErrorState
                    title="No pudimos cargar la ficha del operador"
                    description={errorMetricas}
                    onRetry={cargarMetricas}
                />
            )}

            {loadingMetricas ? (
                <Cargando inline texto="Cargando métricas..." className="py-8" />
            ) : (
                metricas && (
                    <>
                        <MetricasCards metricas={metricas} />
                        <CasosAbiertosTable casos={metricas.casosAbiertos} onVerDetalle={setSelectedReporteId} />
                        <DistribucionCategorias casosPorCategoria={metricas.casosPorCategoria} />
                    </>
                )
            )}

            <HistorialCasos
                estadoFiltro={estadoFiltro}
                setEstadoFiltro={setEstadoFiltro}
                page={page}
                setPage={setPage}
                casos={casos}
                pagination={pagination}
                loading={loadingCasos}
                error={errorCasos}
                onRetry={cargarCasos}
                onVerDetalle={setSelectedReporteId}
            />

            {selectedReporteId && (
                <AdminReporteDetalle
                    reporteId={selectedReporteId}
                    onClose={() => setSelectedReporteId(null)}
                    onRefresh={() => {
                        void cargarMetricas();
                        void cargarCasos();
                    }}
                />
            )}
        </div>
    );
}

function MetricasCards({ metricas }: { metricas: Metricas }) {
    const categoriaTop = useMemo(() => {
        const ordenadas = [...metricas.casosPorCategoria].sort((a, b) => b.total - a.total);
        return ordenadas[0] || null;
    }, [metricas.casosPorCategoria]);

    return (
        <section className="space-y-4" aria-labelledby="metricas-title">
            <h2 id="metricas-title" className="text-lg font-semibold text-body">
                Métricas de productividad
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricaCard
                    label="Tiempo medio resolución (30 días)"
                    value={
                        metricas.tiempoMedioResolucionMs !== null
                            ? formatDuracion(metricas.tiempoMedioResolucionMs)
                            : "—"
                    }
                />
                <MetricaCard label="Resueltos 7 días" value={String(metricas.casosResueltos7d)} />
                <MetricaCard
                    label="Tasa escalamiento a comité"
                    value={formatPorcentaje(metricas.tasaEscalamientoComite)}
                />
                <MetricaCard
                    label="Categoría top"
                    value={
                        categoriaTop
                            ? `${formatCategoria(categoriaTop.categoria)} (${categoriaTop.total})`
                            : "—"
                    }
                />
            </div>
        </section>
    );
}

function CasosAbiertosTable({ casos, onVerDetalle }: { casos: CasoAbierto[]; onVerDetalle: (id: string) => void }) {
    return (
        <section className="space-y-4" aria-labelledby="abiertos-title">
            <h2 id="abiertos-title" className="text-lg font-semibold text-body">
                Casos abiertos
            </h2>
            <GlassCard>
                {casos.length === 0 ? (
                    <EmptyState
                        title="Sin casos abiertos"
                        description="El operador no tiene casos en revisión manual actualmente."
                    />
                ) : (
                    <Tabla sinContenedor>
                        <TablaHead variante="borde">
                            <tr className="text-subtle">
                                <th className="pb-3 font-medium">RPT</th>
                                <th className="pb-3 font-medium">Categoría</th>
                                <th className="pb-3 font-medium">Estado</th>
                                <th className="pb-3 font-medium">Tiempo desde asignación</th>
                                <th className="pb-3 font-medium text-right">Acciones</th>
                            </tr>
                        </TablaHead>
                        <TablaBody>
                            {casos.map((c) => (
                                <tr key={c.id} className="align-top">
                                    <td className="py-3 pr-3 font-mono text-xs text-body">
                                        {c.numeroSeguimiento || "—"}
                                    </td>
                                    <td className="py-3 pr-3 text-body">{formatCategoria(c.categoria)}</td>
                                    <td className="py-3 pr-3">
                                        <Badge variant="warning">{formatEstado(c.estado)}</Badge>
                                    </td>
                                    <td className="py-3 pr-3 text-muted">
                                        {formatDuracion(c.tiempoDesdeAsignacionMs)}
                                    </td>
                                    <td className="py-3 text-right">
                                        <Button
                                            variant="outline"
                                            className="px-3 py-1.5 text-xs"
                                            onClick={() => onVerDetalle(c.id)}
                                        >
                                            Ver detalle
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </TablaBody>
                    </Tabla>
                )}
            </GlassCard>
        </section>
    );
}

function DistribucionCategorias({ casosPorCategoria }: { casosPorCategoria: CategoriaConteo[] }) {
    const maxTotal = useMemo(() => {
        const valores = casosPorCategoria.map((c) => c.total);
        return valores.length > 0 ? Math.max(...valores) : 0;
    }, [casosPorCategoria]);

    return (
        <section className="space-y-4" aria-labelledby="distribucion-title">
            <h2 id="distribucion-title" className="text-lg font-semibold text-body">
                Distribución por categoría
            </h2>
            <GlassCard>
                {casosPorCategoria.length === 0 ? (
                    <EmptyState
                        title="Sin datos de categorías"
                        description="No hay casos resueltos en los últimos 30 días para calcular la distribución."
                    />
                ) : (
                    <div className="space-y-3">
                        {[...casosPorCategoria].sort((a, b) => b.total - a.total).map((c) => {
                            const ancho = maxTotal > 0 ? Math.round((c.total / maxTotal) * 100) : 0;
                            return (
                                <div key={c.categoria} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-body">{formatCategoria(c.categoria)}</span>
                                        <span className="text-muted">{c.total}</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                        <div
                                            className="h-full rounded-full bg-accent"
                                            style={{ width: `${ancho}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </GlassCard>
        </section>
    );
}

function HistorialCasos({
    estadoFiltro,
    setEstadoFiltro,
    page,
    setPage,
    casos,
    pagination,
    loading,
    error,
    onRetry,
    onVerDetalle,
}: {
    estadoFiltro: string;
    setEstadoFiltro: (value: string) => void;
    page: number;
    setPage: (value: number | ((prev: number) => number)) => void;
    casos: CasoItem[];
    pagination: Paginacion;
    loading: boolean;
    error: string;
    onRetry: () => void;
    onVerDetalle: (id: string) => void;
}) {
    return (
        <section className="space-y-4" aria-labelledby="historial-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 id="historial-title" className="text-lg font-semibold text-body">
                    Historial de casos
                </h2>
                <Select
                    label="Estado"
                    options={ESTADOS}
                    value={estadoFiltro}
                    onChange={(e) => {
                        setEstadoFiltro(e.target.value);
                        setPage(1);
                    }}
                    className="sm:w-64"
                />
            </div>
            <GlassCard>
                {error ? (
                    <ErrorState title="No pudimos cargar el historial" description={error} onRetry={onRetry} />
                ) : loading ? (
                    <Cargando inline texto="Cargando casos..." className="py-8" />
                ) : casos.length === 0 ? (
                    <EmptyState
                        title="Sin casos en este estado"
                        description="El operador no tiene casos que coincidan con el filtro seleccionado."
                    />
                ) : (
                    <>
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">RPT</th>
                                    <th className="pb-3 font-medium">Identificador</th>
                                    <th className="pb-3 font-medium">Plataforma</th>
                                    <th className="pb-3 font-medium">Categoría</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Asignado</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
                                {casos.map((c) => (
                                    <tr key={c.id} className="align-top">
                                        <td className="py-3 pr-3 font-mono text-xs text-body">
                                            {c.numeroSeguimiento || "—"}
                                        </td>
                                        <td className="py-3 pr-3 text-body">{c.identificador}</td>
                                        <td className="py-3 pr-3 text-muted">{c.plataformaNombre}</td>
                                        <td className="py-3 pr-3 text-muted">{formatCategoria(c.categoria)}</td>
                                        <td className="py-3 pr-3">
                                            <Badge variant={c.estado === "REVISION_MANUAL" ? "warning" : "neutral"}>
                                                {formatEstado(c.estado)}
                                            </Badge>
                                        </td>
                                        <td className="py-3 pr-3 text-muted">
                                            {new Date(c.asignadoEn).toLocaleDateString("es-CO")}
                                        </td>
                                        <td className="py-3 text-right">
                                            <Button
                                                variant="outline"
                                                className="px-3 py-1.5 text-xs"
                                                onClick={() => onVerDetalle(c.id)}
                                            >
                                                Ver detalle
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </TablaBody>
                        </Tabla>
                        {pagination.totalPages > 1 && (
                            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-subtle">
                                    Página {pagination.page} de {pagination.totalPages} · {pagination.total} casos
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={page <= 1}
                                        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="px-3 py-1.5 text-xs"
                                        disabled={page >= pagination.totalPages}
                                        onClick={() => setPage((p: number) => p + 1)}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </GlassCard>
        </section>
    );
}

function MetricaCard({ label, value }: { label: string; value: string }) {
    return (
        <GlassCard className="p-5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-body">{value}</p>
        </GlassCard>
    );
}

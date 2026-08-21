"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { AdminReporteDetalle } from "./AdminReporteDetalle";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alerta } from "@/components/ui/Alerta";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";

const CATEGORIAS = [
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
    { value: "OTRO", label: "Otro" },
];

const ESTADOS_SPAM = [
    { value: "", label: "Todos los estados" },
    { value: "POSIBLE_SPAM", label: "Posible spam" },
    { value: "REVISION_MANUAL", label: "Revisión manual" },
];

const ORDENES = [
    { value: "prioridad", label: "Prioridad" },
    { value: "recientes", label: "Más recientes" },
    { value: "antiguos", label: "Más antiguos" },
];

const VENTANAS = [7, 30, 90] as const;

type SpamReporteItem = {
    id: string;
    identificador: string;
    plataforma: { id: string; nombre: string; clave: string };
    texto: string;
    estado: string;
    creadoEn: string;
    prioridadAlta: boolean;
    operadorId: string | null;
    asignadoA: { id: string; nombre: string | null; email: string } | null;
    clasificacion: { categoria: string; confianza: number } | null;
    confianzaSpam: number;
};

type Analitica = {
    generadoEn: string;
    metricas: Record<
        7 | 30 | 90,
        {
            esSpam: number;
            corregidos: number;
            procesadosComoAcoso: number;
            totalResueltos: number;
            tasaSpam: number;
            tiempoPromedioResolucionMin: number | null;
        }
    >;
    serie: { fecha: string; esSpam: number; corregidos: number; procesadosComoAcoso: number }[];
    distribucion: {
        porPlataforma: { plataformaId: string; nombre: string; count: number }[];
        porCategoria: { categoria: string; count: number }[];
    };
    topIdentificadores: { identificador: string; plataformaId: string; plataformaNombre: string; count: number }[];
    topOperadores: { operadorId: string; nombre: string | null; email: string; count: number }[];
};

function formatCategoria(value: string) {
    return CATEGORIAS.find((c) => c.value === value)?.label || value;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

export function SpamRevisionPanel() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [reportes, setReportes] = useState<SpamReporteItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 0 });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [categoria, setCategoria] = useState("OTRO");
    const [motivo, setMotivo] = useState("");
    const [resolviendo, setResolviendo] = useState(false);
    const [success, setSuccess] = useState("");

    const [analitica, setAnalitica] = useState<Analitica | null>(null);
    const [loadingAnalitica, setLoadingAnalitica] = useState(true);
    const [errorAnalitica, setErrorAnalitica] = useState("");
    const [ventanaActiva, setVentanaActiva] = useState<7 | 30 | 90>(7);
    const [descargandoBanco, setDescargandoBanco] = useState(false);

    const [q, setQ] = useState(searchParams.get("q") || "");
    const [estado, setEstado] = useState(searchParams.get("estado") || "");
    const [orden, setOrden] = useState(searchParams.get("orden") || "prioridad");

    const page = Math.max(1, Number(searchParams.get("page") || "1"));

    const buildQueryString = useCallback(
        (override: Record<string, string> = {}) => {
            const params = new URLSearchParams();
            if (q.trim()) params.set("q", q.trim());
            if (estado) params.set("estado", estado);
            params.set("orden", orden);
            params.set("page", String(page));
            Object.entries(override).forEach(([k, v]) => {
                if (v) params.set(k, v);
                else params.delete(k);
            });
            return params.toString();
        },
        [q, estado, orden, page]
    );

    const fetchReportes = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/spam/pendientes?${buildQueryString()}`, { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando pendientes");
            const json = await res.json();
            setReportes(json.reportes || []);
            setPagination(json.pagination);
        } catch {
            setError("Error cargando reportes en revisión de spam");
        } finally {
            setLoading(false);
        }
    }, [buildQueryString]);

    const fetchAnalitica = useCallback(async () => {
        setLoadingAnalitica(true);
        setErrorAnalitica("");
        try {
            const res = await fetch("/api/admin/spam/analitica", { credentials: "include" });
            if (res.status === 401) {
                window.location.href = "/login";
                return;
            }
            if (!res.ok) throw new Error("Error cargando analítica");
            const json = await res.json();
            setAnalitica(json);
        } catch {
            setErrorAnalitica("Error cargando analítica de spam");
        } finally {
            setLoadingAnalitica(false);
        }
    }, []);

    useEffect(() => {
        fetchReportes();
        fetchAnalitica();
    }, [fetchReportes, fetchAnalitica]);

    const applyFilters = () => {
        router.push(`${pathname}?${buildQueryString({ page: "1" })}`);
    };

    const goToPage = (newPage: number) => {
        router.push(`${pathname}?${buildQueryString({ page: String(newPage) })}`);
    };

    const selected = reportes.find((r) => r.id === selectedId);

    const resolver = async (decision: "es_spam" | "corregir" | "procesar_como_acoso") => {
        if (!selectedId) return;
        if (decision === "corregir" && !categoria) {
            setError("Seleccione una categoría para el reporte válido.");
            return;
        }
        setResolviendo(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${selectedId}/resolver-spam`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    decision,
                    categoria: decision === "corregir" ? categoria : undefined,
                    motivo: motivo || undefined,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al resolver");
                return;
            }
            const mensajes: Record<typeof decision, string> = {
                es_spam: "Confirmado como spam y dado de baja.",
                corregir: "Marcado como reporte válido.",
                procesar_como_acoso: "Procesado como acoso.",
            };
            setSuccess(mensajes[decision]);
            setSelectedId(null);
            setMotivo("");
            setCategoria("OTRO");
            await fetchReportes();
            await fetchAnalitica();
        } catch {
            setError("Error al resolver el caso");
        } finally {
            setResolviendo(false);
        }
    };

    const sugerirAlBanco = async () => {
        setDescargandoBanco(true);
        try {
            const res = await fetch("/api/admin/spam/banco-sugerencias?limit=100", { credentials: "include" });
            if (!res.ok) throw new Error("Error generando sugerencias");
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `banco-spam-sugerido-${new Date().toISOString().slice(0, 10)}.jsonl`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Error descargando sugerencias para el banco");
        } finally {
            setDescargandoBanco(false);
        }
    };

    const metricas = analitica?.metricas?.[ventanaActiva];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-body">Revisión de spam</h1>
                <p className="text-sm text-muted">Reportes marcados como posible spam por la IA esperando validación humana.</p>
            </div>

            {/* Analítica */}
            <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-body">Panel de análisis</h2>
                    <div className="flex items-center gap-2">
                        {VENTANAS.map((d) => (
                            <Button
                                key={d}
                                variant={ventanaActiva === d ? "primary" : "outline"}
                                className="text-xs py-1.5 px-3"
                                onClick={() => setVentanaActiva(d)}
                            >
                                {d}d
                            </Button>
                        ))}
                        <Button
                            variant="secondary"
                            className="text-xs py-1.5 px-3"
                            onClick={sugerirAlBanco}
                            disabled={descargandoBanco}
                        >
                            {descargandoBanco ? "Generando..." : "Sugerir al banco"}
                        </Button>
                    </div>
                </div>

                {errorAnalitica && (
                    <ErrorState
                        title="No pudimos cargar el análisis"
                        description={errorAnalitica}
                        onRetry={fetchAnalitica}
                    />
                )}

                {loadingAnalitica && !analitica && (
                    <div className="glass rounded-2xl p-8 text-center">
                        <Cargando tamano="sm" />
                    </div>
                )}

                {analitica && metricas && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard label="Confirmados spam" value={metricas.esSpam} color="bg-red-500" />
                            <MetricCard label="Corregidos" value={metricas.corregidos} color="bg-amber-500" />
                            <MetricCard label="Procesados como acoso" value={metricas.procesadosComoAcoso} color="bg-blue-500" />
                            <MetricCard
                                label="Tasa spam"
                                value={`${(metricas.tasaSpam * 100).toFixed(1)}%`}
                                sub={metricas.tiempoPromedioResolucionMin !== null ? `Ø ${metricas.tiempoPromedioResolucionMin} min` : undefined}
                                color="bg-slate-500"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                            <div className="glass rounded-2xl p-4 lg:col-span-2">
                                <h3 className="text-sm font-medium text-body mb-3">Últimos 30 días</h3>
                                <div className="h-40 flex items-end gap-1">
                                    {analitica.serie.map((punto) => {
                                        const total = punto.esSpam + punto.corregidos + punto.procesadosComoAcoso;
                                        const max = Math.max(1, ...analitica.serie.map((s) => s.esSpam + s.corregidos + s.procesadosComoAcoso));
                                        const height = `${(total / max) * 100}%`;
                                        return (
                                            <div key={punto.fecha} className="flex-1 flex flex-col justify-end group relative">
                                                <div
                                                    className="w-full rounded-t-sm flex flex-col justify-end overflow-hidden"
                                                    style={{ height }}
                                                    title={`${formatDate(punto.fecha)}: ${total}`}
                                                >
                                                    {punto.procesadosComoAcoso > 0 && (
                                                        <div className="bg-blue-500 w-full" style={{ height: `${(punto.procesadosComoAcoso / total) * 100}%` }} />
                                                    )}
                                                    {punto.corregidos > 0 && (
                                                        <div className="bg-amber-500 w-full" style={{ height: `${(punto.corregidos / total) * 100}%` }} />
                                                    )}
                                                    {punto.esSpam > 0 && (
                                                        <div className="bg-red-500 w-full" style={{ height: `${(punto.esSpam / total) * 100}%` }} />
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-subtle text-center mt-1 hidden sm:block">{formatDate(punto.fecha)}</span>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                                    {formatDate(punto.fecha)}: spam {punto.esSpam}, corregidos {punto.corregidos}, acoso {punto.procesadosComoAcoso}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-3 text-xs text-subtle">
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Spam</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Corregidos</span>
                                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Procesados como acoso</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="glass rounded-2xl p-4">
                                    <h3 className="text-sm font-medium text-body mb-2">Por plataforma</h3>
                                    <DistribucionBar items={analitica.distribucion.porPlataforma.map((p) => ({ label: p.nombre, count: p.count }))} />
                                </div>
                                <div className="glass rounded-2xl p-4">
                                    <h3 className="text-sm font-medium text-body mb-2">Por categoría final</h3>
                                    <DistribucionBar items={analitica.distribucion.porCategoria.map((c) => ({ label: formatCategoria(c.categoria), count: c.count }))} />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <TopList
                                title="Identificadores más reportados"
                                items={analitica.topIdentificadores.map((i) => ({
                                    label: i.identificador,
                                    sub: i.plataformaNombre,
                                    count: i.count,
                                }))}
                            />
                            <TopList
                                title="Operadores con más resoluciones"
                                items={analitica.topOperadores.map((o) => ({
                                    label: o.nombre || o.email,
                                    sub: o.email,
                                    count: o.count,
                                }))}
                            />
                        </div>
                    </>
                )}
            </section>

            {/* Filtros */}
            <div className="glass rounded-2xl p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="lg:col-span-2">
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
                    <Select label="Estado" options={ESTADOS_SPAM} value={estado} onChange={(e) => setEstado(e.target.value)} />
                    <Select
                        label="Ordenar por"
                        options={ORDENES}
                        value={orden}
                        onChange={(e) => {
                            setOrden(e.target.value);
                            router.push(`${pathname}?${buildQueryString({ page: "1", orden: e.target.value })}`);
                        }}
                    />
                    <div className="flex items-end">
                        <Button onClick={applyFilters}>Aplicar filtros</Button>
                    </div>
                </div>
            </div>

            {error && (
                <ErrorState
                    title="No pudimos cargar los reportes en revisión"
                    description={error}
                    onRetry={fetchReportes}
                />
            )}
            {success && <Alerta tono="exito" role="status" className="p-4">{success}</Alerta>}

            <div className="glass rounded-2xl overflow-hidden">
                <Tabla sinContenedor>
                    <TablaHead>
                        <tr>
                            <th className="px-4 py-3 font-medium">Identificador</th>
                            <th className="px-4 py-3 font-medium">Plataforma</th>
                            <th className="px-4 py-3 font-medium">Confianza SPAM</th>
                            <th className="px-4 py-3 font-medium">Asignado a</th>
                            <th className="px-4 py-3 font-medium">Recibido</th>
                            <th className="px-4 py-3 font-medium">Acciones</th>
                        </tr>
                    </TablaHead>
                    <TablaBody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-2 text-center text-subtle">
                                    <Cargando tamano="sm" />
                                </td>
                            </tr>
                        ) : reportes.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-2">
                                    <EmptyState
                                        title="No hay reportes en revisión de spam"
                                        description="Cuando la IA marque un reporte como posible spam, aparecerá aquí para validación humana."
                                    />
                                </td>
                            </tr>
                        ) : (
                            reportes.map((r) => (
                                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition">
                                    <td className="px-4 py-3 text-body">{r.identificador}</td>
                                    <td className="px-4 py-3 text-body">{r.plataforma.nombre}</td>
                                    <td className="px-4 py-3 text-body">{(r.confianzaSpam * 100).toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-body">{r.asignadoA?.nombre || r.asignadoA?.email || "—"}</td>
                                    <td className="px-4 py-3 text-subtle">{new Date(r.creadoEn).toLocaleString()}</td>
                                    <td className="px-4 py-3">
                                        <Button onClick={() => setSelectedId(r.id)} variant="outline" className="py-2 px-3 text-xs">
                                            Revisar
                                        </Button>
                                    </td>
                                </tr>
                            )))
                        }
                    </TablaBody>
                </Tabla>

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

            {selectedId && selected && (
                <Modal isOpen onClose={() => setSelectedId(null)} title="Revisar posible spam">
                    <AdminReporteDetalle
                        reporteId={selectedId}
                        onClose={() => setSelectedId(null)}
                        onRefresh={fetchReportes}
                        inline
                    />

                    <div className="mt-6 space-y-4 rounded-2xl glass p-4">
                        <h3 className="font-medium text-body">Resolución</h3>
                        <div>
                            <label className="block text-sm font-medium text-body mb-1.5">Categoría si es válido</label>
                            <Select
                                options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))}
                                value={categoria}
                                onChange={(e) => setCategoria(e.target.value)}
                            />
                        </div>
                        <textarea
                            className="w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                            rows={3}
                            placeholder="Motivo de la resolución (opcional)"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => resolver("procesar_como_acoso")} disabled={resolviendo} variant="secondary">
                                {resolviendo ? "Resolviendo..." : "Procesar como acoso"}
                            </Button>
                            <Button onClick={() => resolver("corregir")} disabled={resolviendo} variant="secondary">
                                {resolviendo ? "Resolviendo..." : "Marcar como válido"}
                            </Button>
                            <Button onClick={() => resolver("es_spam")} disabled={resolviendo}>
                                {resolviendo ? "Resolviendo..." : "Confirmar spam"}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function MetricCard({
    label,
    value,
    sub,
    color,
}: {
    label: string;
    value: number | string;
    sub?: string | undefined;
    color: string;
}) {
    return (
        <div className="glass rounded-2xl p-4 flex items-start gap-3">
            <div className={`w-2 h-10 rounded-full ${color}`} />
            <div>
                <p className="text-sm text-subtle">{label}</p>
                <p className="text-2xl font-bold text-body">{value}</p>
                {sub && <p className="text-xs text-subtle">{sub}</p>}
            </div>
        </div>
    );
}

function DistribucionBar({ items }: { items: { label: string; count: number }[] }) {
    if (items.length === 0) return <p className="text-sm text-subtle">Sin datos</p>;
    const max = Math.max(...items.map((i) => i.count));
    return (
        <div className="space-y-2">
            {items.slice(0, 6).map((item) => (
                <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs text-body">
                        <span className="truncate max-w-[70%]">{item.label}</span>
                        <span>{item.count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-1.5 rounded-full bg-slate-500" style={{ width: `${(item.count / max) * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function TopList({ title, items }: { title: string; items: { label: string; sub: string; count: number }[] }) {
    return (
        <div className="glass rounded-2xl p-4">
            <h3 className="text-sm font-medium text-body mb-3">{title}</h3>
            {items.length === 0 ? (
                <p className="text-sm text-subtle">Sin datos</p>
            ) : (
                <ul className="space-y-2">
                    {items.map((item, idx) => (
                        <li key={`${item.label}-${idx}`} className="flex items-center justify-between text-sm">
                            <div className="min-w-0">
                                <p className="text-body truncate">{item.label}</p>
                                <p className="text-subtle text-xs truncate">{item.sub}</p>
                            </div>
                            <span className="font-medium text-body ml-2">{item.count}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

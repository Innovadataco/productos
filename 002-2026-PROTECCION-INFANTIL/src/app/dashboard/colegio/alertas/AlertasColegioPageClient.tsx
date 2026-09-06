"use client";
 

import { useEffect, useState, useCallback } from "react";
import { SkeletonLista } from "@/components/ui/skeletons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { EscalarAlertaModal } from "@/components/modules/colegio/alertas/EscalarAlertaModal";
import { ResolverAlertaModal } from "@/components/modules/colegio/alertas/ResolverAlertaModal";

type AsignadoA = { id: string; nombre: string | null; email: string };

// SPEC-380 (PR B): 4º sujeto — INTEGRANTE_COMITE. La unión cerrada mantiene
// la disciplina exhaustiva (Record<TipoSujeto, X> abajo).
type TipoSujetoAlerta = "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE" | "INTEGRANTE_COMITE";

type Alerta = {
    id: string;
    tipoSujeto: TipoSujetoAlerta;
    identificador: string | null;
    relacion: string | null;
    sujetoNombre: string | null;
    categoria: string | null;
    estadoReporte: string;
    estadoAlerta: string;
    prioridad: string;
    vencimientoSla: string;
    asignadoA: AsignadoA | null;
    creadoEn: string;
};

type FiltroEstado = "todas" | "nueva" | "vista" | "gestionada" | "escalada" | "cerrada";
type FiltroTipoSujeto = "todos" | TipoSujetoAlerta;
type FiltroPrioridad = "todas" | "alta" | "media" | "baja";

const ESTADO_LABELS: Record<string, string> = {
    nueva: "Nueva",
    vista: "Vista",
    gestionada: "Gestionada",
    escalada: "Escalada",
    cerrada: "Cerrada",
};

// SPEC-173 (H06): tooltip en criollo para que el rector entienda cada estado.
const ESTADO_TOOLTIPS: Record<string, string> = {
    nueva: "Recién llegada, nadie la ha revisado",
    vista: "Ya la vi, pendiente de actuar",
    gestionada: "La resolví yo en el colegio, sin comité",
    escalada: "La pasé al comité de convivencia",
    cerrada: "El comité la cerró",
};

const ESTADO_VARIANTS: Record<string, "default" | "warning" | "success" | "neutral" | "info" | "danger"> = {
    nueva: "default",
    vista: "warning",
    gestionada: "success",
    escalada: "info",
    cerrada: "neutral",
};

const PRIORIDAD_LABELS: Record<string, string> = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
};

const PRIORIDAD_VARIANTS: Record<string, "danger" | "warning" | "success"> = {
    alta: "danger",
    media: "warning",
    baja: "success",
};

// SPEC-380 (PR B · CEO): Records completos por `TipoSujetoAlerta`. El fallback
// `?? tipoSujeto` de la versión anterior escondía olvidos — ahora agregar un
// 5º sujeto sin label/variant hace fallar el compilador (los guardianes que
// avisan valen más que los que perdonan).
const TIPO_SUJETO_LABELS: Record<FiltroTipoSujeto, string> = {
    todos: "Todos los sujetos",
    ESTUDIANTE: "Estudiante",
    PROFESOR: "Profesor",
    ACUDIENTE: "Acudiente",
    INTEGRANTE_COMITE: "Integrante del comité",
};

const TIPO_SUJETO_VARIANTS: Record<TipoSujetoAlerta, "default" | "info" | "warning" | "neutral"> = {
    ESTUDIANTE: "default",
    PROFESOR: "info",
    ACUDIENTE: "warning",
    INTEGRANTE_COMITE: "neutral",
};

function estaVencida(vencimientoSla: string): boolean {
    return new Date(vencimientoSla) < new Date();
}

function formatoFecha(fecha: string): string {
    return new Date(fecha).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium",
        timeStyle: "short",
    });
}

export default function AlertasColegioPageClient() {
    const router = useRouter();
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtro, setFiltro] = useState<FiltroEstado>("todas");
    const [filtroTipoSujeto, setFiltroTipoSujeto] = useState<FiltroTipoSujeto>("todos");
    const [filtroPrioridad, setFiltroPrioridad] = useState<FiltroPrioridad>("todas");
    const [accionando, setAccionando] = useState<Set<string>>(new Set());
    const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
    const [modalEscalarId, setModalEscalarId] = useState<string | null>(null);
    const [modalResolverId, setModalResolverId] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const url = new URL("/api/colegio/alertas", window.location.origin);
            if (filtro !== "todas") url.searchParams.set("estado", filtro);
            if (filtroTipoSujeto !== "todos") url.searchParams.set("tipoSujeto", filtroTipoSujeto);
            if (filtroPrioridad !== "todas") url.searchParams.set("prioridad", filtroPrioridad);
            url.searchParams.set("page", String(page));
            url.searchParams.set("pageSize", String(pageSize));
            const res = await fetch(url.toString(), { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando alertas");
                setAlertas([]);
                setTotal(0);
                return;
            }
            setAlertas(data.items || []);
            setTotal(data.total || 0);
        } catch {
            setError("Error de red cargando alertas");
            setAlertas([]);
            setTotal(0);
        } finally {
            setCargando(false);
        }
    }, [filtro, filtroTipoSujeto, filtroPrioridad, page, pageSize]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const marcarVista = async (id: string) => {
        if (accionando.has(id)) return;
        setAccionando((prev) => new Set(prev).add(id));
        try {
            const res = await fetch(`/api/colegio/alertas/${id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: "vista" }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error actualizando alerta");
                return;
            }
            setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, estadoAlerta: data.alerta.estado } : a)));
        } catch {
            setError("Error de red actualizando alerta");
        } finally {
            setAccionando((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const actualizarEstadoLocal = (id: string, estado: string) => {
        setAlertas((prev) => prev.map((a) => (a.id === id ? { ...a, estadoAlerta: estado } : a)));
    };

    // SPEC-173 (H01/H06): la única acción en lote del rector es "Revisar en lote".
    const revisarEnLote = async () => {
        if (seleccionadas.size === 0) return;
        setAccionando((prev) => new Set([...prev, ...seleccionadas]));
        try {
            const res = await fetch("/api/colegio/alertas", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: Array.from(seleccionadas), accion: "vista" }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error aplicando acción en lote");
                return;
            }
            setSeleccionadas(new Set());
            await cargar();
        } catch {
            setError("Error de red aplicando acción en lote");
        } finally {
            setAccionando(new Set());
        }
    };

    const toggleSeleccion = (id: string) => {
        setSeleccionadas((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleTodas = () => {
        if (seleccionadas.size === alertas.length) setSeleccionadas(new Set());
        else setSeleccionadas(new Set(alertas.map((a) => a.id)));
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-6xl space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Alertas</h1>
                            <p className="text-sm text-muted">
                                Avisos que llegan cuando un identificador que registraste para un estudiante,
                                profesor o acudiente aparece en un reporte de la comunidad. Ordenadas por
                                prioridad, novedad y tiempo restante de respuesta.
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <div className="w-full sm:w-44">
                                <Select
                                    label="Prioridad"
                                    value={filtroPrioridad}
                                    onChange={(e) => setFiltroPrioridad(e.target.value as FiltroPrioridad)}
                                    options={[
                                        { value: "todas", label: "Todas las prioridades" },
                                        { value: "alta", label: "Alta" },
                                        { value: "media", label: "Media" },
                                        { value: "baja", label: "Baja" },
                                    ]}
                                />
                            </div>
                            <div className="w-full sm:w-44">
                                <Select
                                    label="Tipo"
                                    value={filtroTipoSujeto}
                                    onChange={(e) => setFiltroTipoSujeto(e.target.value as FiltroTipoSujeto)}
                                    options={[
                                        { value: "todos", label: "Todos los sujetos" },
                                        { value: "ESTUDIANTE", label: "Estudiante" },
                                        { value: "PROFESOR", label: "Profesor" },
                                        { value: "ACUDIENTE", label: "Acudiente" },
                                        // SPEC-380 (PR B): 4º sujeto.
                                        { value: "INTEGRANTE_COMITE", label: "Integrante del comité" },
                                    ]}
                                />
                            </div>
                            <div className="w-full sm:w-44">
                                <Select
                                    label="Estado"
                                    value={filtro}
                                    onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
                                    options={[
                                        { value: "todas", label: "Todos" },
                                        { value: "nueva", label: "Nueva" },
                                        { value: "vista", label: "Vista" },
                                        { value: "gestionada", label: "Gestionada" },
                                        { value: "escalada", label: "Escalada" },
                                        { value: "cerrada", label: "Cerrada" },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    {seleccionadas.size > 0 && (
                        <GlassCard className="flex flex-wrap items-center gap-3">
                            <span className="text-sm text-body">{seleccionadas.size} seleccionadas</span>
                            <Button variant="secondary" onClick={() => void revisarEnLote()}>
                                Revisar en lote
                            </Button>
                        </GlassCard>
                    )}

                    {error && (
                        <div className="rounded-xl bg-rubi/10 p-4 text-sm text-estado-rubi">
                            {error}
                        </div>
                    )}

                    {cargando ? (
                        <SkeletonLista />
                    ) : alertas.length === 0 ? (
                        <EmptyState
                            title="Aún no hay alertas"
                            description="Aparecerán cuando un identificador que registre para un estudiante salga en un reporte. Empiece registrando sus cursos y estudiantes."
                            icon={<span className="text-2xl">🛡️</span>}
                            action={
                                <Button onClick={() => router.push("/dashboard/colegio/cursos")}>
                                    Ir a Estudiantes
                                </Button>
                            }
                        />
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 px-1">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 accent-pino"
                                        checked={seleccionadas.size === alertas.length && alertas.length > 0}
                                        onChange={toggleTodas}
                                        aria-label="Seleccionar todas"
                                    />
                                    <span className="text-xs text-muted">Seleccionar todas</span>
                                </div>
                                {alertas.map((alerta) => (
                                    <GlassCard
                                        key={alerta.id}
                                        className={`border-l-4 ${
                                            alerta.prioridad === "alta"
                                                ? "border-l-ambar"
                                                : alerta.prioridad === "media"
                                                    ? "border-l-ambar"
                                                    : "border-l-pino"
                                        }`}
                                    >
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 accent-pino"
                                                        checked={seleccionadas.has(alerta.id)}
                                                        onChange={() => toggleSeleccion(alerta.id)}
                                                        aria-label={`Seleccionar alerta ${alerta.id}`}
                                                    />
                                                    <Badge variant={TIPO_SUJETO_VARIANTS[alerta.tipoSujeto]}>
                                                        {TIPO_SUJETO_LABELS[alerta.tipoSujeto]}
                                                    </Badge>
                                                    <span title={ESTADO_TOOLTIPS[alerta.estadoAlerta] || alerta.estadoAlerta}>
                                                        <Badge variant={ESTADO_VARIANTS[alerta.estadoAlerta] || "neutral"}>
                                                            {ESTADO_LABELS[alerta.estadoAlerta] || alerta.estadoAlerta}
                                                        </Badge>
                                                    </span>
                                                    <Badge variant={PRIORIDAD_VARIANTS[alerta.prioridad] || "neutral"}>
                                                        {PRIORIDAD_LABELS[alerta.prioridad] || alerta.prioridad}
                                                    </Badge>
                                                    {estaVencida(alerta.vencimientoSla) && (
                                                        <Badge variant="danger">SLA vencido</Badge>
                                                    )}
                                                </div>

                                                <div className="text-sm">
                                                    <span className="text-subtle">Sujeto:</span>{" "}
                                                    <span className="font-medium text-body">
                                                        {alerta.sujetoNombre ?? "Sin nombre"}
                                                    </span>
                                                    {alerta.relacion && (
                                                        <span className="text-muted"> · {alerta.relacion}</span>
                                                    )}
                                                    {alerta.asignadoA && (
                                                        <span className="text-muted">
                                                            {" "}
                                                            · Asignada a{" "}
                                                            <span className="font-medium">{alerta.asignadoA.email}</span>
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid gap-2 text-sm sm:grid-cols-3">
                                                    {alerta.identificador && (
                                                        <div>
                                                            <span className="text-subtle">Identificador:</span>{" "}
                                                            <span className="font-mono text-body">{alerta.identificador}</span>
                                                        </div>
                                                    )}
                                                    <div>
                                                        <span className="text-subtle">Categoría:</span>{" "}
                                                        <span className="text-body">{alerta.categoria || "Sin clasificar"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-subtle">Estado del reporte:</span>{" "}
                                                        <span className="text-body">{alerta.estadoReporte}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-wrap gap-3 text-xs text-muted">
                                                    <span>Recibida el {formatoFecha(alerta.creadoEn)}</span>
                                                    <span>
                                                        SLA: {formatoFecha(alerta.vencimientoSla)}
                                                        {estaVencida(alerta.vencimientoSla) ? " (vencido)" : ""}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                                                <Link
                                                    href={`/dashboard/colegio/alertas/${alerta.id}`}
                                                    className="inline-flex min-h-12 items-center rounded-xl px-3 text-sm font-semibold text-accent transition hover:underline"
                                                >
                                                    Ver seguimiento →
                                                </Link>
                                                {alerta.estadoAlerta === "nueva" && (
                                                    <Button
                                                        variant="secondary"
                                                        className="py-1.5 px-3 text-xs"
                                                        isLoading={accionando.has(alerta.id)}
                                                        onClick={() => marcarVista(alerta.id)}
                                                    >
                                                        Revisar
                                                    </Button>
                                                )}
                                                {(alerta.estadoAlerta === "nueva" || alerta.estadoAlerta === "vista") && (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            className="py-1.5 px-3 text-xs"
                                                            onClick={() => setModalResolverId(alerta.id)}
                                                        >
                                                            Resolver aquí
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="py-1.5 px-3 text-xs"
                                                            onClick={() => setModalEscalarId(alerta.id)}
                                                        >
                                                            Escalar al Comité
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </GlassCard>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between">
                                    <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                        Anterior
                                    </Button>
                                    <span className="text-sm text-muted">
                                        Página {page} de {totalPages} ({total} alertas)
                                    </span>
                                    <Button
                                        variant="outline"
                                        disabled={page >= totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            <EscalarAlertaModal
                isOpen={modalEscalarId !== null}
                alertaId={modalEscalarId}
                onClose={() => setModalEscalarId(null)}
                onEscalada={actualizarEstadoLocal}
            />
            <ResolverAlertaModal
                isOpen={modalResolverId !== null}
                alertaId={modalResolverId}
                onClose={() => setModalResolverId(null)}
                onResuelta={actualizarEstadoLocal}
            />
        </div>
    );
}

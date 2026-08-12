"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";

type Alerta = {
    id: string;
    tipoSujeto: "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE";
    identificador: string | null;
    relacion: string | null;
    sujetoNombre: string | null;
    categoria: string | null;
    estadoReporte: string;
    estadoAlerta: string;
    creadoEn: string;
};

type FiltroEstado = "todas" | "nueva" | "vista" | "gestionada";
type FiltroTipoSujeto = "todos" | "ESTUDIANTE" | "PROFESOR" | "ACUDIENTE";

const ESTADO_LABELS: Record<string, string> = {
    nueva: "Nueva",
    vista: "Vista",
    gestionada: "Gestionada",
};

const ESTADO_VARIANTS: Record<string, "default" | "warning" | "success" | "neutral" | "info" | "danger"> = {
    nueva: "default",
    vista: "warning",
    gestionada: "success",
};

const TIPO_SUJETO_LABELS: Record<FiltroTipoSujeto, string> = {
    todos: "Todos los sujetos",
    ESTUDIANTE: "Estudiante",
    PROFESOR: "Profesor",
    ACUDIENTE: "Acudiente",
};

const TIPO_SUJETO_VARIANTS: Record<string, "default" | "info" | "warning" | "neutral"> = {
    ESTUDIANTE: "default",
    PROFESOR: "info",
    ACUDIENTE: "warning",
};

export default function AlertasColegioPageClient() {
    const router = useRouter();
    const [alertas, setAlertas] = useState<Alerta[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtro, setFiltro] = useState<FiltroEstado>("todas");
    const [filtroTipoSujeto, setFiltroTipoSujeto] = useState<FiltroTipoSujeto>("todos");
    const [accionando, setAccionando] = useState<Set<string>>(new Set());

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const url = new URL("/api/colegio/alertas", window.location.origin);
            if (filtro !== "todas") {
                url.searchParams.set("estado", filtro);
            }
            if (filtroTipoSujeto !== "todos") {
                url.searchParams.set("tipoSujeto", filtroTipoSujeto);
            }
            const res = await fetch(url.toString(), { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando alertas");
                setAlertas([]);
                return;
            }
            setAlertas(data.alertas || []);
        } catch {
            setError("Error de red cargando alertas");
            setAlertas([]);
        } finally {
            setCargando(false);
        }
    }, [filtro, filtroTipoSujeto]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const cambiarEstado = async (id: string, estado: "vista" | "gestionada") => {
        if (accionando.has(id)) return;
        setAccionando((prev) => new Set(prev).add(id));
        try {
            const res = await fetch(`/api/colegio/alertas/${id}/estado`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error actualizando alerta");
                return;
            }
            setAlertas((prev) =>
                prev.map((a) => (a.id === id ? { ...a, estadoAlerta: data.alerta.estado } : a))
            );
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

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Alertas</h1>
                            {/* SPEC-129 (C5) / SPEC-165: encabezado que explica qué son las alertas
                                para un rector no técnico. Ahora incluyen estudiante, profesor y acudiente. */}
                            <p className="text-sm text-muted">
                                Avisos que llegan cuando un identificador que registraste para un alumno,
                                profesor o acudiente (número, nick o usuario) aparece en un reporte de la comunidad.
                                Son anonimizados: nunca muestran quién reportó ni el contenido del reporte.
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                            <div className="w-full sm:w-48">
                                <Select
                                    label="Filtrar por tipo"
                                    value={filtroTipoSujeto}
                                    onChange={(e) => setFiltroTipoSujeto(e.target.value as FiltroTipoSujeto)}
                                    options={[
                                        { value: "todos", label: "Todos los sujetos" },
                                        { value: "ESTUDIANTE", label: "Estudiante" },
                                        { value: "PROFESOR", label: "Profesor" },
                                        { value: "ACUDIENTE", label: "Acudiente" },
                                    ]}
                                />
                            </div>
                            <div className="w-full sm:w-48">
                                <Select
                                    label="Filtrar por estado"
                                    value={filtro}
                                    onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
                                    options={[
                                        { value: "todas", label: "Todas" },
                                        { value: "nueva", label: "Nueva" },
                                        { value: "vista", label: "Vista" },
                                        { value: "gestionada", label: "Gestionada" },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    {cargando ? (
                        <div className="flex justify-center py-12">
                            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : alertas.length === 0 ? (
                        <EmptyState
                            title="Aún no hay alertas"
                            description="Aparecerán cuando un identificador que registres para un alumno salga en un reporte. Empieza registrando tus cursos y alumnos."
                            icon={<span className="text-2xl">🛡️</span>}
                            action={
                                <Button onClick={() => router.push("/dashboard/colegio/cursos")}>
                                    Ir a Alumnos
                                </Button>
                            }
                        />
                    ) : (
                        <div className="space-y-4">
                            {alertas.map((alerta) => (
                                <GlassCard key={alerta.id} className="border-l-4 border-l-emerald-500">
                                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="flex-1 space-y-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={TIPO_SUJETO_VARIANTS[alerta.tipoSujeto] || "neutral"}>
                                                    {TIPO_SUJETO_LABELS[alerta.tipoSujeto] || alerta.tipoSujeto}
                                                </Badge>
                                                <Badge variant={ESTADO_VARIANTS[alerta.estadoAlerta] || "neutral"}>
                                                    {ESTADO_LABELS[alerta.estadoAlerta] || alerta.estadoAlerta}
                                                </Badge>
                                            </div>

                                            <div className="text-sm">
                                                <span className="text-subtle">Sujeto:</span>{" "}
                                                <span className="font-medium text-body">
                                                    {alerta.sujetoNombre ?? "Sin nombre"}
                                                </span>
                                                {alerta.relacion && (
                                                    <span className="text-muted"> · {alerta.relacion}</span>
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

                                            <p className="text-xs text-muted">
                                                Recibida el{" "}
                                                {new Date(alerta.creadoEn).toLocaleString("es-CO", {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                })}
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                                            {/* SPEC-159 (US1): la lista enlaza al seguimiento del caso. */}
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
                                                    onClick={() => cambiarEstado(alerta.id, "vista")}
                                                >
                                                    Marcar vista
                                                </Button>
                                            )}
                                            {alerta.estadoAlerta !== "gestionada" && (
                                                <Button
                                                    variant="outline"
                                                    className="py-1.5 px-3 text-xs"
                                                    isLoading={accionando.has(alerta.id)}
                                                    onClick={() => cambiarEstado(alerta.id, "gestionada")}
                                                >
                                                    Marcar gestionada
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </GlassCard>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

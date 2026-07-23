"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";

type EstadisticasCurso = {
    cursoId: string;
    nombre: string;
    grado: string | null;
    anioLectivo: string | null;
    alumnos: number;
    identificadores: number;
    alertas: number;
};

type Estadisticas = {
    colegioId: string;
    colegioNombre: string;
    totales: {
        cursos: number;
        alumnos: number;
        identificadores: number;
        alertas: number;
    };
    porCurso: EstadisticasCurso[];
};

const TARJETAS = [
    { key: "cursos", label: "Cursos", icon: "📚" },
    { key: "alumnos", label: "Alumnos", icon: "🎓" },
    { key: "identificadores", label: "Identificadores", icon: "🆔" },
    { key: "alertas", label: "Alertas", icon: "🚨" },
] as const;

export default function ColegioEstadisticasPageClient() {
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [descargando, setDescargando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const res = await fetch("/api/colegio/estadisticas", { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando estadísticas");
                setEstadisticas(null);
                return;
            }
            setEstadisticas(data);
        } catch {
            setError("Error de red cargando estadísticas");
            setEstadisticas(null);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const descargarPdf = async () => {
        setDescargando(true);
        try {
            const res = await fetch("/api/colegio/estadisticas/pdf", { credentials: "include" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error?.message || "Error generando PDF");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const fecha = new Date().toISOString().slice(0, 10);
            const nombre = estadisticas?.colegioNombre
                ? `estadisticas-${estadisticas.colegioNombre.toLowerCase().replace(/\s+/g, "-")}-${fecha}.pdf`
                : `estadisticas-${fecha}.pdf`;
            a.href = url;
            a.download = nombre;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Error de red descargando PDF");
        } finally {
            setDescargando(false);
        }
    };

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Estadísticas</h1>
                            <p className="text-sm text-muted">
                                Resumen agregado del colegio. No incluye datos personales ni reportes crudos.
                            </p>
                        </div>
                        <Button
                            onClick={descargarPdf}
                            isLoading={descargando}
                            disabled={cargando || !estadisticas}
                            className="accent-gradient"
                        >
                            📄 Descargar PDF
                        </Button>
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
                    ) : !estadisticas ? (
                        <EmptyState
                            title="No se pudieron cargar las estadísticas"
                            description="Intenta recargar la página."
                            icon={<span className="text-2xl">📊</span>}
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                {TARJETAS.map((tarjeta) => (
                                    <GlassCard
                                        key={tarjeta.key}
                                        className="border-l-4 border-l-emerald-500 text-center"
                                    >
                                        <div className="text-2xl">{tarjeta.icon}</div>
                                        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">
                                            {tarjeta.label}
                                        </p>
                                        <p className="mt-1 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                                            {estadisticas.totales[tarjeta.key]}
                                        </p>
                                    </GlassCard>
                                ))}
                            </div>

                            <GlassCard>
                                <h2 className="mb-4 text-lg font-semibold text-body">Desglose por curso</h2>
                                {estadisticas.porCurso.length === 0 ? (
                                    <EmptyState
                                        title="No hay cursos registrados"
                                        description="Crea cursos y alumnos para ver el desglose."
                                        icon={<span className="text-2xl">📚</span>}
                                    />
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead>
                                                <tr className="border-b border-emerald-100 dark:border-emerald-900/30">
                                                    <th className="py-3 pr-4 font-semibold text-subtle">Curso</th>
                                                    <th className="py-3 pr-4 font-semibold text-subtle">Grado</th>
                                                    <th className="py-3 pr-4 text-right font-semibold text-subtle">Alumnos</th>
                                                    <th className="py-3 pr-4 text-right font-semibold text-subtle">Identificadores</th>
                                                    <th className="py-3 text-right font-semibold text-subtle">Alertas</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {estadisticas.porCurso.map((curso) => (
                                                    <tr
                                                        key={curso.cursoId}
                                                        className="border-b border-emerald-50 dark:border-emerald-950/20 last:border-b-0"
                                                    >
                                                        <td className="py-3 pr-4 text-body">{curso.nombre}</td>
                                                        <td className="py-3 pr-4 text-muted">{curso.grado ?? "—"}</td>
                                                        <td className="py-3 pr-4 text-right text-body">{curso.alumnos}</td>
                                                        <td className="py-3 pr-4 text-right text-body">{curso.identificadores}</td>
                                                        <td className="py-3 text-right text-body">{curso.alertas}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </GlassCard>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PublicDashboard } from "@/components/modules/PublicDashboard";

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
        profesores: number;
        alumnos: number;
        identificadores: number;
        alertas: number;
    };
    porCurso: EstadisticasCurso[];
};

const TARJETAS = [
    { key: "cursos", label: "Cursos", icon: "📚" },
    { key: "profesores", label: "Profesores", icon: "👨‍🏫" },
    { key: "alumnos", label: "Alumnos", icon: "🎓" },
    { key: "identificadores", label: "Identificadores", icon: "🆔" },
    { key: "alertas", label: "Alertas", icon: "🚨" },
] as const;

function mesAnteriorDefault(): string {
    const hoy = new Date();
    let anio = hoy.getFullYear();
    let mes = hoy.getMonth();
    if (mes === 0) {
        anio -= 1;
        mes = 12;
    }
    return `${anio}-${String(mes).padStart(2, "0")}`;
}

export default function ColegioEstadisticasPageClient() {
    const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [descargando, setDescargando] = useState(false);
    const [mesInforme, setMesInforme] = useState(mesAnteriorDefault);
    const [descargandoInforme, setDescargandoInforme] = useState(false);

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

    const descargarInformeMensual = async () => {
        setDescargandoInforme(true);
        try {
            const res = await fetch(`/api/colegio/reportes/pdf?mes=${mesInforme}`, { credentials: "include" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error?.message || "Error generando informe mensual");
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            const header = res.headers.get("content-disposition") || "";
            const match = header.match(/filename="([^"]+)"/);
            a.href = url;
            a.download = match ? match[1] : `informe-mensual-${mesInforme}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            setError("Error de red descargando informe mensual");
        } finally {
            setDescargandoInforme(false);
        }
    };

    return (
        <div className="min-h-screen bg-page">
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-5xl space-y-8">
                    {/* SPEC-129 (D-b): vista ampliada pública (mapa/categorías) en la
                        subsección; el componente es el MISMO del dashboard público. */}
                    <PublicDashboard />

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Estadísticas del colegio</h1>
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

                    <GlassCard>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-body">Informe mensual</h2>
                                <p className="text-sm text-muted">
                                    Descarga el resumen agregado de un mes específico.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                    type="month"
                                    value={mesInforme}
                                    onChange={(e) => setMesInforme(e.target.value)}
                                    disabled={descargandoInforme}
                                    className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-body focus:border-emerald-500 focus:outline-none dark:border-emerald-900 dark:bg-emerald-950/30"
                                />
                                <Button
                                    onClick={descargarInformeMensual}
                                    isLoading={descargandoInforme}
                                    disabled={!mesInforme}
                                    variant="outline"
                                >
                                    📊 Descargar informe
                                </Button>
                            </div>
                        </div>
                    </GlassCard>

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
                        // Si la carga falla el botón de PDF queda inhabilitado; se ofrece reintento sin recargar la página.
                        <ErrorState
                            title="No se pudieron cargar las estadísticas"
                            description={error || "Intenta recargar la página."}
                            onRetry={cargar}
                        />
                    ) : (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

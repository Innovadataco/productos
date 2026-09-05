"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PublicDashboard } from "@/components/modules/PublicDashboard";
import { TendenciaReportes } from "@/components/modules/colegio/home/TendenciaReportes";
import { RelojActividad } from "@/components/modules/colegio/estadisticas/RelojActividad";
import { RitmoMensual } from "@/components/modules/colegio/estadisticas/RitmoMensual";
import { BarrasPorCurso } from "@/components/modules/colegio/estadisticas/BarrasPorCurso";
import { SeccionPatrones } from "@/components/modules/colegio/estadisticas/SeccionPatrones";
import { SeccionComparativa } from "@/components/modules/colegio/estadisticas/SeccionComparativa";
import { TablaDesgloseCursos } from "@/components/modules/colegio/estadisticas/TablaDesgloseCursos";
import type { EstadisticasInteligenciaColegio } from "@/lib/colegio/inteligencia";
import type { ComparativaCursos } from "@/lib/colegio/comparativa";

type Estadisticas = EstadisticasInteligenciaColegio;

const TARJETAS = [
    { key: "cursos", label: "Cursos", icon: "📚" },
    { key: "profesores", label: "Profesores", icon: "👨‍🏫" },
    { key: "estudiantes", label: "Estudiantes", icon: "🎓" },
    { key: "identificadores", label: "Identificadores", icon: "🆔" },
    { key: "alertas", label: "Alertas", icon: "🚨" },
] as const;

// SPEC-380 (PR B): tipada como `Record<TipoSujeto, ...>` a través del
// `satisfies` para que agregar un 5º sujeto sin card falle el compilador.
const TARJETAS_TIPO_SUJETO = [
    { key: "ESTUDIANTE" as const, label: "Estudiantes", icon: "🎓" },
    { key: "PROFESOR" as const, label: "Profesores", icon: "👨‍🏫" },
    { key: "ACUDIENTE" as const, label: "Acudientes", icon: "👪" },
    { key: "INTEGRANTE_COMITE" as const, label: "Comité de convivencia", icon: "🛡️" },
];

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

interface ColegioEstadisticasPageClientProps {
    datos: Estadisticas;
}

export default function ColegioEstadisticasPageClient({ datos }: ColegioEstadisticasPageClientProps) {
    const [estadisticas, setEstadisticas] = useState<Estadisticas>(datos);
    const [cargandoComparativa, setCargandoComparativa] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [descargando, setDescargando] = useState(false);
    const [mesInforme, setMesInforme] = useState(mesAnteriorDefault);
    const [descargandoInforme, setDescargandoInforme] = useState(false);

    useEffect(() => {
        setEstadisticas(datos);
    }, [datos]);

    const cargarComparativa = useCallback(async (criterio: "grado" | "anioLectivo") => {
        setCargandoComparativa(true);
        setError(null);
        try {
            const res = await fetch(`/api/colegio/analisis/comparativa?agruparPor=${criterio}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data?.error?.message || "Error cargando comparativa");
                return;
            }
            setEstadisticas((prev) => ({ ...prev, comparativa: data as ComparativaCursos }));
        } catch {
            setError("Error de red cargando comparativa");
        } finally {
            setCargandoComparativa(false);
        }
    }, []);

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
            const nombre = estadisticas.colegioNombre
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
                <div className="mx-auto max-w-6xl space-y-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-body">Inteligencia del colegio</h1>
                            <p className="text-sm text-muted">
                                {estadisticas.colegioNombre} — datos agregados sin información personal.
                            </p>
                        </div>
                        <Button onClick={descargarPdf} isLoading={descargando} disabled={!estadisticas} className="accent-gradient">
                            📄 Descargar PDF
                        </Button>
                    </div>

                    <GlassCard>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-body">Informe mensual</h2>
                                <p className="text-sm text-muted">Descargue el resumen agregado de un mes específico.</p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <input
                                    type="month"
                                    value={mesInforme}
                                    onChange={(e) => setMesInforme(e.target.value)}
                                    disabled={descargandoInforme}
                                    className="rounded-lg border border-pino/30 bg-tinta/5 px-3 py-2 text-sm text-body focus:border-pino focus:outline-none"
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
                        <div className="rounded-xl bg-rubi/10 p-4 text-sm text-estado-rubi">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {TARJETAS.map((tarjeta) => (
                            <GlassCard key={tarjeta.key} className="border-l-4 border-l-pino text-center">
                                <div className="text-2xl">{tarjeta.icon}</div>
                                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">{tarjeta.label}</p>
                                <p className="mt-1 text-3xl font-bold text-estado-pino">
                                    {estadisticas.totales[tarjeta.key]}
                                </p>
                            </GlassCard>
                        ))}
                    </div>

                    <section aria-labelledby="titulo-alertas-tipo-sujeto" className="space-y-4">
                        <h2 id="titulo-alertas-tipo-sujeto" className="titular-seccion text-body">
                            Alertas por tipo de sujeto
                        </h2>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            {TARJETAS_TIPO_SUJETO.map((tarjeta) => (
                                <GlassCard key={tarjeta.key} className="border-l-4 border-l-pino text-center">
                                    <div className="text-2xl">{tarjeta.icon}</div>
                                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-subtle">{tarjeta.label}</p>
                                    <p className="mt-1 text-3xl font-bold text-estado-pino">
                                        {estadisticas.alertasPorTipoSujeto[tarjeta.key]}
                                    </p>
                                </GlassCard>
                            ))}
                        </div>
                    </section>

                    <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
                        <TendenciaReportes
                            semanal={estadisticas.tendencia.semanal}
                            mensual={estadisticas.tendencia.mensual}
                            anual={estadisticas.tendencia.anual}
                        />
                        <RelojActividad horas={estadisticas.reloj24h} />
                    </div>

                    <div className="grid gap-5 sm:gap-6 lg:grid-cols-2">
                        <RitmoMensual puntos={estadisticas.tendencia.mensual} />
                        <BarrasPorCurso cursos={estadisticas.porCurso.map((c) => ({ cursoId: c.cursoId, nombre: c.nombre, reportes30d: c.alertas }))} />
                    </div>

                    <TablaDesgloseCursos cursos={estadisticas.porCurso} />

                    <SeccionPatrones patrones={estadisticas.patrones} />

                    <SeccionComparativa
                        comparativa={estadisticas.comparativa}
                        onCambiarCriterio={cargarComparativa}
                    />
                    {cargandoComparativa && (
                        <div className="flex justify-center py-4">
                            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-pino border-t-transparent" />
                        </div>
                    )}

                    <section aria-labelledby="titulo-mapa-publico" className="space-y-4">
                        <h2 id="titulo-mapa-publico" className="titular-seccion text-body">
                            Mapa de reportes a nivel país
                        </h2>
                        <p className="text-sm text-muted">Contexto nacional, separado de las estadísticas de su colegio.</p>
                        <PublicDashboard />
                    </section>
                </div>
            </main>
        </div>
    );
}

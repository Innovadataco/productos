"use client";

import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";
import type { Analitica, VentanaDias } from "./types";
import { VENTANAS } from "./types";

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

function formatCategoria(value: string) {
    return CATEGORIAS.find((c) => c.value === value)?.label || value;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "short" });
}

interface SpamAnaliticaPanelProps {
    analitica: Analitica | null;
    loading: boolean;
    error: string;
    ventanaActiva: VentanaDias;
    descargandoBanco: boolean;
    onVentanaChange: (dias: VentanaDias) => void;
    onSugerirBanco: () => void;
    onRetry: () => void;
}

export function SpamAnaliticaPanel({
    analitica,
    loading,
    error,
    ventanaActiva,
    descargandoBanco,
    onVentanaChange,
    onSugerirBanco,
    onRetry,
}: SpamAnaliticaPanelProps) {
    const metricas = analitica?.metricas?.[ventanaActiva];

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-body">Panel de análisis</h2>
                <div className="flex items-center gap-2">
                    {VENTANAS.map((d) => (
                        <Button
                            key={d}
                            variant={ventanaActiva === d ? "primary" : "outline"}
                            className="text-xs py-1.5 px-3"
                            onClick={() => onVentanaChange(d)}
                        >
                            {d}d
                        </Button>
                    ))}
                    <Button
                        variant="secondary"
                        className="text-xs py-1.5 px-3"
                        onClick={onSugerirBanco}
                        disabled={descargandoBanco}
                    >
                        {descargandoBanco ? "Generando..." : "Sugerir al banco"}
                    </Button>
                </div>
            </div>

            {error && (
                <ErrorState
                    title="No pudimos cargar el análisis"
                    description={error}
                    onRetry={onRetry}
                />
            )}

            {loading && !analitica && (
                <div className="glass rounded-2xl p-8 text-center">
                    <Cargando tamano="sm" />
                </div>
            )}

            {analitica && metricas && (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MetricCard label="Confirmados spam" value={metricas.esSpam} color="bg-rubi" />
                        <MetricCard label="Corregidos" value={metricas.corregidos} color="bg-ambar" />
                        <MetricCard label="Procesados como acoso" value={metricas.procesadosComoAcoso} color="bg-cielo" />
                        <MetricCard
                            label="Tasa spam"
                            value={`${(metricas.tasaSpam * 100).toFixed(1)}%`}
                            sub={metricas.tiempoPromedioResolucionMin !== null ? `Ø ${metricas.tiempoPromedioResolucionMin} min` : undefined}
                            color="bg-pino"
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
                                                    <div className="bg-cielo w-full" style={{ height: `${(punto.procesadosComoAcoso / total) * 100}%` }} />
                                                )}
                                                {punto.corregidos > 0 && (
                                                    <div className="bg-ambar w-full" style={{ height: `${(punto.corregidos / total) * 100}%` }} />
                                                )}
                                                {punto.esSpam > 0 && (
                                                    <div className="bg-rubi w-full" style={{ height: `${(punto.esSpam / total) * 100}%` }} />
                                                )}
                                            </div>
                                            <span className="text-[10px] text-subtle text-center mt-1 hidden sm:block">{formatDate(punto.fecha)}</span>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-tinta text-papel text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                                                {formatDate(punto.fecha)}: spam {punto.esSpam}, corregidos {punto.corregidos}, acoso {punto.procesadosComoAcoso}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex flex-wrap gap-3 mt-3 text-xs text-subtle">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rubi" /> Spam</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ambar" /> Corregidos</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cielo" /> Procesados como acoso</span>
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
                    <div className="h-1.5 w-full rounded-full bg-tinta/10 dark:bg-tinta/20">
                        <div className="h-1.5 rounded-full bg-tinta/50" style={{ width: `${(item.count / max) * 100}%` }} />
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

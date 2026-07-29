"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";

/**
 * Expediente del reporte (spec 096, Fase 3): traza de solo lectura del pipeline.
 * Nombres, orden y fases de las etapas llegan del parámetro `admin.expediente.etapas`
 * vía el endpoint — NADA de etiquetas de etapa quemadas aquí (ADR_004). Solo son del
 * componente las etiquetas genéricas de UI (Actividad, Evaluación, Sin instrumentar...).
 * Patrón visual del Stage de `src/components/modules/ia/IaTraceTimeline.tsx`
 * (punto + línea + GlassCard + Badge).
 */

interface EtapaExpediente {
    orden: number;
    fase: string;
    faseNombre: string;
    clave: string;
    nombre: string;
    icono: string;
    capa: number;
    actividad: string;
    evaluacion: string;
    fechaHora: string | null;
    campos: Record<string, unknown>;
    gated: boolean;
    sinInstrumentar: boolean;
}

interface PreguntaVotacion {
    texto: string;
    tipo: "decisiva" | "contexto";
    votosPorModelo: Record<string, number>;
}

interface DetalleCategoria {
    categoria: string;
    preguntas: PreguntaVotacion[];
}

interface VotacionExpediente {
    categorias: string[];
    confianza: number;
    usoCascada: boolean;
    modeloCascada: string | null;
    latenciaMs: number;
    promptTokens: number | null;
    responseTokens: number | null;
    matriz: Record<string, Record<string, number>>;
    detallePorCategoria: DetalleCategoria[];
}

interface ExpedienteResponse {
    reporte: {
        id: string;
        numeroSeguimiento: string;
        estado: string;
        creadoEn: string;
        plataforma: string;
        pais: string;
        ciudad: string;
        esAnonimo: boolean;
    };
    etapas: EtapaExpediente[];
    clasificacion: VotacionExpediente | null;
    sintesis: { analisisInterno: string; mensajePadre: string };
    revelado: boolean;
    puedeRevelar: boolean;
}

interface AdminReporteExpedienteProps {
    reporteId: string;
    onClose: () => void;
}

function formatearFechaHora(fechaHora: string | null): string {
    if (!fechaHora) return "—";
    const fecha = new Date(fechaHora);
    if (Number.isNaN(fecha.getTime())) return "—";
    return fecha.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });
}

function formatearValor(valor: unknown): string {
    if (valor === null || valor === undefined) return "—";
    if (typeof valor === "boolean") return valor ? "Sí" : "No";
    if (typeof valor === "number" || typeof valor === "string") return String(valor);
    if (Array.isArray(valor)) {
        if (valor.length === 0) return "—";
        return valor
            .map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)))
            .join(", ");
    }
    return JSON.stringify(valor);
}

function formatearConfianza(confianza: number): string {
    const porcentaje = confianza <= 1 ? confianza * 100 : confianza;
    return `${porcentaje.toFixed(0)}%`;
}

/** Etapa del timeline: replica el patrón visual del Stage de IaTraceTimeline. */
function Stage({ titulo, children }: { titulo: string; children: React.ReactNode }) {
    return (
        <div className="relative pl-6">
            <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-sky-500 ring-4 ring-sky-100 dark:bg-cyan-400 dark:ring-sky-900" />
            <div className="absolute left-[4px] top-6 h-[calc(100%-16px)] w-0.5 bg-slate-200 dark:bg-slate-700" />
            <GlassCard className="mb-4 p-4">
                <h4 className="mb-2 text-sm font-semibold text-body">{titulo}</h4>
                <div className="space-y-2 text-sm text-body">{children}</div>
            </GlassCard>
        </div>
    );
}

function EtapaTimeline({ etapa }: { etapa: EtapaExpediente }) {
    return (
        <Stage titulo={etapa.nombre}>
            <div className="flex flex-wrap items-center gap-2">
                {etapa.sinInstrumentar && <Badge variant="neutral">Sin instrumentar</Badge>}
                {etapa.gated && <Badge variant="warning">Campos restringidos</Badge>}
                <span className="text-xs text-muted">{formatearFechaHora(etapa.fechaHora)}</span>
            </div>
            <div>
                <p className="text-xs font-medium text-muted">Actividad</p>
                <p>{etapa.actividad}</p>
            </div>
            <div>
                <p className="text-xs font-medium text-muted">Evaluación</p>
                <p>{etapa.evaluacion}</p>
            </div>
            {Object.keys(etapa.campos).length > 0 && (
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                    {Object.entries(etapa.campos).map(([clave, valor]) => (
                        <div key={clave} className="flex items-baseline justify-between gap-2">
                            <dt className="font-mono text-xs text-muted">{clave}</dt>
                            <dd className="break-all text-right text-xs">{formatearValor(valor)}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </Stage>
    );
}

function SeccionVotacion({ clasificacion }: { clasificacion: VotacionExpediente }) {
    const modelos = Array.from(
        new Set(Object.values(clasificacion.matriz).flatMap((fila) => Object.keys(fila)))
    );

    return (
        <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-body">Votación de la clasificación</h3>
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-body">
                <Badge variant="info">Confianza {formatearConfianza(clasificacion.confianza)}</Badge>
                {clasificacion.usoCascada && (
                    <Badge variant="default">
                        Cascada{clasificacion.modeloCascada ? `: ${clasificacion.modeloCascada}` : ""}
                    </Badge>
                )}
                <Badge variant="neutral">{clasificacion.latenciaMs} ms</Badge>
                {(clasificacion.promptTokens !== null || clasificacion.responseTokens !== null) && (
                    <Badge variant="neutral">
                        Tokens: {clasificacion.promptTokens ?? "—"} prompt · {clasificacion.responseTokens ?? "—"} respuesta
                    </Badge>
                )}
            </div>

            {modelos.length > 0 && (
                <div className="mb-4 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="text-subtle">
                            <tr>
                                <th className="px-2 py-1 font-medium">Categoría</th>
                                {modelos.map((m) => (
                                    <th key={m} className="px-2 py-1 text-center font-medium">{m}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {Object.entries(clasificacion.matriz).map(([categoria, fila]) => (
                                <tr key={categoria}>
                                    <td className="px-2 py-1 text-body">{categoria}</td>
                                    {modelos.map((m) => (
                                        <td key={m} className="px-2 py-1 text-center">
                                            {fila[m] === 1 ? (
                                                <Badge variant="success">1</Badge>
                                            ) : (
                                                <Badge variant="neutral">0</Badge>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {clasificacion.detallePorCategoria.map((detalle) => {
                const modelosCategoria = Array.from(
                    new Set(detalle.preguntas.flatMap((p) => Object.keys(p.votosPorModelo)))
                );
                return (
                    <div key={detalle.categoria} className="mb-3 last:mb-0">
                        <p className="mb-1 text-xs font-semibold text-body">{detalle.categoria}</p>
                        <ul className="space-y-1">
                            {detalle.preguntas.map((pregunta, indice) => (
                                <li
                                    key={`${detalle.categoria}-${indice}`}
                                    className="rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-900"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={pregunta.tipo === "decisiva" ? "danger" : "neutral"}>
                                            {pregunta.tipo === "decisiva" ? "Decisiva" : "Contexto"}
                                        </Badge>
                                        <span className="text-body">{pregunta.texto}</span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        {modelosCategoria.map((m) => (
                                            <span key={m} className="text-muted">
                                                {m}: <span className="font-medium text-body">{pregunta.votosPorModelo[m] ?? 0}</span>
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </GlassCard>
    );
}

export function AdminReporteExpediente({ reporteId, onClose }: AdminReporteExpedienteProps) {
    const [expediente, setExpediente] = useState<ExpedienteResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [revelando, setRevelando] = useState(false);
    const [error, setError] = useState("");

    const cargarExpediente = useCallback(
        async (revelar: boolean) => {
            try {
                const query = revelar ? "?revelar=true" : "";
                const res = await fetch(`/api/admin/reportes/${reporteId}/expediente${query}`, {
                    credentials: "include",
                });
                if (res.status === 401) {
                    window.location.href = "/login";
                    return;
                }
                const json = await res.json();
                if (!res.ok) {
                    const mensaje =
                        typeof json?.error?.message === "string"
                            ? json.error.message
                            : "No se pudo cargar el expediente";
                    throw new Error(mensaje);
                }
                setExpediente(json as ExpedienteResponse);
                setError("");
            } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo cargar el expediente");
            } finally {
                setLoading(false);
                setRevelando(false);
            }
        },
        [reporteId]
    );

    useEffect(() => {
        cargarExpediente(false);
    }, [cargarExpediente]);

    const revelarOriginal = () => {
        setRevelando(true);
        cargarExpediente(true);
    };

    return (
        <Modal isOpen onClose={onClose} title="Expediente del reporte" size="xl">
            {loading ? (
                <Cargando tamano="sm" texto="Cargando expediente..." className="py-10" />
            ) : error ? (
                <div className="py-6 text-center">
                    <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
                </div>
            ) : expediente ? (
                <div className="space-y-4">
                    <GlassCard className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <p className="font-mono text-sm text-body">{expediente.reporte.numeroSeguimiento}</p>
                                <p className="text-xs text-muted">
                                    {expediente.reporte.plataforma} · {expediente.reporte.ciudad}, {expediente.reporte.pais} ·{" "}
                                    {expediente.reporte.esAnonimo ? "Anónimo" : "Autenticado"} ·{" "}
                                    {formatearFechaHora(expediente.reporte.creadoEn)}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="info">{expediente.reporte.estado.replace(/_/g, " ")}</Badge>
                                {expediente.puedeRevelar && !expediente.revelado && (
                                    <Button
                                        onClick={revelarOriginal}
                                        variant="outline"
                                        className="py-2 px-3 text-xs"
                                        disabled={revelando}
                                    >
                                        {revelando ? "Revelando..." : "Revelar original"}
                                    </Button>
                                )}
                            </div>
                        </div>
                        {expediente.revelado && (
                            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                                Versión original revelada. Esta revelación queda registrada en el registro de auditoría.
                            </p>
                        )}
                    </GlassCard>

                    <div className="space-y-1">
                        {expediente.etapas.map((etapa, indice) => {
                            const iniciaFase = indice === 0 || expediente.etapas[indice - 1].fase !== etapa.fase;
                            return (
                                <div key={etapa.clave}>
                                    {iniciaFase && (
                                        <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                                            Fase {etapa.fase} — {etapa.faseNombre}
                                        </h3>
                                    )}
                                    <EtapaTimeline etapa={etapa} />
                                </div>
                            );
                        })}
                    </div>

                    {expediente.clasificacion && <SeccionVotacion clasificacion={expediente.clasificacion} />}

                    <GlassCard className="p-4">
                        <h3 className="mb-1 text-sm font-semibold text-body">Análisis interno</h3>
                        <p className="mb-2 text-xs text-muted">Uso interno del equipo de revisión. No se muestra al público.</p>
                        <p className="whitespace-pre-line text-sm text-body">{expediente.sintesis.analisisInterno}</p>
                    </GlassCard>

                    <GlassCard className="p-4">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-body">Mensaje al padre</h3>
                            <Badge variant="warning">Borrador de revisión</Badge>
                        </div>
                        <p className="mb-2 text-xs text-muted">
                            Texto preliminar pendiente de revisión humana. No existe acción de envío ni publicación.
                        </p>
                        <p className="whitespace-pre-line text-sm text-body">{expediente.sintesis.mensajePadre}</p>
                    </GlassCard>
                </div>
            ) : null}
        </Modal>
    );
}

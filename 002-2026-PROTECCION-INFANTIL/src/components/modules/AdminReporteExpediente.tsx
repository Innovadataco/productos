"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { AdminReporteProceso } from "./AdminReporteProceso";

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
    /** SPEC-140 (F2): presentes solo cuando el usuario tiene el módulo denuncia_formal. */
    puedeDenunciar?: boolean;
    canalesDenuncia?: CanalOficial[];
}

/** Canal oficial de denuncia (parámetro `mensaje.padre.canales`). */
interface CanalOficial {
    nombre: string;
    contacto: string;
    descripcion: string;
}

/** SPEC-140 (FR-001): la denuncia formal exige clasificación confirmada. */
const ESTADOS_DENUNCIABLES = new Set(["CLASIFICADO", "CORREGIDO", "REVISION_MANUAL"]);

interface AdminReporteExpedienteProps {
    reporteId: string;
    onClose: () => void;
}

function formatearFechaHora(fechaHora: string | null): string {
    if (!fechaHora) return "—";
    const fecha = new Date(fechaHora);
    if (Number.isNaN(fecha.getTime())) return "—";
    return fecha.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" });
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

function SeccionVotacion({ clasificacion }: { clasificacion: VotacionExpediente }) {    const modelos = Array.from(
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

/**
 * SPEC-140 (F2 + N-4): acciones de denuncia formal y exportación forense.
 * Visible solo con el módulo `denuncia_formal` (lo decide el endpoint del
 * expediente vía `puedeDenunciar`) y con clasificación confirmada. El PDF se
 * genera por plantilla determinista y se descarga; la plataforma no lo retiene.
 */
function SeccionDenunciaFormal({ reporteId, canales }: { reporteId: string; canales: CanalOficial[] }) {
    const [abierto, setAbierto] = useState(false);
    const [canal, setCanal] = useState("");
    const [generando, setGenerando] = useState(false);
    const [errorDenuncia, setErrorDenuncia] = useState("");

    const descargarBlob = (blob: Blob, nombre: string) => {
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        URL.revokeObjectURL(url);
    };

    const generarDenuncia = async () => {
        if (!canal) return;
        setGenerando(true);
        setErrorDenuncia("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/denuncia-formal`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ canalDestino: canal }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(
                    typeof json?.error?.message === "string" ? json.error.message : "No se pudo generar la denuncia"
                );
            }
            const blob = await res.blob();
            descargarBlob(blob, `denuncia-formal-${reporteId}.pdf`);
            setAbierto(false);
        } catch (e) {
            setErrorDenuncia(e instanceof Error ? e.message : "No se pudo generar la denuncia");
        } finally {
            setGenerando(false);
        }
    };

    const exportarForense = async () => {
        setGenerando(true);
        setErrorDenuncia("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/forense/pdf`, { credentials: "include" });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                throw new Error(
                    typeof json?.error?.message === "string" ? json.error.message : "No se pudo exportar el expediente"
                );
            }
            const blob = await res.blob();
            descargarBlob(blob, `expediente-forense-${reporteId}.pdf`);
        } catch (e) {
            setErrorDenuncia(e instanceof Error ? e.message : "No se pudo exportar el expediente");
        } finally {
            setGenerando(false);
        }
    };

    return (
        <GlassCard className="p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-body">Denuncia formal ante autoridades</h3>
                <Badge variant="neutral">Sin retención del documento</Badge>
            </div>
            <p className="mb-3 text-xs text-muted">
                Genera un documento por plantilla (sin IA) para presentar ante un canal oficial. La plataforma no
                conserva el documento; la generación queda registrada en auditoría sin su contenido.
            </p>
            {!abierto ? (
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setAbierto(true)} className="px-3 py-2 text-xs" disabled={generando}>
                        Llevar a denuncia formal
                    </Button>
                    <Button onClick={exportarForense} variant="outline" className="px-3 py-2 text-xs" disabled={generando}>
                        {generando ? "Generando..." : "Exportar expediente forense (PDF)"}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div>
                        <label htmlFor="canal-denuncia" className="mb-1 block text-xs font-medium text-muted">
                            Canal oficial destino
                        </label>
                        <select
                            id="canal-denuncia"
                            value={canal}
                            onChange={(e) => setCanal(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-body dark:border-slate-700 dark:bg-slate-900"
                        >
                            <option value="">Selecciona un canal...</option>
                            {canales.map((c) => (
                                <option key={c.nombre} value={c.nombre}>
                                    {c.nombre} ({c.contacto})
                                </option>
                            ))}
                        </select>
                        {canales.length === 0 && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                                No hay canales oficiales configurados. Un administrador debe revisar el parámetro de canales.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={generarDenuncia} className="px-3 py-2 text-xs" disabled={!canal || generando}>
                            {generando ? "Generando..." : "Generar y descargar PDF"}
                        </Button>
                        <Button
                            onClick={() => {
                                setAbierto(false);
                                setErrorDenuncia("");
                            }}
                            variant="outline"
                            className="px-3 py-2 text-xs"
                            disabled={generando}
                        >
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}
            {errorDenuncia && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
                    {errorDenuncia}
                </p>
            )}
        </GlassCard>
    );
}

type PestañaExpediente = "pipeline" | "proceso";

export function AdminReporteExpediente({ reporteId, onClose }: AdminReporteExpedienteProps) {
    const [expediente, setExpediente] = useState<ExpedienteResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [revelando, setRevelando] = useState(false);
    const [error, setError] = useState("");
    const [pestaña, setPestaña] = useState<PestañaExpediente>("pipeline");

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

                    <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                        <Button
                            onClick={() => setPestaña("pipeline")}
                            variant={pestaña === "pipeline" ? "primary" : "outline"}
                            className="px-3 py-2 text-xs"
                        >
                            Pipeline
                        </Button>
                        <Button
                            onClick={() => setPestaña("proceso")}
                            variant={pestaña === "proceso" ? "primary" : "outline"}
                            className="px-3 py-2 text-xs"
                        >
                            Proceso
                        </Button>
                    </div>

                    {pestaña === "pipeline" && (
                        <>
                            {expediente.puedeDenunciar === true && ESTADOS_DENUNCIABLES.has(expediente.reporte.estado) && (
                                <SeccionDenunciaFormal
                                    reporteId={expediente.reporte.id}
                                    canales={expediente.canalesDenuncia ?? []}
                                />
                            )}

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
                        </>
                    )}

                    {pestaña === "proceso" && <AdminReporteProceso reporteId={reporteId} />}
                </div>
            ) : null}
        </Modal>
    );
}

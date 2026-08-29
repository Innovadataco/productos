"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";

/**
 * SPEC-110 — Bandeja de apelaciones del comité de validación. El caso llega directo
 * (sin triaje) y un humano lo toma, revisa motivo/acreditación, descarga la evidencia
 * (cada descarga queda auditada) y resuelve con motivación escrita. Al aceptar elige
 * quitar la visibilidad y/o dar de baja reportes falsos. Textos en español neutro.
 */

type ApelacionResumen = {
    id: string;
    numero: string;
    identificador: string;
    plataforma: { nombre: string; clave: string };
    estado: "RECIBIDA" | "EN_REVISION" | "ACEPTADA" | "RECHAZADA";
    esRepresentante: boolean;
    creadoEn: string;
    plazoRespuestaEn: string;
    diasHabilesTranscurridos: number;
    proximoAVencer: boolean;
    apelante: { id: string; nombre: string | null; email: string };
    comiteAsignado: { id: string; nombre: string | null } | null;
};

type ReporteDetalle = {
    id: string;
    estado: string;
    eliminado: boolean;
    motivoBaja: string | null;
    creadoEn: string;
    ciudad: string;
    pais: string;
    texto: string;
    categoria: string | null;
};

type DocumentoDetalle = {
    id: string;
    nombreOriginal: string;
    tamanoBytes: number;
    hashSha256: string;
    eliminadoEn: string | null;
    accesos: { id: string; accedidoEn: string; usuario: { nombre: string | null; email: string } }[];
} | null;

type Detalle = {
    apelacion: ApelacionResumen & {
        motivo: string;
        acreditacion: string | null;
        decision: string | null;
        motivacionResolucion: string | null;
        quitoVisibilidad: boolean;
        resueltoEn: string | null;
    };
    documento: DocumentoDetalle;
    reportes: ReporteDetalle[];
};

type Mensaje = { type: "success" | "error"; text: string } | null;

const ESTADO_LABEL: Record<string, string> = {
    RECIBIDA: "Recibida",
    EN_REVISION: "En revisión",
    ACEPTADA: "Aceptada",
    RECHAZADA: "Rechazada",
};
const ESTADO_VARIANT: Record<string, "info" | "warning" | "success" | "neutral"> = {
    RECIBIDA: "info",
    EN_REVISION: "warning",
    ACEPTADA: "success",
    RECHAZADA: "neutral",
};
const ESTADOS_FILTRO = [
    { value: "", label: "Todos los estados" },
    { value: "RECIBIDA", label: "Recibidas" },
    { value: "EN_REVISION", label: "En revisión" },
    { value: "ACEPTADA", label: "Aceptadas" },
    { value: "RECHAZADA", label: "Rechazadas" },
];

function formatFecha(iso: string): string {
    return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", year: "numeric", month: "short", day: "numeric" });
}
function formatTamano(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ApelacionesBandejaClient() {
    const [items, setItems] = useState<ApelacionResumen[]>([]);
    const [estadoFiltro, setEstadoFiltro] = useState("");
    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState<Mensaje>(null);

    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const [decision, setDecision] = useState<"ACEPTADA" | "RECHAZADA">("ACEPTADA");
    const [motivacion, setMotivacion] = useState("");
    const [quitarVisibilidad, setQuitarVisibilidad] = useState(false);
    const [reportesABajar, setReportesABajar] = useState<Set<string>>(new Set());
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const qs = estadoFiltro ? `?estado=${estadoFiltro}&pageSize=50` : "?pageSize=50";
            const res = await fetch(`/api/admin/comite/apelaciones${qs}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setItems(data.items || []);
            else setMensaje({ type: "error", text: data?.error?.message || "Error cargando la bandeja" });
        } catch {
            setMensaje({ type: "error", text: "Error de red cargando la bandeja" });
        } finally {
            setCargando(false);
        }
    }, [estadoFiltro]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function abrirDetalle(id: string) {
        setCargandoDetalle(true);
        setMensaje(null);
        setDecision("ACEPTADA");
        setMotivacion("");
        setQuitarVisibilidad(false);
        setReportesABajar(new Set());
        try {
            const res = await fetch(`/api/admin/comite/apelaciones/${id}`, { credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setDetalle(data);
            else setMensaje({ type: "error", text: data?.error?.message || "Error cargando el caso" });
        } catch {
            setMensaje({ type: "error", text: "Error de red cargando el caso" });
        } finally {
            setCargandoDetalle(false);
        }
    }

    async function tomar(id: string) {
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/comite/apelaciones/${id}/tomar`, { method: "POST", credentials: "include" });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMensaje({ type: "success", text: "Caso tomado. Quedó en revisión asignado a ti." });
                await cargar();
                await abrirDetalle(id);
            } else {
                setMensaje({ type: "error", text: data?.error?.message || "No se pudo tomar el caso" });
            }
        } catch {
            setMensaje({ type: "error", text: "Error de red al tomar el caso" });
        }
    }

    function toggleReporte(id: string) {
        setReportesABajar((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function resolver(e: React.FormEvent) {
        e.preventDefault();
        if (!detalle) return;
        setMensaje(null);
        if (!motivacion.trim()) {
            setMensaje({ type: "error", text: "La motivación escrita es obligatoria." });
            return;
        }
        if (decision === "ACEPTADA" && !quitarVisibilidad && reportesABajar.size === 0) {
            setMensaje({ type: "error", text: "Al aceptar debes quitar la visibilidad y/o dar de baja reportes." });
            return;
        }
        setEnviando(true);
        try {
            const res = await fetch(`/api/admin/comite/apelaciones/${detalle.apelacion.id}/resolver`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    decision,
                    motivacion: motivacion.trim(),
                    quitarVisibilidad,
                    reportesABajar: [...reportesABajar],
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setMensaje({ type: "success", text: `Apelación ${ESTADO_LABEL[decision].toLowerCase()} correctamente.` });
                await cargar();
                await abrirDetalle(detalle.apelacion.id);
            } else {
                setMensaje({ type: "error", text: data?.error?.message || "No se pudo resolver el caso" });
            }
        } catch {
            setMensaje({ type: "error", text: "Error de red al resolver el caso" });
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Apelaciones</h1>
                <p className="text-sm text-muted">
                    Revisa y resuelve las apelaciones de titulares. La decisión debe ser humana y motivada.
                </p>
            </div>

            {mensaje && (
                <div
                    className={`rounded-xl p-4 text-sm ${
                        mensaje.type === "error"
                            ? "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200"
                            : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                    }`}
                >
                    {mensaje.text}
                </div>
            )}

            <GlassCard>
                <div className="mb-4 max-w-xs">
                    <Select
                        label="Filtrar por estado"
                        options={ESTADOS_FILTRO}
                        value={estadoFiltro}
                        onChange={(e) => setEstadoFiltro(e.target.value)}
                    />
                </div>
                {cargando ? (
                    <div className="flex items-center gap-3 py-8 text-muted">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                        Cargando apelaciones...
                    </div>
                ) : items.length === 0 ? (
                    <EmptyState title="No hay apelaciones" description="Cuando un titular radique una apelación, aparecerá aquí." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-800">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Número</th>
                                    <th className="pb-3 font-medium">Identificador</th>
                                    <th className="pb-3 font-medium">Apelante</th>
                                    <th className="pb-3 font-medium">Estado</th>
                                    <th className="pb-3 font-medium">Días hábiles</th>
                                    <th className="pb-3 font-medium text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {items.map((a) => (
                                    <tr key={a.id} className="align-top">
                                        <td className="py-3 pr-3 font-mono text-body">{a.numero}</td>
                                        <td className="py-3 pr-3 text-muted">
                                            {a.identificador}
                                            <span className="block text-xs">{a.plataforma.nombre}</span>
                                        </td>
                                        <td className="py-3 pr-3 text-muted">
                                            {a.apelante.nombre || a.apelante.email}
                                            {a.esRepresentante && <span className="block text-xs">(representante)</span>}
                                        </td>
                                        <td className="py-3 pr-3">
                                            <Badge variant={ESTADO_VARIANT[a.estado]}>{ESTADO_LABEL[a.estado]}</Badge>
                                            {a.proximoAVencer && (
                                                <Badge variant="warning" className="ml-1">Próximo a vencer</Badge>
                                            )}
                                        </td>
                                        <td className="py-3 pr-3 text-muted">{a.diasHabilesTranscurridos}</td>
                                        <td className="py-3 text-right">
                                            <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => abrirDetalle(a.id)}>
                                                Revisar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>

            {cargandoDetalle && (
                <div className="flex items-center gap-3 py-6 text-muted">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                    Cargando caso...
                </div>
            )}

            {detalle && !cargandoDetalle && (
                <GlassCard>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h2 className="font-mono text-lg font-semibold text-body">{detalle.apelacion.numero}</h2>
                            <p className="text-sm text-muted">
                                {detalle.apelacion.identificador} · {detalle.apelacion.plataforma.nombre} · radicada el{" "}
                                {formatFecha(detalle.apelacion.creadoEn)}
                            </p>
                        </div>
                        <Badge variant={ESTADO_VARIANT[detalle.apelacion.estado]}>{ESTADO_LABEL[detalle.apelacion.estado]}</Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                        <div>
                            <h3 className="text-sm font-semibold text-body">Motivo de la apelación</h3>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{detalle.apelacion.motivo}</p>
                        </div>
                        {detalle.apelacion.esRepresentante && detalle.apelacion.acreditacion && (
                            <div>
                                <h3 className="text-sm font-semibold text-body">Acreditación de la representación</h3>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{detalle.apelacion.acreditacion}</p>
                            </div>
                        )}

                        {detalle.documento && (
                            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-body">Documento de evidencia</h3>
                                <p className="mt-1 text-sm text-muted">
                                    {detalle.documento.nombreOriginal} · {formatTamano(detalle.documento.tamanoBytes)}
                                </p>
                                {detalle.documento.eliminadoEn ? (
                                    <p className="mt-1 text-xs text-subtle">Documento purgado por retención; se conservan solo sus metadatos.</p>
                                ) : (
                                    <a
                                        href={`/api/admin/comite/apelaciones/${detalle.apelacion.id}/documento`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-block text-sm font-semibold text-accent hover:underline"
                                    >
                                        Descargar evidencia (PDF)
                                    </a>
                                )}
                                {detalle.documento.accesos.length > 0 && (
                                    <p className="mt-2 text-xs text-subtle">
                                        Accesos registrados: {detalle.documento.accesos.length}
                                    </p>
                                )}
                            </div>
                        )}

                        {detalle.apelacion.estado === "RECIBIDA" && (
                            <Button onClick={() => tomar(detalle.apelacion.id)} className="w-full sm:w-auto">
                                Tomar caso
                            </Button>
                        )}

                        {(detalle.apelacion.estado === "ACEPTADA" || detalle.apelacion.estado === "RECHAZADA") && (
                            <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
                                <p className="font-semibold text-body">Decisión: {ESTADO_LABEL[detalle.apelacion.estado]}</p>
                                {detalle.apelacion.quitoVisibilidad && (
                                    <p className="text-xs text-muted">Se quitó la visibilidad pública del identificador.</p>
                                )}
                                <p className="mt-1 whitespace-pre-wrap text-muted">{detalle.apelacion.motivacionResolucion}</p>
                            </div>
                        )}

                        {detalle.apelacion.estado === "EN_REVISION" && (
                            <form onSubmit={resolver} className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                                <h3 className="text-sm font-semibold text-body">Resolver el caso</h3>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm text-body">
                                        <input type="radio" name="decision" checked={decision === "ACEPTADA"} onChange={() => setDecision("ACEPTADA")} />
                                        Aceptar
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-body">
                                        <input type="radio" name="decision" checked={decision === "RECHAZADA"} onChange={() => setDecision("RECHAZADA")} />
                                        Rechazar
                                    </label>
                                </div>

                                {decision === "ACEPTADA" && (
                                    <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/40">
                                        <label className="flex items-center gap-2 text-sm text-body">
                                            <input
                                                type="checkbox"
                                                checked={quitarVisibilidad}
                                                onChange={(e) => setQuitarVisibilidad(e.target.checked)}
                                                className="h-4 w-4"
                                            />
                                            Quitar la visibilidad pública del identificador
                                        </label>
                                        {detalle.reportes.filter((r) => !r.eliminado).length > 0 && (
                                            <div>
                                                <p className="mb-2 text-sm font-medium text-body">Dar de baja reportes por falsos:</p>
                                                <div className="space-y-2">
                                                    {detalle.reportes
                                                        .filter((r) => !r.eliminado)
                                                        .map((r) => (
                                                            <label key={r.id} className="flex items-start gap-2 text-sm text-muted">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={reportesABajar.has(r.id)}
                                                                    onChange={() => toggleReporte(r.id)}
                                                                    className="mt-0.5 h-4 w-4"
                                                                />
                                                                <span>
                                                                    <span className="text-body">{r.categoria || r.estado}</span>
                                                                    <span className="block text-xs">
                                                                        {r.ciudad}, {r.pais} · {formatFecha(r.creadoEn)}
                                                                    </span>
                                                                </span>
                                                            </label>
                                                        ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="comite-motivacion" className="mb-1 block text-sm font-medium text-body">
                                        Motivación escrita (obligatoria)
                                    </label>
                                    <textarea
                                        id="comite-motivacion"
                                        required
                                        rows={3}
                                        maxLength={4000}
                                        value={motivacion}
                                        onChange={(e) => setMotivacion(e.target.value)}
                                        className="glass-input w-full rounded-xl px-3 py-2 text-sm text-body"
                                        placeholder="Fundamenta la decisión; la verá el apelante."
                                    />
                                </div>

                                <Button type="submit" isLoading={enviando} className="w-full sm:w-auto">
                                    Resolver apelación
                                </Button>
                            </form>
                        )}

                        {detalle.reportes.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-body">
                                    Reportes del identificador ({detalle.reportes.length})
                                </h3>
                                <div className="mt-2 space-y-2">
                                    {detalle.reportes.map((r) => (
                                        <div key={r.id} className="rounded-xl border border-slate-100 p-3 text-sm dark:border-slate-800">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-body">{r.categoria || r.estado}</span>
                                                {r.eliminado && <Badge variant="neutral">Dado de baja</Badge>}
                                                <span className="text-xs text-subtle">
                                                    {r.ciudad}, {r.pais} · {formatFecha(r.creadoEn)}
                                                </span>
                                            </div>
                                            <p className="mt-1 whitespace-pre-wrap text-muted">{r.texto}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </GlassCard>
            )}
        </div>
    );
}

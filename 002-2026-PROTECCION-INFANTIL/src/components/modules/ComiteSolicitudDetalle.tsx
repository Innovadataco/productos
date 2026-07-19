"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

type Solicitud = {
    id: string;
    numero: string;
    reporteId: string;
    estado: "PENDIENTE" | "ASIGNADA" | "RESUELTA";
    motivo: string;
    creadoEn: string;
    comiteId?: string | null;
};

type ReporteDetalle = {
    id: string;
    identificador: string;
    numeroSeguimiento: string;
    estado: string;
    texto: string;
    esAnonimo: boolean;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
    esRafaga: boolean;
    creadoEn: string;
    fechaIncidente: string;
    ciudad: string;
    pais: string;
    plataforma: { nombre: string; clave: string };
    clasificacion?: {
        categoria: string;
        confianza: number;
        modeloUsado: string;
        posibleAgresorPar: boolean;
        categoriasSecundarias: { categoria: string; score: number }[];
    } | null;
};

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

function formatCategoria(categoria: string) {
    return CATEGORIAS.find((c) => c.value === categoria)?.label || categoria;
}

export function ComiteSolicitudDetalle({
    solicitud,
    onClose,
    onRefresh,
}: {
    solicitud: Solicitud;
    onClose: () => void;
    onRefresh: () => void;
}) {
    const [reporte, setReporte] = useState<ReporteDetalle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [accion, setAccion] = useState<"CLASIFICAR" | "CORREGIR">("CLASIFICAR");
    const [categoria, setCategoria] = useState("");
    const [resolucion, setResolucion] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetch(`/api/admin/reportes-revision/${solicitud.reporteId}`, { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error("Error cargando reporte");
                return r.json();
            })
            .then((json) => {
                const data = json.reporte as ReporteDetalle;
                setReporte(data);
                setCategoria(data.clasificacion?.categoria || "");
            })
            .catch(() => setError("Error cargando reporte"))
            .finally(() => setLoading(false));
    }, [solicitud.reporteId]);

    const handleAsignar = async () => {
        setActionLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/admin/comite/${solicitud.id}/asignar`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || "Error");
            setSuccess("Solicitud asignada correctamente.");
            onRefresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error asignando");
        } finally {
            setActionLoading(false);
        }
    };

    const handleResolver = async () => {
        if (!categoria) {
            setError("Seleccione una categoría.");
            return;
        }
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/comite/${solicitud.id}/resolver`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accion, categoria, resolucion }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || "Error");
            setSuccess(`Solicitud resuelta. El reporte pasó a ${json.reporte.estado}.`);
            onRefresh();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Error resolviendo");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl glass-strong p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-body">Solicitud {solicitud.numero}</h2>
                    <Button onClick={onClose} variant="outline">Cerrar</Button>
                </div>

                {error && <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-red-700 dark:text-red-300">{error}</div>}
                {success && <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-green-700 dark:text-green-300">{success}</div>}

                <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <p><span className="text-subtle">Estado:</span> {solicitud.estado}</p>
                    <p><span className="text-subtle">Motivo del escalamiento:</span></p>
                    <p className="whitespace-pre-wrap">{solicitud.motivo}</p>
                </div>

                {loading ? (
                    <p className="text-subtle">Cargando reporte...</p>
                ) : !reporte ? (
                    <p className="text-red-600">No se pudo cargar el reporte.</p>
                ) : (
                    <div className="space-y-4 text-sm text-body">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="font-medium text-subtle">Número de seguimiento</span>
                                <p>{reporte.numeroSeguimiento}</p>
                            </div>
                            <div>
                                <span className="font-medium text-subtle">Estado</span>
                                <p>{reporte.estado}</p>
                            </div>
                            <div>
                                <span className="font-medium text-subtle">Plataforma</span>
                                <p>{reporte.plataforma.nombre}</p>
                            </div>
                            <div>
                                <span className="font-medium text-subtle">Identificador</span>
                                <p>{reporte.identificador}</p>
                            </div>
                            <div>
                                <span className="font-medium text-subtle">Origen</span>
                                <p>{reporte.esAnonimo ? "Anónimo" : "Autenticado"}</p>
                            </div>
                            <div>
                                <span className="font-medium text-subtle">Recibido</span>
                                <p>{new Date(reporte.creadoEn).toLocaleString()}</p>
                            </div>
                        </div>

                        {reporte.clasificacion && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                <h3 className="mb-2 font-medium text-body">Clasificación IA</h3>
                                <p><span className="text-subtle">Categoría:</span> {formatCategoria(reporte.clasificacion.categoria)}</p>
                                <p><span className="text-subtle">Confianza:</span> {(reporte.clasificacion.confianza * 100).toFixed(1)}%</p>
                                <p><span className="text-subtle">Modelo:</span> {reporte.clasificacion.modeloUsado}</p>
                            </div>
                        )}

                        <div>
                            <h3 className="mb-1 font-medium text-body">Texto</h3>
                            <p className="whitespace-pre-wrap rounded-lg glass-input p-3">{reporte.texto}</p>
                        </div>

                        {solicitud.estado === "PENDIENTE" && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                <h3 className="mb-2 font-medium text-body">Asignar solicitud</h3>
                                <Button onClick={handleAsignar} disabled={actionLoading}>
                                    {actionLoading ? "Asignando..." : "Asignarme esta solicitud"}
                                </Button>
                            </div>
                        )}

                        {solicitud.estado === "ASIGNADA" && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                <h3 className="mb-2 font-medium text-body">Resolver solicitud</h3>
                                <div className="mb-2 flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="accion"
                                            value="CLASIFICAR"
                                            checked={accion === "CLASIFICAR"}
                                            onChange={(e) => setAccion(e.target.value as "CLASIFICAR" | "CORREGIR")}
                                        />
                                        Clasificar
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="accion"
                                            value="CORREGIR"
                                            checked={accion === "CORREGIR"}
                                            onChange={(e) => setAccion(e.target.value as "CLASIFICAR" | "CORREGIR")}
                                        />
                                        Corregir
                                    </label>
                                </div>
                                <select
                                    className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                    value={categoria}
                                    onChange={(e) => setCategoria(e.target.value)}
                                >
                                    <option value="">Seleccionar categoría</option>
                                    {CATEGORIAS.map((c) => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <textarea
                                    className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                    rows={3}
                                    placeholder="Resolución / motivo (opcional)"
                                    value={resolucion}
                                    onChange={(e) => setResolucion(e.target.value)}
                                />
                                <Button onClick={handleResolver} disabled={actionLoading}>
                                    {actionLoading ? "Resolviendo..." : "Resolver"}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

type DetalleReporte = {
    id: string;
    identificador: string;
    plataforma: { nombre: string; clave: string };
    texto: string;
    textoOriginal: string | null;
    estado: string;
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    esAnonimo: boolean;
    numeroSeguimiento: string;
    creadoEn: string;
    clasificacion?: {
        categoria: string;
        confianza: number;
        contienePii: boolean;
        piiDetectada: string[];
        modeloUsado: string;
        latenciaMs: number;
        correccion: {
            categoriaCorregida: string;
            categoriaOriginal: string;
            motivo: string | null;
            creadoEn: string;
        } | null;
    } | null;
};

const CATEGORIAS = [
    { value: "CONTACTO_INSISTENTE", label: "Contacto insistente" },
    { value: "SOLICITUD_MATERIAL", label: "Solicitud de material" },
    { value: "OFRECIMIENTO_REGALOS", label: "Ofrecimiento de regalos" },
    { value: "SUPLANTACION_IDENTIDAD", label: "Suplantación de identidad" },
    { value: "SOLICITUD_ENCUENTRO", label: "Solicitud de encuentro" },
    { value: "COMPARTIMIENTO_SEXUAL", label: "Compartimiento sexual" },
    { value: "OTRO", label: "Otro" },
];

function formatCategoria(categoria: string) {
    return CATEGORIAS.find((c) => c.value === categoria)?.label || categoria;
}

function formatEstado(estado: string) {
    return estado.replace(/_/g, " ");
}

export function AdminReporteDetalle({
    reporteId,
    onClose,
    onRefresh,
}: {
    reporteId: string;
    onClose: () => void;
    onRefresh: () => void;
}) {
    const [reporte, setReporte] = useState<DetalleReporte | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [textoAnonimizado, setTextoAnonimizado] = useState("");
    const [categoriaCorreccion, setCategoriaCorreccion] = useState("");
    const [motivoCorreccion, setMotivoCorreccion] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!reporteId) return;
        setLoading(true);
        setError("");
        setSuccess("");
        fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error("Error cargando detalle");
                return r.json();
            })
            .then((json) => {
                const data: DetalleReporte = json.reporte || json;
                setReporte(data);
                setTextoAnonimizado(data.texto || "");
                setCategoriaCorreccion("");
                setMotivoCorreccion("");
            })
            .catch(() => setError("Error cargando detalle"))
            .finally(() => setLoading(false));
    }, [reporteId]);

    const handleAnonimizar = async () => {
        if (!textoAnonimizado || textoAnonimizado.length < 20 || textoAnonimizado.length > 5000) {
            setError("El texto anonimizado debe tener entre 20 y 5000 caracteres.");
            return;
        }
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/anonimizar`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ textoAnonimizado }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al anonimizar");
                return;
            }
            setSuccess("Reporte anonimizado correctamente.");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, {
                credentials: "include",
            });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
            }
        } catch {
            setError("Error al anonimizar");
        } finally {
            setActionLoading(false);
        }
    };

    const handleCorregir = async () => {
        if (!categoriaCorreccion) {
            setError("Selecciona una categoría de corrección.");
            return;
        }
        if (!reporte?.clasificacion) {
            setError("No hay clasificación para corregir.");
            return;
        }
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/correcciones`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reporteId,
                    categoriaCorregida: categoriaCorreccion,
                    comentario: motivoCorreccion,
                }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al corregir");
                return;
            }
            setSuccess("Clasificación corregida correctamente.");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, {
                credentials: "include",
            });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
            }
        } catch {
            setError("Error al corregir");
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <p className="text-slate-600">Cargando detalle...</p>
            </div>
        );
    }

    if (!reporte) {
        return (
            <div className="p-6">
                <p className="text-red-600">{error || "No se encontró el reporte."}</p>
                <div className="mt-4">
                    <Button onClick={onClose} variant="secondary">Cerrar</Button>
                </div>
            </div>
        );
    }

    const puedeAnonimizar = reporte.estado === "REQUIERE_ANONIMIZACION";
    const puedeCorregir = !!reporte.clasificacion && reporte.estado !== "CORREGIDO";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Detalle del reporte</h2>
                    <Button onClick={onClose} variant="secondary">Cerrar</Button>
                </div>

                {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</div>}
                {success && <div className="mb-4 rounded-lg bg-green-50 p-3 text-green-700">{success}</div>}

                <div className="space-y-4 text-sm text-slate-700">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="font-medium text-slate-500">Número de seguimiento</span>
                            <p>{reporte.numeroSeguimiento}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Estado</span>
                            <p>{formatEstado(reporte.estado)}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Plataforma</span>
                            <p>{reporte.plataforma.nombre}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Identificador</span>
                            <p>{reporte.identificador}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Ubicación</span>
                            <p>{reporte.ciudad}, {reporte.pais}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Fecha del incidente</span>
                            <p>{new Date(reporte.fechaIncidente).toLocaleDateString()}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Origen</span>
                            <p>{reporte.esAnonimo ? "Anónimo" : "Autenticado"}</p>
                        </div>
                        <div>
                            <span className="font-medium text-slate-500">Recibido</span>
                            <p>{new Date(reporte.creadoEn).toLocaleString()}</p>
                        </div>
                    </div>

                    {reporte.clasificacion && (
                        <div className="rounded-lg border border-slate-200 p-4">
                            <h3 className="mb-2 font-medium text-slate-900">Clasificación IA</h3>
                            <p><span className="text-slate-500">Categoría:</span> {formatCategoria(reporte.clasificacion.categoria)}</p>
                            <p><span className="text-slate-500">Confianza:</span> {(reporte.clasificacion.confianza * 100).toFixed(1)}%</p>
                            <p><span className="text-slate-500">Modelo:</span> {reporte.clasificacion.modeloUsado}</p>
                            {reporte.clasificacion.contienePii && (
                                <p className="text-amber-600">Contiene datos personales</p>
                            )}
                        </div>
                    )}

                    {reporte.clasificacion?.correccion && (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <h3 className="mb-2 font-medium text-blue-900">Corrección registrada</h3>
                            <p><span className="text-slate-500">Categoría original:</span> {formatCategoria(reporte.clasificacion.correccion.categoriaOriginal)}</p>
                            <p><span className="text-slate-500">Categoría corregida:</span> {formatCategoria(reporte.clasificacion.correccion.categoriaCorregida)}</p>
                            {reporte.clasificacion.correccion.motivo && <p><span className="text-slate-500">Motivo:</span> {reporte.clasificacion.correccion.motivo}</p>}
                        </div>
                    )}

                    <div>
                        <h3 className="mb-1 font-medium text-slate-900">Texto actual</h3>
                        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{reporte.texto}</p>
                    </div>

                    {reporte.textoOriginal && (
                        <div>
                            <h3 className="mb-1 font-medium text-red-700">Texto original (con PII — solo admin)</h3>
                            <p className="whitespace-pre-wrap rounded-lg bg-red-50 p-3">{reporte.textoOriginal}</p>
                        </div>
                    )}

                    {puedeCorregir && (
                        <div className="rounded-lg border border-slate-200 p-4">
                            <h3 className="mb-2 font-medium text-slate-900">Corregir clasificación</h3>
                            <select
                                className="mb-2 w-full rounded-lg border border-slate-300 p-2"
                                value={categoriaCorreccion}
                                onChange={(e) => setCategoriaCorreccion(e.target.value)}
                            >
                                <option value="">Seleccionar categoría</option>
                                {CATEGORIAS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            <textarea
                                className="mb-2 w-full rounded-lg border border-slate-300 p-2"
                                rows={2}
                                placeholder="Motivo de la corrección (opcional)"
                                value={motivoCorreccion}
                                onChange={(e) => setMotivoCorreccion(e.target.value)}
                            />
                            <Button onClick={handleCorregir} disabled={actionLoading}>
                                {actionLoading ? "Guardando..." : "Corregir clasificación"}
                            </Button>
                        </div>
                    )}

                    {puedeAnonimizar && (
                        <div className="rounded-lg border border-slate-200 p-4">
                            <h3 className="mb-2 font-medium text-slate-900">Anonimizar reporte</h3>
                            <textarea
                                className="mb-1 w-full rounded-lg border border-slate-300 p-2"
                                rows={6}
                                value={textoAnonimizado}
                                onChange={(e) => setTextoAnonimizado(e.target.value)}
                            />
                            <p className="mb-2 text-xs text-slate-500">
                                {textoAnonimizado.length} / 5000 caracteres (mínimo 20)
                            </p>
                            <Button onClick={handleAnonimizar} disabled={actionLoading}>
                                {actionLoading ? "Anonimizando..." : "Confirmar anonimización"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

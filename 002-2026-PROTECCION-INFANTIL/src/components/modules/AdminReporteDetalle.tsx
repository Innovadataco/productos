"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";

type DetalleReporte = {
    id: string;
    identificador: string;
    plataforma: { nombre: string; clave: string };
    texto: string;
    estado: string;
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    esAnonimo: boolean;
    numeroSeguimiento: string;
    creadoEn: string;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
    esRafaga: boolean;
    eliminado: boolean;
    motivoBaja: string | null;
    notaBaja: string | null;
    eliminadoEn: string | null;
    clasificacion?: {
        categoria: string;
        confianza: number;
        contienePii: boolean;
        piiDetectada: string[];
        modeloUsado: string;
        latenciaMs: number;
        categoriasSecundarias: { categoria: string; score: number }[];
        posibleAgresorPar: boolean;
        correccion: {
            categoriaCorregida: string;
            categoriaOriginal: string;
            motivo: string | null;
            creadoEn: string;
        } | null;
    } | null;
    reintentos?: {
        id: string;
        intento: number;
        exitoso: boolean;
        error: string | null;
        creadoEn: string;
    }[];
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [textoAnonimizado, setTextoAnonimizado] = useState("");
    const [categoriaCorreccion, setCategoriaCorreccion] = useState("");
    const [motivoCorreccion, setMotivoCorreccion] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [confirmando, setConfirmando] = useState(false);
    const [mostrarBaja, setMostrarBaja] = useState(false);
    const [motivoBaja, setMotivoBaja] = useState("");
    const [notaBaja, setNotaBaja] = useState("");
    const [mostrarReactivar, setMostrarReactivar] = useState(false);
    const [notaReactivar, setNotaReactivar] = useState("");
    const [puedeRevelarOriginal, setPuedeRevelarOriginal] = useState(false);
    const [textoOriginalRevelado, setTextoOriginalRevelado] = useState<string | null>(null);
    const [loadingRevelar, setLoadingRevelar] = useState(false);
    const [observacionesValidacion, setObservacionesValidacion] = useState("");
    const [validando, setValidando] = useState(false);
    const [puedeEscalar, setPuedeEscalar] = useState(false);
    const [mostrarEscalar, setMostrarEscalar] = useState(false);
    const [motivoEscalar, setMotivoEscalar] = useState("");

    useEffect(() => {
        if (!reporteId) return;
        setError("");
        setSuccess("");
        setCategoriaCorreccion("");
        setMotivoCorreccion("");
        setTextoOriginalRevelado(null);
        setPuedeRevelarOriginal(false);
        setObservacionesValidacion("");
        fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error("Error cargando detalle");
                return r.json();
            })
            .then((json) => {
                const data: DetalleReporte = json.reporte || json;
                setReporte(data);
                setPuedeRevelarOriginal(json.puedeRevelarOriginal === true);
                setPuedeEscalar(json.puedeEscalar === true);
                setTextoAnonimizado(data.texto || "");
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

    const handleConfirmar = async () => {
        if (!reporte?.clasificacion) {
            setError("No hay clasificación para confirmar.");
            return;
        }
        setConfirmando(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes-revision/${reporteId}/confirmar`, {
                method: "POST",
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al confirmar");
                return;
            }
            setSuccess("Clasificación confirmada correctamente.");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, {
                credentials: "include",
            });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
            }
        } catch {
            setError("Error al confirmar");
        } finally {
            setConfirmando(false);
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

    const handleBaja = async () => {
        if (!motivoBaja) {
            setError("Seleccioná un motivo de baja.");
            return;
        }
        if (!notaBaja || notaBaja.length < 1 || notaBaja.length > 2000) {
            setError("La nota de baja es obligatoria (máx. 2000 caracteres).");
            return;
        }
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/baja`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: motivoBaja, nota: notaBaja }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al dar de baja");
                return;
            }
            setSuccess("Reporte dado de baja correctamente.");
            setMostrarBaja(false);
            setMotivoBaja("");
            setNotaBaja("");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
            }
        } catch {
            setError("Error al dar de baja");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivar = async () => {
        if (!notaReactivar || notaReactivar.length < 1 || notaReactivar.length > 2000) {
            setError("La nota de reactivación es obligatoria (máx. 2000 caracteres).");
            return;
        }
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/reactivar`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nota: notaReactivar }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al reactivar");
                return;
            }
            setSuccess("Reporte reactivado correctamente. El embedding fue regenerado.");
            setMostrarReactivar(false);
            setNotaReactivar("");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
            }
        } catch {
            setError("Error al reactivar");
        } finally {
            setActionLoading(false);
        }
    };

    const handleRevelarOriginal = async () => {
        setLoadingRevelar(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/revelar-original`, {
                method: "POST",
                credentials: "include",
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al revelar original");
                return;
            }
            setTextoOriginalRevelado(json.textoOriginal || null);
        } catch {
            setError("Error al revelar original");
        } finally {
            setLoadingRevelar(false);
        }
    };

    const handleValidarAnonimizacion = async (valida: boolean) => {
        if (!reporte) return;
        setValidando(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/validar-anonimizacion`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valida, observaciones: observacionesValidacion }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al validar anonimización");
                return;
            }
            setSuccess(valida ? "Anonimización validada. El caso pasó a clasificado." : "Anonimización rechazada. Se registró para ajuste.");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
                setPuedeRevelarOriginal(data.puedeRevelarOriginal === true);
            }
        } catch {
            setError("Error al validar anonimización");
        } finally {
            setValidando(false);
        }
    };

    const handleEscalar = async () => {
        if (!motivoEscalar || motivoEscalar.length < 5 || motivoEscalar.length > 4000) {
            setError("El motivo debe tener entre 5 y 4000 caracteres.");
            return;
        }
        setActionLoading(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch(`/api/admin/reportes/${reporteId}/escalar`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: motivoEscalar }),
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error?.message || "Error al escalar");
                return;
            }
            setSuccess(`Caso escalado al comité. Solicitud ${json.numero}.`);
            setMostrarEscalar(false);
            setMotivoEscalar("");
            onRefresh();
            const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" });
            if (updated.ok) {
                const data = await updated.json();
                setReporte(data.reporte || data);
                setPuedeEscalar(data.puedeEscalar === true);
            }
        } catch {
            setError("Error al escalar");
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

    const estaEliminado = reporte.eliminado;
    const puedeAnonimizar = !estaEliminado && reporte.estado === "REQUIERE_ANONIMIZACION";
    const puedeCorregir = !estaEliminado && !!reporte.clasificacion && reporte.estado !== "CORREGIDO" && !reporte.clasificacion.correccion;
    const puedeConfirmar = !estaEliminado && reporte.estado === "REVISION_MANUAL" && !!reporte.clasificacion && !reporte.clasificacion.correccion;
    const puedeBaja = !estaEliminado;
    const puedeReactivar = estaEliminado;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl glass-strong p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-body">Detalle del reporte</h2>
                    <Button onClick={onClose} variant="secondary">Cerrar</Button>
                </div>

                {error && <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-red-700 dark:text-red-300">{error}</div>}
                {success && <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-950/30 p-3 text-green-700 dark:text-green-300">{success}</div>}

                {estaEliminado && (
                    <div className="mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                        <h3 className="mb-1 font-medium text-red-800 dark:text-red-300">Reporte dado de baja</h3>
                        <p><span className="text-subtle">Motivo:</span> {reporte.motivoBaja || "No especificado"}</p>
                        {reporte.notaBaja && <p><span className="text-subtle">Nota:</span> {reporte.notaBaja}</p>}
                        {reporte.eliminadoEn && <p><span className="text-subtle">Fecha:</span> {new Date(reporte.eliminadoEn).toLocaleString()}</p>}
                    </div>
                )}

                <div className="space-y-4 text-sm text-body">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="font-medium text-subtle">Número de seguimiento</span>
                            <p>{reporte.numeroSeguimiento}</p>
                        </div>
                        <div>
                            <span className="font-medium text-subtle">Estado</span>
                            <p>{formatEstado(reporte.estado)}</p>
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
                            <span className="font-medium text-subtle">Ubicación</span>
                            <p>{reporte.ciudad}, {reporte.pais}</p>
                        </div>
                        <div>
                            <span className="font-medium text-subtle">Fecha del incidente</span>
                            <p>{new Date(reporte.fechaIncidente).toLocaleDateString()}</p>
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
                            {reporte.clasificacion.posibleAgresorPar && (
                                <p className="text-blue-600 dark:text-blue-400">Posible agresor par / adolescente</p>
                            )}
                            {reporte.clasificacion.categoriasSecundarias && reporte.clasificacion.categoriasSecundarias.length > 0 && (
                                <div className="mt-2">
                                    <p className="text-subtle">Categorías secundarias:</p>
                                    <ul className="list-disc pl-5">
                                        {reporte.clasificacion.categoriasSecundarias.map((c) => (
                                            <li key={c.categoria}>
                                                {formatCategoria(c.categoria)} ({(c.score * 100).toFixed(1)}%)
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {reporte.clasificacion.contienePii && (
                                <p className="text-amber-600 dark:text-amber-400">Contiene datos personales</p>
                            )}
                        </div>
                    )}

                    {(reporte.prioridadAlta || reporte.esRafaga) && (
                        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                            <div className="flex flex-wrap gap-2 mb-2">
                                {reporte.prioridadAlta && (
                                    <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                                        Prioridad alta
                                    </span>
                                )}
                                {reporte.esRafaga && (
                                    <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                                        Ráfaga
                                    </span>
                                )}
                            </div>
                            {reporte.keywordsDetectadas && reporte.keywordsDetectadas.length > 0 && (
                                <p><span className="text-subtle">Términos detectados:</span> {reporte.keywordsDetectadas.join(", ")}</p>
                            )}
                        </div>
                    )}

                    {reporte.reintentos && reporte.reintentos.length > 0 && (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                            <h3 className="mb-2 font-medium text-body">Historial de intentos de procesamiento</h3>
                            <ul className="space-y-2 text-sm">
                                {reporte.reintentos.map((r) => (
                                    <li key={r.id} className="flex flex-col gap-1 rounded-md bg-slate-50 dark:bg-slate-900/40 p-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-subtle">Intento #{r.intento}</span>
                                            {r.exitoso ? (
                                                <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-300">
                                                    Éxito
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
                                                    Fallo
                                                </span>
                                            )}
                                        </div>
                                        {r.error && <p className="text-red-600 dark:text-red-400 text-xs">{r.error}</p>}
                                        <p className="text-xs text-subtle">{new Date(r.creadoEn).toLocaleString()}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {reporte.clasificacion?.correccion && (
                        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
                            <h3 className="mb-2 font-medium text-blue-900 dark:text-blue-300">Corrección registrada</h3>
                            <p><span className="text-subtle">Categoría original:</span> {formatCategoria(reporte.clasificacion.correccion.categoriaOriginal)}</p>
                            <p><span className="text-subtle">Categoría corregida:</span> {formatCategoria(reporte.clasificacion.correccion.categoriaCorregida)}</p>
                            {reporte.clasificacion.correccion.motivo && <p><span className="text-subtle">Motivo:</span> {reporte.clasificacion.correccion.motivo}</p>}
                        </div>
                    )}

                    <div>
                        <h3 className="mb-1 font-medium text-body">Texto actual</h3>
                        <p className="whitespace-pre-wrap rounded-lg glass-input p-3">{reporte.texto}</p>
                    </div>

                    {puedeRevelarOriginal && (
                        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
                            <h3 className="mb-2 font-medium text-red-800 dark:text-red-300">Texto original</h3>
                            <p className="mb-3 text-sm text-subtle">
                                Solo los administradores pueden revelar el texto original. El acceso queda auditado.
                            </p>
                            {textoOriginalRevelado !== null ? (
                                <p className="whitespace-pre-wrap rounded-lg bg-red-100 dark:bg-red-900/30 p-3 text-red-900 dark:text-red-200">
                                    {textoOriginalRevelado}
                                </p>
                            ) : (
                                <Button onClick={handleRevelarOriginal} disabled={loadingRevelar} variant="secondary">
                                    {loadingRevelar ? "Revelando..." : "Revelar original"}
                                </Button>
                            )}
                        </div>
                    )}

                    {puedeConfirmar && (
                        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
                            <h3 className="mb-2 font-medium text-body">Confirmar clasificación</h3>
                            <p className="mb-3 text-sm text-subtle">
                                La categoría sugerida por la IA es correcta. Esto registra una confirmación para las métricas de precisión.
                            </p>
                            <Button onClick={handleConfirmar} disabled={confirmando} variant="secondary">
                                {confirmando ? "Guardando..." : "Confirmar clasificación"}
                            </Button>
                        </div>
                    )}

                    {puedeCorregir && (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                            <h3 className="mb-2 font-medium text-body">Corregir clasificación</h3>
                            <select
                                data-testid="select-correccion-categoria"
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                value={categoriaCorreccion}
                                onChange={(e) => setCategoriaCorreccion(e.target.value)}
                            >
                                <option value="">Seleccionar categoría</option>
                                {CATEGORIAS.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            <textarea
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
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
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                            <h3 className="mb-2 font-medium text-body">Validar anonimización</h3>
                            <p className="mb-2 text-sm text-subtle">
                                Revisá el texto anonimizado. Si aún contiene datos personales, rechazalo y dejá una observación.
                            </p>
                            <textarea
                                className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                rows={2}
                                placeholder="Observaciones (opcional)"
                                value={observacionesValidacion}
                                onChange={(e) => setObservacionesValidacion(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <Button onClick={() => handleValidarAnonimizacion(true)} disabled={validando}>
                                    {validando ? "Validando..." : "Validar"}
                                </Button>
                                <Button onClick={() => handleValidarAnonimizacion(false)} disabled={validando} variant="secondary">
                                    {validando ? "Validando..." : "Rechazar"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {puedeAnonimizar && (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                            <h3 className="mb-2 font-medium text-body">Anonimizar reporte</h3>
                            <textarea
                                className="mb-1 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                rows={6}
                                value={textoAnonimizado}
                                onChange={(e) => setTextoAnonimizado(e.target.value)}
                            />
                            <p className="mb-2 text-xs text-subtle">
                                {textoAnonimizado.length} / 5000 caracteres (mínimo 20)
                            </p>
                            <Button onClick={handleAnonimizar} disabled={actionLoading}>
                                {actionLoading ? "Anonimizando..." : "Confirmar anonimización"}
                            </Button>
                        </div>
                    )}

                    {puedeEscalar && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                            {!mostrarEscalar ? (
                                <>
                                    <h3 className="mb-2 font-medium text-body">Escalar a comité</h3>
                                    <p className="mb-3 text-sm text-subtle">
                                        Solicitá una segunda opinión especializada del comité de validación.
                                    </p>
                                    <Button onClick={() => setMostrarEscalar(true)} variant="secondary" disabled={actionLoading}>
                                        Escalar a comité
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <h3 className="mb-2 font-medium text-body">Confirmar escalamiento</h3>
                                    <textarea
                                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                        rows={4}
                                        placeholder="Motivo del escalamiento (mín. 5 caracteres)"
                                        value={motivoEscalar}
                                        onChange={(e) => setMotivoEscalar(e.target.value)}
                                    />
                                    <p className="mb-2 text-xs text-subtle">
                                        {motivoEscalar.length} / 4000 caracteres
                                    </p>
                                    <div className="flex gap-2">
                                        <Button onClick={handleEscalar} disabled={actionLoading}>
                                            {actionLoading ? "Escalando..." : "Confirmar escalamiento"}
                                        </Button>
                                        <Button onClick={() => { setMostrarEscalar(false); setMotivoEscalar(""); }} variant="secondary" disabled={actionLoading}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {puedeBaja && (
                        <div className="rounded-lg border border-red-200 dark:border-red-800 p-4">
                            {!mostrarBaja ? (
                                <>
                                    <h3 className="mb-2 font-medium text-body">Dar de baja el reporte</h3>
                                    <p className="mb-3 text-sm text-subtle">
                                        Desactiva el reporte, borra su embedding y recalcula score/visibilidad. Opcionalmente purga el ejemplo del dataset RAG.
                                    </p>
                                    <Button onClick={() => setMostrarBaja(true)} variant="secondary" disabled={actionLoading}>
                                        Dar de baja
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <h3 className="mb-2 font-medium text-body">Confirmar baja</h3>
                                    <select
                                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                        value={motivoBaja}
                                        onChange={(e) => setMotivoBaja(e.target.value)}
                                    >
                                        <option value="">Seleccionar motivo</option>
                                        <option value="RETIRO_LIMPIEZA">Retiro por limpieza de datos</option>
                                        <option value="REPORTE_FALSO">Reporte falso</option>
                                        <option value="ORDEN_LEGAL">Orden legal</option>
                                    </select>
                                    <textarea
                                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                        rows={3}
                                        placeholder="Nota obligatoria (máx. 2000 caracteres)"
                                        value={notaBaja}
                                        onChange={(e) => setNotaBaja(e.target.value)}
                                    />
                                    <p className="mb-2 text-xs text-subtle">
                                        {notaBaja.length} / 2000 caracteres
                                    </p>
                                    <div className="flex gap-2">
                                        <Button onClick={handleBaja} disabled={actionLoading}>
                                            {actionLoading ? "Procesando..." : "Confirmar baja"}
                                        </Button>
                                        <Button onClick={() => { setMostrarBaja(false); setMotivoBaja(""); setNotaBaja(""); }} variant="secondary" disabled={actionLoading}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {puedeReactivar && (
                        <div className="rounded-lg border border-green-200 dark:border-green-800 p-4">
                            {!mostrarReactivar ? (
                                <>
                                    <h3 className="mb-2 font-medium text-body">Reactivar reporte</h3>
                                    <p className="mb-3 text-sm text-subtle">
                                        Deshace la baja, regenera el embedding vía Ollama y recalcula score/visibilidad. Si se purgó dataset, no se restaura.
                                    </p>
                                    <Button onClick={() => setMostrarReactivar(true)} variant="secondary" disabled={actionLoading}>
                                        Reactivar reporte
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <h3 className="mb-2 font-medium text-body">Confirmar reactivación</h3>
                                    <textarea
                                        className="mb-2 w-full rounded-lg glass-input ring-accent-input p-2 text-body"
                                        rows={3}
                                        placeholder="Nota obligatoria (máx. 2000 caracteres)"
                                        value={notaReactivar}
                                        onChange={(e) => setNotaReactivar(e.target.value)}
                                    />
                                    <p className="mb-2 text-xs text-subtle">
                                        {notaReactivar.length} / 2000 caracteres
                                    </p>
                                    <div className="flex gap-2">
                                        <Button onClick={handleReactivar} disabled={actionLoading}>
                                            {actionLoading ? "Procesando..." : "Confirmar reactivación"}
                                        </Button>
                                        <Button onClick={() => { setMostrarReactivar(false); setNotaReactivar(""); }} variant="secondary" disabled={actionLoading}>
                                            Cancelar
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

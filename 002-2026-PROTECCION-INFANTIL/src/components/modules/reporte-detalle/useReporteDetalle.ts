"use client";

import { useEffect, useState } from "react";
import type { DetalleReporte, UseReporteDetalleResult } from "./types";

export function useReporteDetalle(reporteId: string, onRefresh: () => void): UseReporteDetalleResult {
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
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!reporteId) return;
        setLoading(true);
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
            .catch(() => setError("No se pudo cargar el detalle del caso."))
            .finally(() => setLoading(false));
    }, [reporteId, retry]);

    async function reloadReporte() {
        const updated = await fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" });
        if (updated.ok) {
            const data = await updated.json();
            setReporte(data.reporte || data);
            setPuedeRevelarOriginal(data.puedeRevelarOriginal === true);
            setPuedeEscalar(data.puedeEscalar === true);
        }
    }

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
            await reloadReporte();
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
            await reloadReporte();
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
            await reloadReporte();
        } catch {
            setError("Error al corregir");
        } finally {
            setActionLoading(false);
        }
    };

    const handleBaja = async () => {
        if (!motivoBaja) {
            setError("Seleccione un motivo de baja.");
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
            await reloadReporte();
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
            await reloadReporte();
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
            await reloadReporte();
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
            await reloadReporte();
        } catch {
            setError("Error al escalar");
        } finally {
            setActionLoading(false);
        }
    };

    return {
        reporte,
        loading,
        error,
        success,
        textoAnonimizado,
        setTextoAnonimizado,
        categoriaCorreccion,
        setCategoriaCorreccion,
        motivoCorreccion,
        setMotivoCorreccion,
        actionLoading,
        confirmando,
        mostrarBaja,
        setMostrarBaja,
        motivoBaja,
        setMotivoBaja,
        notaBaja,
        setNotaBaja,
        mostrarReactivar,
        setMostrarReactivar,
        notaReactivar,
        setNotaReactivar,
        puedeRevelarOriginal,
        textoOriginalRevelado,
        loadingRevelar,
        observacionesValidacion,
        setObservacionesValidacion,
        validando,
        puedeEscalar,
        mostrarEscalar,
        setMostrarEscalar,
        motivoEscalar,
        setMotivoEscalar,
        handleAnonimizar,
        handleConfirmar,
        handleCorregir,
        handleBaja,
        handleReactivar,
        handleRevelarOriginal,
        handleValidarAnonimizacion,
        handleEscalar,
        retry,
        setRetry,
    };
}

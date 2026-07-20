"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useReporteDetalle } from "./reporte-detalle/useReporteDetalle";
import { ReporteDetalleHeader } from "./reporte-detalle/ReporteDetalleHeader";
import { ReporteDetalleInfo } from "./reporte-detalle/ReporteDetalleInfo";
import { TextoOriginalPanel } from "./reporte-detalle/TextoOriginalPanel";
import { AccionesReporte } from "./reporte-detalle/AccionesReporte";

interface AdminReporteDetalleProps {
    reporteId: string;
    onClose: () => void;
    onRefresh: () => void;
}

export function AdminReporteDetalle({ reporteId, onClose, onRefresh }: AdminReporteDetalleProps) {
    const {
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
    } = useReporteDetalle(reporteId, onRefresh);

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
                <ErrorState
                    title="No se encontró el reporte"
                    description={error || "El reporte solicitado no existe o no se pudo cargar."}
                    onRetry={() => setRetry((r: number) => r + 1)}
                />
                <div className="mt-4">
                    <Button onClick={onClose} variant="secondary">Cerrar</Button>
                </div>
            </div>
        );
    }

    const estaEliminado = reporte.eliminado;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl glass-strong p-6 shadow-xl">
                <ReporteDetalleHeader onClose={onClose} />

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

                <div className="space-y-4">
                    <ReporteDetalleInfo reporte={reporte} />

                    <TextoOriginalPanel
                        puedeRevelarOriginal={puedeRevelarOriginal}
                        textoOriginalRevelado={textoOriginalRevelado}
                        loadingRevelar={loadingRevelar}
                        onRevelar={handleRevelarOriginal}
                    />

                    <AccionesReporte
                        reporte={reporte}
                        puedeEscalarProp={puedeEscalar}
                        textoAnonimizado={textoAnonimizado}
                        setTextoAnonimizado={setTextoAnonimizado}
                        categoriaCorreccion={categoriaCorreccion}
                        setCategoriaCorreccion={setCategoriaCorreccion}
                        motivoCorreccion={motivoCorreccion}
                        setMotivoCorreccion={setMotivoCorreccion}
                        actionLoading={actionLoading}
                        confirmando={confirmando}
                        mostrarBaja={mostrarBaja}
                        setMostrarBaja={setMostrarBaja}
                        motivoBaja={motivoBaja}
                        setMotivoBaja={setMotivoBaja}
                        notaBaja={notaBaja}
                        setNotaBaja={setNotaBaja}
                        mostrarReactivar={mostrarReactivar}
                        setMostrarReactivar={setMostrarReactivar}
                        notaReactivar={notaReactivar}
                        setNotaReactivar={setNotaReactivar}
                        observacionesValidacion={observacionesValidacion}
                        setObservacionesValidacion={setObservacionesValidacion}
                        validando={validando}
                        mostrarEscalar={mostrarEscalar}
                        setMostrarEscalar={setMostrarEscalar}
                        motivoEscalar={motivoEscalar}
                        setMotivoEscalar={setMotivoEscalar}
                        handleAnonimizar={handleAnonimizar}
                        handleConfirmar={handleConfirmar}
                        handleCorregir={handleCorregir}
                        handleBaja={handleBaja}
                        handleReactivar={handleReactivar}
                        handleValidarAnonimizacion={handleValidarAnonimizacion}
                        handleEscalar={handleEscalar}
                    />
                </div>
            </div>
        </div>
    );
}

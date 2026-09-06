"use client";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Alerta } from "@/components/ui/Alerta";
import { Modal } from "@/components/ui/Modal";
import { useReporteDetalle } from "./reporte-detalle/useReporteDetalle";
import { ReporteDetalleInfo } from "./reporte-detalle/ReporteDetalleInfo";
import { TextoOriginalPanel } from "./reporte-detalle/TextoOriginalPanel";
import { AccionesReporte } from "./reporte-detalle/AccionesReporte";

interface AdminReporteDetalleProps {
    reporteId: string;
    onClose: () => void;
    onRefresh: () => void;
    inline?: boolean;
}

function AdminReporteDetalleContent({ reporteId, onClose, onRefresh }: Omit<AdminReporteDetalleProps, "inline">) {
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
                <p className="text-muted">Cargando detalle...</p>
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
        <div className="space-y-4">
            {error && <Alerta tono="error" className="mb-4">{error}</Alerta>}
            {success && <Alerta tono="exito" role="status" className="mb-4">{success}</Alerta>}

            {estaEliminado && (
                <Alerta tono="error" className="mb-4 border border-rubi/30 p-4">
                    <h3 className="mb-1 font-medium">Reporte dado de baja</h3>
                    <p><span className="text-subtle">Motivo:</span> {reporte.motivoBaja || "No especificado"}</p>
                    {reporte.notaBaja && <p><span className="text-subtle">Nota:</span> {reporte.notaBaja}</p>}
                    {reporte.eliminadoEn && <p><span className="text-subtle">Fecha:</span> {new Date(reporte.eliminadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</p>}
                </Alerta>
            )}

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
    );
}

export function AdminReporteDetalle({ reporteId, onClose, onRefresh, inline }: AdminReporteDetalleProps) {
    if (inline) {
        return <AdminReporteDetalleContent reporteId={reporteId} onClose={onClose} onRefresh={onRefresh} />;
    }

    return (
        <Modal isOpen onClose={onClose} title="Detalle del reporte">
            <AdminReporteDetalleContent reporteId={reporteId} onClose={onClose} onRefresh={onRefresh} />
        </Modal>
    );
}

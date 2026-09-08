"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Alerta } from "@/components/ui/Alerta";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { ReporteDetalleInfo } from "./ReporteDetalleInfo";
import type { DetalleReporte } from "./types";

interface ReporteDetalleSoloLecturaProps {
    reporteId: string;
    onClose: () => void;
}

/**
 * SPEC-595: vista de detalle SOLO LECTURA para la sección «Procesados» de la
 * bandeja. Reutiliza `ReporteDetalleInfo` (la misma estructura de campos del
 * detalle editable) pero omite el revelado del original, el historial de
 * accesos y todas las acciones — un caso procesado se consulta, no se toca.
 * El fetch es propio y de solo lectura; no usa `useReporteDetalle` para no
 * arrastrar estado de acciones que esta vista nunca ejecuta (zona SPEC-592/594).
 */
export function ReporteDetalleSoloLectura({ reporteId, onClose }: ReporteDetalleSoloLecturaProps) {
    const [reporte, setReporte] = useState<DetalleReporte | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let cancelado = false;
        setLoading(true);
        setError("");
        fetch(`/api/admin/reportes-revision/${reporteId}`, { credentials: "include" })
            .then(async (r) => {
                if (!r.ok) throw new Error("Error cargando detalle");
                return r.json();
            })
            .then((json: { reporte?: DetalleReporte }) => {
                if (cancelado) return;
                setReporte(json.reporte ?? null);
            })
            .catch(() => {
                if (!cancelado) setError("No se pudo cargar el detalle del caso.");
            })
            .finally(() => {
                if (!cancelado) setLoading(false);
            });
        return () => {
            cancelado = true;
        };
    }, [reporteId, retry]);

    return (
        <Modal isOpen onClose={onClose} title="Detalle del reporte — solo visualización">
            <Alerta tono="info" className="mb-4">
                Este caso ya fue procesado. Esta vista es de solo consulta: no permite clasificar, corregir ni modificar.
            </Alerta>

            {loading ? (
                <div className="p-6">
                    <p className="text-muted">Cargando detalle...</p>
                </div>
            ) : !reporte ? (
                <div className="p-6">
                    <ErrorState
                        title="No se encontró el reporte"
                        description={error || "El reporte solicitado no existe o no se pudo cargar."}
                        onRetry={() => setRetry((r) => r + 1)}
                    />
                    <div className="mt-4">
                        <Button onClick={onClose} variant="secondary">Cerrar</Button>
                    </div>
                </div>
            ) : (
                <ReporteDetalleInfo reporte={reporte} />
            )}
        </Modal>
    );
}

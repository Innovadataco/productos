"use client";

import { Button } from "@/components/ui/Button";

interface ReporteDetalleHeaderProps {
    onClose: () => void;
}

export function ReporteDetalleHeader({ onClose }: ReporteDetalleHeaderProps) {
    return (
        <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-body">Detalle del reporte</h2>
            <Button onClick={onClose} variant="secondary">Cerrar</Button>
        </div>
    );
}

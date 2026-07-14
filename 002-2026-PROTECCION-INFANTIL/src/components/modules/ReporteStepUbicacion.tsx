"use client";

import { Input } from "@/components/ui/Input";

export function ReporteStepUbicacion({
    ciudad,
    pais,
    fechaIncidente,
    onChange,
}: {
    ciudad: string;
    pais: string;
    fechaIncidente: string;
    onChange: (v: { ciudad: string; pais: string; fechaIncidente: string }) => void;
}) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">¿Dónde y cuándo ocurrió?</h2>
            <Input
                label="Ciudad"
                placeholder="Ej: Bogotá"
                value={ciudad}
                onChange={(e) => onChange({ ciudad: e.target.value, pais, fechaIncidente })}
            />
            <Input
                label="País"
                placeholder="Ej: Colombia"
                value={pais}
                onChange={(e) => onChange({ ciudad, pais: e.target.value, fechaIncidente })}
            />
            <Input
                label="Fecha del incidente"
                type="date"
                value={fechaIncidente}
                onChange={(e) => onChange({ ciudad, pais, fechaIncidente: e.target.value })}
            />
        </div>
    );
}
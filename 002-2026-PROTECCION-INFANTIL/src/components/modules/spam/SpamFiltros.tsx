"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

const ESTADOS_SPAM = [
    { value: "", label: "Todos los estados" },
    { value: "POSIBLE_SPAM", label: "Posible spam" },
    { value: "REVISION_MANUAL", label: "Revisión manual" },
];

const ORDENES = [
    { value: "prioridad", label: "Prioridad" },
    { value: "recientes", label: "Más recientes" },
    { value: "antiguos", label: "Más antiguos" },
];

interface SpamFiltrosProps {
    q: string;
    setQ: (value: string) => void;
    estado: string;
    setEstado: (value: string) => void;
    orden: string;
    setOrden: (value: string) => void;
    onApply: () => void;
    onOrdenChange: (nuevoOrden: string) => void;
}

export function SpamFiltros({
    q,
    setQ,
    estado,
    setEstado,
    orden,
    setOrden,
    onApply,
    onOrdenChange,
}: SpamFiltrosProps) {
    return (
        <div className="glass rounded-2xl p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="lg:col-span-2">
                    <Input
                        label="Buscar"
                        type="text"
                        placeholder="RPT-XXXX o identificador/nick"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                onApply();
                            }
                        }}
                    />
                </div>
                <Select label="Estado" options={ESTADOS_SPAM} value={estado} onChange={(e) => setEstado(e.target.value)} />
                <Select
                    label="Ordenar por"
                    options={ORDENES}
                    value={orden}
                    onChange={(e) => {
                        setOrden(e.target.value);
                        onOrdenChange(e.target.value);
                    }}
                />
                <div className="flex items-end">
                    <Button onClick={onApply}>Aplicar filtros</Button>
                </div>
            </div>
        </div>
    );
}

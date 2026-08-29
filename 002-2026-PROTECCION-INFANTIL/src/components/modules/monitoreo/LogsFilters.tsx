"use client";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type LogsFiltersState = {
    servicio: string;
    nivel: string;
    desde: string;
    hasta: string;
    q: string;
};

type LogsFiltersProps = {
    filters: LogsFiltersState;
    onChange: (filters: LogsFiltersState) => void;
};

const SERVICIOS = [
    { value: "", label: "Todos los servicios" },
    { value: "pi-app", label: "pi-app" },
    { value: "pi-worker", label: "pi-worker" },
    { value: "pi-monitor", label: "pi-monitor" },
    { value: "pi-simulador-abuso", label: "pi-simulador-abuso" },
];

const NIVELES = [
    { value: "", label: "Todos los niveles" },
    { value: "DEBUG", label: "DEBUG" },
    { value: "INFO", label: "INFO" },
    { value: "WARN", label: "WARN" },
    { value: "ERROR", label: "ERROR" },
];

export function LogsFilters({ filters, onChange }: LogsFiltersProps) {
    const update = (patch: Partial<LogsFiltersState>) => {
        onChange({ ...filters, ...patch });
    };

    return (
        <div className="flex flex-col gap-3 rounded-2xl glass p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-auto sm:min-w-[180px]">
                <Select
                    label="Servicio"
                    options={SERVICIOS}
                    value={filters.servicio}
                    onChange={(e) => update({ servicio: e.target.value })}
                />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[160px]">
                <Select
                    label="Nivel"
                    options={NIVELES}
                    value={filters.nivel}
                    onChange={(e) => update({ nivel: e.target.value })}
                />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[220px]">
                <Input
                    label="Desde"
                    type="datetime-local"
                    value={filters.desde}
                    onChange={(e) => update({ desde: e.target.value })}
                />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[220px]">
                <Input
                    label="Hasta"
                    type="datetime-local"
                    value={filters.hasta}
                    onChange={(e) => update({ hasta: e.target.value })}
                />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[260px]">
                <Input
                    label="Buscar"
                    type="text"
                    placeholder="Mensaje o contexto"
                    value={filters.q}
                    onChange={(e) => update({ q: e.target.value })}
                />
            </div>
            <div className="w-full sm:w-auto">
                <Button onClick={() => onChange({ ...filters })} className="w-full sm:w-auto">
                    Aplicar
                </Button>
            </div>
        </div>
    );
}

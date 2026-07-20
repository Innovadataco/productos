import { Button } from "@/components/ui/Button";
import type { Param } from "./types";

interface ParamInputProps {
    param: Param;
    value: string;
    revealed: boolean;
    onChange: (value: string) => void;
    onReveal: () => void;
}

export function ChevronIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

export function ParamInput({ param, value, revealed, onChange, onReveal }: ParamInputProps) {
    if (param.tipo === "BOOLEAN") {
        return (
            <div className="relative">
                <select
                    value={value ?? param.valor}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm text-body outline-none transition glass-input ring-accent-input appearance-none pr-10"
                >
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle">
                    <ChevronIcon className="h-4 w-4" />
                </span>
            </div>
        );
    }

    if (param.tipo === "INTEGER" || param.tipo === "FLOAT") {
        return (
            <input
                type="number"
                step={param.tipo === "FLOAT" ? "0.01" : "1"}
                value={value ?? param.valor}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm text-body outline-none transition glass-input ring-accent-input"
            />
        );
    }

    return (
        <div className="flex items-center gap-2">
            <input
                type={param.esSecreto && !revealed ? "password" : "text"}
                value={value ?? ""}
                placeholder={param.esSecreto ? "•••••••• (ingresar nuevo valor)" : ""}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm text-body outline-none transition glass-input ring-accent-input"
            />
            {param.esSecreto && (
                <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 px-2 py-2 text-xs"
                    onClick={onReveal}
                    title={revealed ? "Ocultar" : "Revelar"}
                >
                    {revealed ? "Ocultar" : "Revelar"}
                </Button>
            )}
        </div>
    );
}

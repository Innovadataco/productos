import { Button } from "@/components/ui/Button";
import { ParamInput } from "./ParamInput";
import type { Param } from "./types";

interface ParamRowProps {
    param: Param;
    value: string;
    revealed: boolean;
    message: { type: "success" | "error"; text: string } | null;
    saving: boolean;
    onChange: (value: string) => void;
    onSave: () => void;
    onReveal: () => void;
}

export function ParamRow({ param, value, revealed, message, saving, onChange, onSave, onReveal }: ParamRowProps) {
    const disabled = saving || (param.esSecreto ? value === "" : value === param.valor);

    return (
        <div className="py-4 first:pt-0 last:pb-0">
            <div className="grid gap-4 sm:grid-cols-[1fr,280px,120px]">
                <div>
                    <label className="block text-sm font-medium text-body">{param.clave}</label>
                    <p className="mt-0.5 text-xs text-muted">{param.descripcion || "Sin descripción"}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-subtle">
                        <span>{param.tipo}</span>
                        <span>•</span>
                        <span>{param.categoria}</span>
                        {param.esPublico && <span className="text-accent">Público</span>}
                    </div>
                </div>

                <ParamInput
                    param={param}
                    value={value}
                    revealed={revealed}
                    onChange={onChange}
                    onReveal={onReveal}
                />

                <div className="flex items-start gap-2">
                    <Button
                        onClick={onSave}
                        isLoading={saving}
                        disabled={disabled}
                        variant="outline"
                        className="w-full py-2 px-3 text-xs"
                    >
                        Guardar
                    </Button>
                </div>
            </div>

            {message && (
                <div
                    className={`mt-2 rounded-lg px-3 py-1.5 text-xs ${
                        message.type === "error"
                            ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    }`}
                >
                    {message.text}
                </div>
            )}
        </div>
    );
}

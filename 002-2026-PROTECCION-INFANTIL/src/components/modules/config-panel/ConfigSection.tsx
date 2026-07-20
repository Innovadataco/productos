import { Button } from "@/components/ui/Button";
import { ParamRow } from "./ParamRow";
import type { Param } from "./types";

interface ConfigSectionProps {
    section: { key: string; label: string; description: string };
    items: Param[];
    editValues: Record<string, string>;
    revealed: Record<string, boolean>;
    messages: Record<string, { type: "success" | "error"; text: string } | null>;
    saving: Record<string, boolean>;
    onUpdate: (clave: string, value: string) => void;
    onSave: (clave: string) => void;
    onReveal: (clave: string) => void;
    onSaveSection: (sectionKey: string) => void;
}

export function ConfigSection({
    section,
    items,
    editValues,
    revealed,
    messages,
    saving,
    onUpdate,
    onSave,
    onReveal,
    onSaveSection,
}: ConfigSectionProps) {
    if (items.length === 0) return null;

    const hasUnsaved = items.some((p) => !p.esSecreto && editValues[p.clave] !== (p.valor ?? ""));

    return (
        <section key={section.key} className="glass rounded-2xl p-5 sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-semibold text-body">{section.label}</h2>
                    <p className="text-sm text-muted">{section.description}</p>
                    {hasUnsaved && <p className="mt-1 text-xs text-amber-600 dark:text-amber-300">Cambios sin guardar</p>}
                </div>
                <Button
                    onClick={() => onSaveSection(section.key)}
                    isLoading={saving[section.key]}
                    disabled={saving[section.key]}
                >
                    Guardar cambios
                </Button>
            </div>

            {messages[section.key] && (
                <div
                    className={`mb-4 rounded-lg px-4 py-2 text-sm ${
                        messages[section.key]!.type === "error"
                            ? "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
                            : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200"
                    }`}
                >
                    {messages[section.key]!.text}
                </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items
                    .filter((p) => p.clave !== "ui.grupos_categoria")
                    .map((p) => (
                        <ParamRow
                            key={p.id}
                            param={p}
                            value={editValues[p.clave]}
                            revealed={!!revealed[p.clave]}
                            message={messages[p.clave] || null}
                            saving={!!saving[p.clave]}
                            onChange={(value) => onUpdate(p.clave, value)}
                            onSave={() => onSave(p.clave)}
                            onReveal={() => onReveal(p.clave)}
                        />
                    ))}
            </div>
        </section>
    );
}

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AUDIT_ACTION_GROUPS, labelAccionAudit } from "@/lib/audit-actions";
import type { AccionAudit } from "@prisma/client";
import type { Filters } from "./types";

interface AuditFiltersProps {
    filters: Filters;
    defaultActions?: AccionAudit[];
    onApply: (next: Partial<Filters>) => void;
    onReset: () => void;
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
    return (
        <svg
            className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
    );
}

export function AuditFilters({ filters, defaultActions, onApply, onReset }: AuditFiltersProps) {
    const allActionValues = AUDIT_ACTION_GROUPS.flatMap((group) => group.actions);

    const hasActiveFilters =
        filters.selectedActions.length > 0 ||
        filters.fechaDesde ||
        filters.fechaHasta ||
        filters.q.trim() ||
        filters.recursoId.trim();

    function toggleAction(action: AccionAudit) {
        const exists = filters.selectedActions.includes(action);
        const selected = exists
            ? filters.selectedActions.filter((a) => a !== action)
            : [...filters.selectedActions, action];
        onApply({ selectedActions: selected });
    }

    function toggleGroup(groupActions: AccionAudit[]) {
        const allSelected = groupActions.every((a) => filters.selectedActions.includes(a));
        const rest = filters.selectedActions.filter((a) => !groupActions.includes(a));
        onApply({ selectedActions: allSelected ? rest : [...rest, ...groupActions] });
    }

    return (
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
                <div>
                    <p className="mb-2 text-sm font-medium text-body">Tipo de acción</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {AUDIT_ACTION_GROUPS.map((group) => {
                            const groupSelected = group.actions.every((a) => filters.selectedActions.includes(a));
                            const groupPartial =
                                group.actions.some((a) => filters.selectedActions.includes(a)) && !groupSelected;
                            return (
                                <div
                                    key={group.key}
                                    className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                                >
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={groupSelected}
                                            ref={(el) => {
                                                if (el) el.indeterminate = groupPartial;
                                            }}
                                            onChange={() => toggleGroup(group.actions)}
                                            className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                                        />
                                        <span className="text-sm font-semibold text-body">{group.label}</span>
                                    </label>
                                    <div className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                                        {group.actions.map((action) => (
                                            <label
                                                key={action}
                                                className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-body"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={filters.selectedActions.includes(action)}
                                                    onChange={() => toggleAction(action)}
                                                    className="h-4 w-4 rounded border-slate-300 text-accent focus:ring-accent"
                                                />
                                                {labelAccionAudit(action)}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => onApply({ selectedActions: allActionValues })}
                            className="cursor-pointer text-xs text-accent hover:underline"
                        >
                            Seleccionar todas
                        </button>
                        <span className="text-xs text-muted">·</span>
                        <button
                            type="button"
                            onClick={() => onApply({ selectedActions: [] })}
                            className="cursor-pointer text-xs text-accent hover:underline"
                        >
                            Limpiar selección
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                    <Input
                        label="Fecha desde"
                        type="date"
                        value={filters.fechaDesde}
                        onChange={(e) => onApply({ fechaDesde: e.target.value })}
                    />
                    <Input
                        label="Fecha hasta"
                        type="date"
                        value={filters.fechaHasta}
                        onChange={(e) => onApply({ fechaHasta: e.target.value })}
                    />
                </div>
                <Input
                    label="Usuario (nombre o email)"
                    type="text"
                    placeholder="Buscar..."
                    value={filters.q}
                    onChange={(e) => onApply({ q: e.target.value })}
                />
                <Input
                    label="Recurso ID"
                    type="text"
                    placeholder="ID del recurso"
                    value={filters.recursoId}
                    onChange={(e) => onApply({ recursoId: e.target.value })}
                />
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={onReset}
                    disabled={!hasActiveFilters}
                >
                    Limpiar filtros
                </Button>
            </div>
        </div>
    );
}

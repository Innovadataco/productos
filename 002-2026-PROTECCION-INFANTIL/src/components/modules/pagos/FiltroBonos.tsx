"use client";

interface FiltroBonos {
    activo?: boolean | undefined;
    origen?: string | undefined;
    recompensaValue: string;
}

export function FiltroBonos({ activo, origen, recompensaValue }: FiltroBonos) {
    return (
        <form method="get" className="flex items-center gap-2">
            <input type="hidden" name="activo" value={activo?.toString() ?? ""} />
            <select
                name="origen"
                defaultValue={origen ?? ""}
                aria-label="Filtrar por origen"
                className="rounded-xl border border-tinta/10 bg-papel px-3 py-1.5 text-sm text-body dark:border-tinta/20"
                onChange={(e) => e.currentTarget.form?.submit()}
            >
                <option value="">Todos los orígenes</option>
                <option value={recompensaValue}>Recompensa por pago</option>
            </select>
        </form>
    );
}

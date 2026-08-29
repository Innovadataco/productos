"use client";

// SPEC-237 (002-PI-mega-cola): selector de guía de acción sugerida.
// Por defecto trae la categoría dominante (la resuelve el servidor); el
// comité puede cambiarla y el cambio se persiste al corregir/guardar.
import type { GuiaDisponibleDto } from "./tipos";

export function ConsolidacionGuiaAccion({
    guias,
    guiaSeleccionada,
    onCambiar,
    disabled,
}: {
    guias: GuiaDisponibleDto[];
    guiaSeleccionada: string | null;
    onCambiar: (guiaId: string) => void;
    disabled: boolean;
}) {
    return (
        <section className="glass rounded-2xl p-6 space-y-3">
            <h3 className="text-lg font-semibold text-body">Guía de acción sugerida</h3>
            {guias.length === 0 ? (
                <p className="text-sm text-muted">No hay guías de acción activas.</p>
            ) : (
                <select
                    aria-label="Guía de acción sugerida"
                    value={guiaSeleccionada ?? ""}
                    onChange={(e) => onCambiar(e.target.value)}
                    disabled={disabled}
                    className="w-full rounded-lg border border-tinta/15 bg-transparent px-3 py-2 text-sm text-body disabled:opacity-60"
                >
                    <option value="" disabled>
                        Selecciona una guía
                    </option>
                    {guias.map((g) => (
                        <option key={g.id} value={g.id}>
                            {g.nombre} ({g.categoria})
                        </option>
                    ))}
                </select>
            )}
            <p className="text-xs text-muted">
                Por defecto se sugiere la guía de la categoría dominante del expediente. El cambio se guarda con
                la acción Corregir.
            </p>
        </section>
    );
}

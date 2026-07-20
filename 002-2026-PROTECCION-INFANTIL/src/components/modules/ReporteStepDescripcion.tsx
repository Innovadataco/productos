"use client";

export function ReporteStepDescripcion({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const chars = value.length;
    const min = 20;
    const max = 5000;
    const isValid = chars >= min && chars <= max;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-body">Describe lo que ocurrió con tus palabras</h2>
            <div>
                <label className="block text-sm font-medium text-muted mb-1.5">
                    Descripción de lo que observaste
                </label>
                <textarea
                    className="w-full rounded-xl px-4 py-3 text-sm text-body placeholder-subtle outline-none transition min-h-[160px] resize-y glass-input ring-accent-input"
                    placeholder="Describe la conducta observada con el mayor detalle posible. Esto ayuda a entender la situación."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={max}
                />
                <div className="mt-1.5 flex justify-between text-xs">
                    <span className={isValid ? "text-subtle" : "text-red-600 dark:text-red-400"}>
                        {chars < min
                            ? `Mínimo ${min} caracteres (${chars}/${min})`
                            : chars > max
                                ? `Máximo ${max} caracteres`
                                : `${chars}/${max}`}
                    </span>
                </div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300">
                Este reporte es solo de texto. No incluyas fotos, videos ni archivos adjuntos.
            </div>
        </div>
    );
}

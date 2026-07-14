"use client";

export function ReporteStepDescripcion({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const chars = value.length;
    const min = 20;
    const max = 5000;
    const isValid = chars >= min && chars <= max;

    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Describe lo que ocurrió</h2>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Descripción de la conducta
                </label>
                <textarea
                    className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 min-h-[160px] resize-y"
                    placeholder="Describe la conducta observada con el mayor detalle posible..."
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={max}
                />
                <div className="mt-1.5 flex justify-between text-xs">
                    <span className={isValid ? "text-slate-500" : chars < min ? "text-red-600" : "text-red-600"}>
                        {chars < min
                            ? `Mínimo ${min} caracteres (${chars}/${min})`
                            : chars > max
                                ? `Máximo ${max} caracteres`
                                : `${chars}/${max}`}
                    </span>
                </div>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                No incluyas fotos, videos ni archivos. Este reporte es exclusivamente de texto.
            </div>
        </div>
    );
}
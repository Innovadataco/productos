export function Select({
    label,
    error,
    options,
    ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; options: { value: string; label: string }[] }) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {label}
                </label>
            )}
            <select
                className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200 appearance-none"
                {...props}
            >
                <option value="">Selecciona...</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        </div>
    );
}
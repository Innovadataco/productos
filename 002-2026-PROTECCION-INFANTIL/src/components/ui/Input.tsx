export function Input({
    label,
    error,
    ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {label}
                </label>
            )}
            <input
                className="w-full rounded-xl border border-slate-200 bg-white/60 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-200"
                {...props}
            />
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
        </div>
    );
}
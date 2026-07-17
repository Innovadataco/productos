interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    formatValue?: (value: number) => string;
}

export function Slider({ label, value, min, max, step, onChange, disabled, formatValue }: SliderProps) {
    const display = formatValue ? formatValue(value) : String(value);
    return (
        <div className={`space-y-2 ${disabled ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-body">{label}</label>
                <span className="text-sm font-semibold tabular-nums text-accent">{display}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full accent-sky-500 dark:accent-cyan-400 cursor-pointer disabled:cursor-not-allowed"
                aria-label={label}
            />
        </div>
    );
}

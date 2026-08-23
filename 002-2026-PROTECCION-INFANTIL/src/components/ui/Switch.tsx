"use client";

interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    ariaLabel?: string;
}

export function Switch({ checked, onChange, disabled, ariaLabel }: SwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pino focus-visible:ring-offset-2 focus-visible:ring-offset-papel ${
                checked ? "bg-pino" : "bg-tinta/20"
            } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    checked ? "translate-x-6" : "translate-x-1"
                }`}
            />
        </button>
    );
}

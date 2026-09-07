import { useId, forwardRef } from "react";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string | undefined;
    error?: string | undefined;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, id: externalId, className = "", ...props }, ref) => {
        const generatedId = useId();
        const id = externalId || generatedId;

        return (
            <div className="w-full">
                {label && (
                    <label htmlFor={id} className="block text-sm font-medium text-body mb-1.5">
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={id}
                    className={`w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input ${className}`}
                    aria-invalid={error ? "true" : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    {...props}
                />
                {/* SPEC-467 (extensión SPEC-577) · el error en token semántico: `rubi`
                    (criticidad), nunca rojo crudo. El token voltea solo en oscuro. */}
                {error && (
                    <p id={`${id}-error`} className="mt-1.5 text-sm text-rubi">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Textarea.displayName = "Textarea";

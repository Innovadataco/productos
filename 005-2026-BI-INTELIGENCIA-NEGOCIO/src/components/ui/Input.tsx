import { useId, forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
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
                <input
                    ref={ref}
                    id={id}
                    className={`w-full rounded-xl px-4 py-3 text-sm text-body placeholder:text-subtle outline-none transition glass-input ring-accent-input ${className}`}
                    aria-invalid={error ? "true" : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    {...props}
                />
                {error && (
                    <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

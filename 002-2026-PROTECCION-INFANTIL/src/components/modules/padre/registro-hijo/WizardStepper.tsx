"use client";

/**
 * SPEC-599 · WizardStepper — indicador de progreso del registro de hijo.
 * Cuatro pasos (bienvenida → datos → círculo → listo). Cada punto es un botón:
 * permite volver a un paso YA visitado, nunca saltar hacia adelante.
 * El paso activo lleva `aria-current="step"`; las líneas se llenan al avanzar.
 */

export const PASOS_WIZARD = ["Bienvenida", "Datos del hijo", "Tu círculo", "Listo"] as const;

export function WizardStepper({
    actual,
    maxVisitado,
    onIr,
}: {
    actual: number;
    maxVisitado: number;
    onIr: (paso: number) => void;
}) {
    return (
        <nav className="mb-7 flex items-center" aria-label="Progreso del registro">
            {PASOS_WIZARD.map((label, i) => {
                const esActual = i === actual;
                const visitable = i <= maxVisitado;
                return (
                    <span key={label} className={i > 0 ? "flex flex-1 items-center" : "flex items-center"}>
                        {i > 0 && (
                            <span
                                aria-hidden="true"
                                className={`mx-2 h-[1.6px] flex-1 overflow-hidden rounded-full bg-tinta/15 transition ease-barrido ${
                                    i <= actual ? "bg-pino" : ""
                                }`}
                            />
                        )}
                        <button
                            type="button"
                            disabled={!visitable}
                            aria-current={esActual ? "step" : undefined}
                            onClick={() => onIr(i)}
                            className={`flex items-center gap-2 rounded-xl p-1 transition ease-barrido ${
                                visitable ? "cursor-pointer hover:bg-tinta/5 dark:hover:bg-papel/10" : "cursor-default"
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                className={`grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full border-[1.6px] text-[13px] font-bold transition ease-barrido ${
                                    esActual
                                        ? "border-pino bg-pino text-papel shadow-[0_0_0_4px_rgb(var(--pino-rgb)/0.16)]"
                                        : i < actual
                                            ? "border-pino bg-pino/15 text-estado-pino"
                                            : "border-tinta/20 bg-papel/60 text-subtle"
                                }`}
                            >
                                {i + 1}
                            </span>
                            <span
                                className={`whitespace-nowrap text-xs font-semibold ${
                                    esActual ? "text-body" : visitable ? "text-muted" : "text-subtle"
                                } ${esActual ? "" : "hidden sm:inline"}`}
                            >
                                {label}
                            </span>
                        </button>
                    </span>
                );
            })}
        </nav>
    );
}

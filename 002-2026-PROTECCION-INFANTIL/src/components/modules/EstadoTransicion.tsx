"use client";

/**
 * Animación de transición de estado del reporte (spec 091-US3).
 * Corre UNA sola vez al revelarse el estado (animation-iteration-count: 1),
 * nunca en bucle.
 */
export function EstadoTransicion({ enProceso }: { enProceso: boolean }) {
    return (
        <div className="flex items-center gap-3" data-testid="estado-transicion" aria-hidden="true">
            <style>{`
                @keyframes et-spin { to { transform: rotate(360deg); } }
                @keyframes et-arrow {
                    0% { opacity: 0.2; transform: translateX(-4px); }
                    60% { opacity: 1; transform: translateX(0); }
                    100% { opacity: 1; transform: translateX(0); }
                }
                @keyframes et-check {
                    0% { transform: scale(0); opacity: 0; }
                    60% { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .et-spinner {
                    width: 28px; height: 28px; border-radius: 9999px;
                    border: 3px solid rgba(14, 165, 233, 0.25); border-top-color: rgb(14, 165, 233);
                    animation: et-spin 0.9s linear 1 forwards;
                }
                .et-arrow { opacity: 0.2; animation: et-arrow 0.5s ease-out 1 forwards; }
                .et-check { display: inline-flex; animation: et-check 0.55s ease-out 1 forwards; }
            `}</style>

            {enProceso ? (
                <div className="et-spinner" data-testid="et-spinner" />
            ) : (
                <div className="flex items-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                        <svg
                            key={i}
                            className="et-arrow h-5 w-5 text-sky-500"
                            style={{ animationDelay: `${i * 0.18}s` }}
                            data-testid={`et-arrow-${i}`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2.5}
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    ))}
                    <span
                        className="et-check ml-1 text-green-500"
                        style={{ animationDelay: "0.6s" }}
                        data-testid="et-check"
                    >
                        <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </span>
                </div>
            )}
        </div>
    );
}

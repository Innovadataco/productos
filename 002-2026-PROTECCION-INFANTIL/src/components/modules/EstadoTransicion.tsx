"use client";

/**
 * Animación de transición de estado del reporte (spec 091-C).
 * Un objeto (píldora) VIAJA del extremo "En proceso" al extremo "Procesado":
 * se desliza con ease-in-out (~1s) cambiando gris → verde; al llegar, el extremo
 * "Procesado" se ilumina y aparece el check con leve rebote.
 * Arranca ~400ms tras montar, corre UNA vez, nunca en bucle.
 * Si el reporte sigue "En proceso", el objeto pulsa en el extremo izquierdo.
 */
export function EstadoTransicion({ enProceso }: { enProceso: boolean }) {
    return (
        <div className="flex items-center gap-3" data-testid="estado-transicion">
            <style>{`
                @keyframes et-travel {
                    0%   { transform: translateX(0);      background-color: rgb(148, 163, 184); }
                    70%  { background-color: rgb(148, 163, 184); }
                    100% { transform: translateX(120px);  background-color: rgb(34, 197, 94); }
                }
                @keyframes et-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.55; transform: scale(0.85); }
                }
                @keyframes et-glow {
                    0%   { opacity: 0.35; }
                    100% { opacity: 1; }
                }
                @keyframes et-check {
                    0%   { transform: scale(0); opacity: 0; }
                    60%  { transform: scale(1.15); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .et-pill-travel {
                    animation: et-travel 1s ease-in-out 0.4s 1 forwards;
                    will-change: transform, background-color;
                }
                .et-pill-pulse {
                    animation: et-pulse 1.6s ease-in-out 0.4s infinite;
                }
                .et-end-dim { opacity: 0.35; }
                .et-end-lit { animation: et-glow 0.3s ease-out 1.3s 1 forwards; }
                .et-check { display: inline-flex; opacity: 0; animation: et-check 0.5s ease-out 1.4s 1 forwards; }
            `}</style>

            {/* Extremos SIEMPRE visibles */}
            <span className={`text-xs font-medium ${enProceso ? "text-amber-600" : "et-end-dim text-muted"}`} data-testid="et-extremo-proceso">
                En proceso
            </span>

            <div className="relative h-2.5 w-[128px] rounded-full bg-slate-200 dark:bg-slate-700" data-testid="et-track">
                <span
                    className={`absolute left-0 top-0 h-2.5 w-2.5 rounded-full ${enProceso ? "et-pill-pulse bg-amber-500" : "et-pill-travel"}`}
                    data-testid="et-pill"
                />
            </div>

            <span
                className={`flex items-center gap-1 text-xs font-medium ${enProceso ? "et-end-dim text-muted" : "et-end-lit text-green-600"}`}
                data-testid="et-extremo-procesado"
            >
                Procesado
                {!enProceso && (
                    <span className="et-check text-green-500" data-testid="et-check">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </span>
                )}
            </span>
        </div>
    );
}

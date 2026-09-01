"use client";

/**
 * SPEC-340 (A-68 §3.3) — «Ver análisis»: la clasificación EXPLICADA.
 *
 * Nunca la clave técnica sola: la explicación por categoría (parametrizada,
 * editable por el administrador) en lenguaje sereno. Un reporte sin clasificar
 * avisa con calma que el análisis está en camino.
 */
import { useState } from "react";

interface VerAnalisisProps {
    /** null = aún sin clasificar. */
    categoriaLabel: string | null;
    /** La explicación en lenguaje de padre (viene de la ruta, del parámetro). */
    explicacion: string | null;
}

export function VerAnalisis({ categoriaLabel, explicacion }: VerAnalisisProps) {
    const [abierto, setAbierto] = useState(false);

    return (
        <div>
            <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="text-xs font-medium text-pino underline-offset-2 hover:underline"
                aria-expanded={abierto}
            >
                Ver análisis
            </button>
            {abierto && (
                <div className="mt-2 rounded-xl border border-tinta/10 bg-papel/60 p-3 text-sm dark:border-papel/10 dark:bg-tinta/40">
                    {categoriaLabel ? (
                        <>
                            <p className="font-medium text-body">{categoriaLabel}</p>
                            <p className="mt-1 text-muted">
                                {explicacion ??
                                    "Nuestro sistema revisó lo que contaste y lo clasificó. Si algo no te suena, vuelve a mirarlo con calma o agrega otro evento con más detalle."}
                            </p>
                        </>
                    ) : (
                        <p className="text-muted">
                            Estamos revisando tu reporte. El análisis estará listo en un momento — no tienes que hacer nada.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

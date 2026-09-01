"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/* Layout effect isomórfico: en el servidor no existe (evita el warning de
   React); en el cliente corre ANTES del paint, así el count-up arranca sin
   que se vea primero el valor final. */
const useEfectoAntesDelPaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

function formatear(valor: number, decimales: number): string {
    return valor.toLocaleString("es-CO", {
        minimumFractionDigits: decimales,
        maximumFractionDigits: decimales,
    });
}

/**
 * Cifra con count-up animado (requestAnimationFrame, easing cubic-out) —
 * la ÚNICA isla client del Pulso: todo lo demás es HTML/CSS del servidor.
 *
 * Honestidad y accesibilidad:
 * - El primer render (SSR e hidratación) muestra el VALOR FINAL: sin JS la
 *   cifra ya es correcta y no hay mismatch de hidratación.
 * - prefers-reduced-motion: no hay animación, el valor queda fijo.
 * - Solo formatea el número que recibe; nunca lo calcula (candado 10).
 */
export default function CifraAnimada({
    valor,
    decimales = 0,
    duracionMs = 1200,
}: {
    valor: number;
    decimales?: number;
    duracionMs?: number;
}) {
    const [texto, setTexto] = useState(() => formatear(valor, decimales));

    useEfectoAntesDelPaint(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setTexto(formatear(valor, decimales));
            return;
        }
        let raf = 0;
        const t0 = performance.now();
        const paso = (t: number) => {
            const p = Math.min((t - t0) / duracionMs, 1);
            const suave = 1 - Math.pow(1 - p, 3);
            setTexto(formatear(valor * suave, decimales));
            if (p < 1) raf = requestAnimationFrame(paso);
        };
        raf = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(raf);
    }, [valor, decimales, duracionMs]);

    return <>{texto}</>;
}

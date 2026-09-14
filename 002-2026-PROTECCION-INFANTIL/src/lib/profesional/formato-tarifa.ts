/**
 * SPEC-694 · La tarifa del profesional se VE con puntos de miles (`200.000`) mientras
 * escribe, pero lo que se GUARDA y ENVÍA es el ENTERO (`200000`). COP no tiene
 * decimales; el servidor sigue recibiendo un entero (su validación no cambia).
 *
 * Formato manual (no `toLocaleString`) a propósito: determinista, sin depender del
 * ICU del entorno — el candado corre igual en test que en el navegador.
 */

/** Entero desde lo que el usuario escribe o pega: solo dígitos. «200.000», «2a0b0» → 200000; «» → 0. */
export function tarifaDesdeTexto(texto: string): number {
    const soloDigitos = texto.replace(/\D/g, "");
    return soloDigitos ? parseInt(soloDigitos, 10) : 0;
}

/** El entero con puntos de miles para mostrar: 200000 → «200.000»; 0 → «» (deja ver el placeholder). */
export function conPuntosDeMiles(entero: number): string {
    if (!Number.isFinite(entero) || entero <= 0) return "";
    return String(Math.trunc(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

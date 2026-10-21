import { timingSafeEqual } from "node:crypto";

/**
 * SPEC-898: comparación de secretos CONSTANTE en tiempo. Un `!==`/`===` de string corta en el
 * primer byte distinto y filtra el secreto por timing. El guard de LONGITUD va PRIMERO porque
 * `timingSafeEqual` LANZA si los buffers difieren en largo; ahí se devuelve false sin llamarlo.
 * El `try/catch` es red adicional, no reemplaza al guard.
 *
 * Es un SEAM de primera parte a propósito: los builtins de Node no son espiables en ESM
 * («Module namespace is not configurable»), así que el candado de worker-auth espía ESTE
 * módulo para asertar que la comparación se usa (control positivo: revertir a `!==` lo deja
 * sin llamar → rojo). El uso REAL de `timingSafeEqual` vive acá, visible en el diff.
 */
export function comparacionSecretoConstante(recibido: string | null, esperado: string): boolean {
    if (recibido === null || recibido.length !== esperado.length) return false;
    try {
        return timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
    } catch {
        return false;
    }
}

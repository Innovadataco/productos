/**
 * SPEC-807 · Dos fallos de la anonimización que NO son el mismo hecho — y que el llamador debe poder
 * DISTINGUIR, porque la respuesta a «¿se reintenta?» es opuesta y cualquier marca que no los separe
 * miente.
 *
 *  · RECHAZO (`AnonimizacionRechazadaError`): la anonimización CORRIÓ y su resultado es inusable por
 *    nuestra propia regla (p. ej. quedó demasiado corto). La negativa ES el resultado: no hay copia que
 *    guardar y NO se reintenta — con modelo determinista (seed fijo, temp 0) volvería a rechazar.
 *  · TRANSPORTE (`AnonimizacionTransporteError`): la llamada a Ollama falló (caído, timeout, HTTP,
 *    respuesta inválida). No se anonimizó NADA — no hay copia que negar, el trabajo simplemente no
 *    ocurrió. Es REINTENTABLE (Ollama puede volver).
 *
 * Es la misma familia que REFUSED vs HANG: dos estados que parecen uno hasta que se miden. Este módulo
 * solo deja el HECHO distinguible; la marca de pendiente y el reintento son de SPEC-812 (Datos).
 *
 * `Object.setPrototypeOf` mantiene `instanceof` correcto aunque el target baje de ES2017.
 */
export class AnonimizacionRechazadaError extends Error {
    readonly tipo = "rechazo" as const;
    constructor(message: string) {
        super(message);
        this.name = "AnonimizacionRechazadaError";
        Object.setPrototypeOf(this, AnonimizacionRechazadaError.prototype);
    }
}

export class AnonimizacionTransporteError extends Error {
    readonly tipo = "transporte" as const;
    /** El error de transporte original (fetch/timeout/HTTP), para el log — nunca contiene texto del relato. */
    readonly causa?: unknown;
    constructor(message: string, causa?: unknown) {
        super(message);
        this.name = "AnonimizacionTransporteError";
        this.causa = causa;
        Object.setPrototypeOf(this, AnonimizacionTransporteError.prototype);
    }
}

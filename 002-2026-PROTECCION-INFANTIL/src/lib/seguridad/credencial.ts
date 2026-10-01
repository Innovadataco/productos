/**
 * SPEC-783 · Tipo OPACO para una credencial temporal (contraseña) que puede viajar a una
 * notificación.
 *
 * El problema que cierra: la limpieza de `_sensibles` en el estado terminal garantiza que
 * «lo que está en `_sensibles` muere», pero NADA garantizaba que la credencial NUEVA se
 * pusiera ahí. Quien mañana pase una contraseña SUELTA en `variables` no rompía nada, no
 * ponía nada en rojo, y la clave sobrevivía en claro. Era un mecanismo que fallaba hacia
 * ABIERTO: olvidar = persistir.
 *
 * La invariante, cerrada por el TIPO (no por una lista de nombres): una `Credencial` NO es
 * un `string`. Es un objeto opaco cuyo valor vive tras un símbolo de módulo. Por lo tanto:
 *  · NO cabe en `variables` de una notificación (`Record<string, string | number>`) →
 *    ponerla suelta **no compila**. Solo entra en `sensibles` (`Record<string, Credencial>`),
 *    que el motor guarda bajo `variables._sensibles` y limpia en el terminal.
 *  · Revelar su texto es un acto EXPLÍCITO (`revelarCredencial`), visible en el código, no
 *    accidental. Olvidar deja de ser posible en vez de ser silencioso.
 *  · `JSON.stringify(cred)` da `{}` (las claves de símbolo no se serializan) → tampoco se
 *    filtra en un log o una respuesta por descuido.
 */

const VALOR: unique symbol = Symbol("credencial.valor");

/** Contraseña temporal opaca. Construir con `credencial`, leer con `revelarCredencial`. */
export interface Credencial {
    readonly [VALOR]: string;
}

/** Marca un texto como credencial. Único constructor. */
export function credencial(valor: string): Credencial {
    return { [VALOR]: valor };
}

/** Revela el texto de una credencial. ES el único punto de exposición del texto en claro:
 *  usar SOLO donde el texto plano es necesario a conciencia (hashear, mostrar una vez al
 *  admin, o serializar a `_sensibles` para el envío) — nunca para meterla en `variables`. */
export function revelarCredencial(cred: Credencial): string {
    return cred[VALOR];
}

/**
 * Revela una credencial OPCIONAL. El ternario vive ACÁ (no en la ruta), para que revelar una
 * credencial que puede faltar (p. ej. el alta que devuelve `password?`) no obligue a escribir
 * `campo: cond ? undefined : cred` en un endpoint «SIEMPRE muestra» — patrón que el candado
 * SPEC-423 (I-298) prohíbe con razón (escondía la credencial tras un flag de encolado).
 */
export function revelarOpcional(cred: Credencial | undefined): string | undefined {
    return cred === undefined ? undefined : revelarCredencial(cred);
}

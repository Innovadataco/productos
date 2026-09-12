/**
 * SPEC-628 / SPEC-652 · ÚNICA fuente de verdad de la pausa de la suscripción paga.
 *
 * SPEC-628 (#4, Jelkin: «ese tema de suscripción le podemos dar por ahora quieto
 * mientras estabilizamos el software») apagó la suscripción paga porque los
 * precios en `Plan.precioBaseCOP` son valores de siembra. Pero se aplicó a UNA
 * sola superficie —`Mi perfil → Suscripción`, con un flag local— y el paso 4 del
 * alta (padre y colegio) quedó con el selector vivo, mostrando esos precios
 * placeholder a TODO el que se registra (SPEC-652, medido por Calidad en prod).
 *
 * La causa de esa divergencia ERA tener la decisión en un flag por pantalla: dos
 * banderas que podían —y lo hicieron— decir cosas distintas del mismo hecho. Acá
 * vive UNA sola; todas las superficies la leen. Que sea imposible que divergan
 * vale más que una regla que diga que no deben.
 *
 * `true` = la suscripción paga está en pausa. Reactivar —cuando haya precios
 * reales, decisión de Jelkin (Parte 2 del radicado)— es ponerlo en `false` en
 * UN solo lugar.
 *
 * El trato por superficie NO es el mismo, a propósito:
 *  · `Mi perfil → Suscripción` (opcional): una NOTA, sin controles vivos.
 *  · Alta paso 4 (camino OBLIGATORIO): se CONSERVA la prueba gratis —la ruta viva
 *    que sostiene el alta— y se ocultan los planes pagos. Un precio falso
 *    desorienta; una pantalla sin salida bloquea a un cliente real: nunca dejar
 *    el alta sin por dónde seguir.
 */
export const SUSCRIPCION_PAGA_EN_PAUSA = true;

/**
 * Planes a mostrar en el paso 4 del alta según la pausa. En pausa: SOLO los
 * freemium (la prueba gratis); nunca los pagos con precio de siembra. Sin pausa:
 * todos. Conservar la prueba gratis es lo que impide romper el camino obligatorio
 * (tanto padre como colegio tienen un plan freemium sembrado y no negociable).
 *
 * `enPausa` se inyecta para poder probar las dos ramas; por defecto lee la única
 * fuente de verdad de arriba.
 */
export function planesVisiblesEnAlta<T extends { esFreemium: boolean }>(
    planes: T[],
    enPausa: boolean = SUSCRIPCION_PAGA_EN_PAUSA,
): T[] {
    return enPausa ? planes.filter((p) => p.esFreemium) : planes;
}

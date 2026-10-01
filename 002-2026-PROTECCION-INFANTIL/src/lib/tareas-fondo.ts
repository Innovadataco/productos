/**
 * SPEC-807 · Registro de tareas BEST-EFFORT lanzadas FUERA de la petición.
 *
 * Un trabajo best-effort que toca una dependencia remota y lenta (Ollama, que puede estar dormido y
 * COLGAR hasta el timeout) NO puede awaitarse dentro del handler: el bloqueo haría que el cliente
 * aborte la petición. Se lanza con `enSegundoPlano(promesa)`, que lo registra y le pone su propio
 * `.catch` (un rechazo best-effort jamás puede volverse `unhandledRejection`).
 *
 * `esperarTareasFondo()` existe SOLO para pruebas: deja asertar de forma DETERMINISTA el efecto del
 * trabajo en segundo plano sin `sleep`s frágiles. Producción nunca lo llama; el set se vacía solo a
 * medida que cada tarea se asienta.
 *
 * NO es un observador durable del trabajo: si el proceso muere con una tarea en vuelo, se pierde, y
 * nadie queda sabiendo qué unidad quedó sin hacer. Esa observación es deuda declarada aparte.
 */
const enVuelo = new Set<Promise<unknown>>();

/** Lanza una tarea best-effort fuera de la petición. Nunca lanza ni rechaza hacia el llamador. */
export function enSegundoPlano(tarea: Promise<unknown>): void {
    enVuelo.add(tarea);
    void tarea.catch(() => {}).finally(() => enVuelo.delete(tarea));
}

/** SOLO para pruebas: espera a que las tareas en segundo plano en vuelo se asienten. */
export async function esperarTareasFondo(): Promise<void> {
    await Promise.allSettled([...enVuelo]);
}

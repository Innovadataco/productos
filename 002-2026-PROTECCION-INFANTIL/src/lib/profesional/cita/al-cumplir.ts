/**
 * PUNTO DE UNIÓN entre SPEC-427 (el cierre) y SPEC-429 (las encuestas).
 *
 * Acordado por el CEO el 03-09 a las 23:51, con las dos specs construyéndose en
 * paralelo. El contrato es esta firma y nada más:
 *
 *     alCumplirCita(solicitudId) → void
 *
 * **Dueño del cuerpo: SPEC-429.** Acá queda vacía a propósito. 429 la llena con
 * lo suyo —activar las dos encuestas del par padre × profesional— sin tener que
 * tocar `cierre.service.ts`, y 427 no necesita saber qué hace.
 *
 * **Dueño de la llamada: SPEC-427.** Se invoca en el único lugar donde una cita
 * pasa a `CUMPLIDA` (`cerrarConCodigoDeCita`). Si mañana aparece otro camino al
 * cierre, tiene que llamar acá también.
 *
 * ## Por qué un archivo aparte y no un import directo
 * Las dos specs se mergean el mismo día. Si 429 escribiera dentro de
 * `cierre.service.ts` y 427 también, el conflicto sería en el archivo con la
 * lógica de dinero y estados. Así el punto de contacto es un archivo de una
 * función: quien llegue segundo conserva el cuerpo del otro y suma lo suyo.
 *
 * ## Por qué no revienta el cierre
 * El llamador la invoca DESPUÉS de que la cita quedó cerrada y sin envolverla en
 * la transacción. Que una encuesta no se active no puede deshacer una sesión que
 * de verdad ocurrió: el profesional ya hizo su trabajo y el código ya se usó.
 */
export async function alCumplirCita(_solicitudId: string): Promise<void> {
    // SPEC-429 escribe acá. No agregar lógica de 427 en este archivo.
    return Promise.resolve();
}

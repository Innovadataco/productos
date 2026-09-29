import type { EstadoSolicitudCita } from "@prisma/client";

/**
 * FUENTE ÚNICA de la regla «¿el contacto de una cita es visible?» (SPEC-395 · hallazgo de
 * fuga, prod).
 *
 * El porqué de este archivo: la decisión estaba TRIPLICADA —`debeExponerContacto` (padre ve al
 * profesional), `toCitaParaProfesional` (profesional ve al padre) y `calendario.service` (el
 * calendario del profesional, que la REPLICÓ en vez de llamarla)—. Tres adaptadores para la
 * misma decisión: el mismo patrón que fragmentó el menú. Por eso Jelkin vio el correo del padre
 * en el calendario aunque el DTO dijera otra cosa: se arregla uno y el otro sigue filtrando.
 *
 * A partir de acá **la regla vive en UN solo lugar**: los tres puntos llaman a
 * `contactoVisiblePorSesion`. El candado `contacto-fuente-unica.candado.test.ts` es de CONDUCTA
 * —no de «pasar por» esta función—: fuerza el resultado a `false` y afirma que las TRES
 * superficies devuelven el contacto AUSENTE con el correo REAL plantado, y a `true` para el
 * control positivo. Un complemento escanea la fuente para que no nazca un cuarto punto que
 * decida el contacto por su cuenta.
 *
 * ── LA REGLA (parametrizable acá, y SOLO acá) ────────────────────────────────────────────
 * HOY la conducta es la VIEJA, sin cambio: basta con que la cita esté `CONFIRMADA` para exponer
 * el contacto. Es DATO PERSONAL de un padre en un producto de protección infantil, así que la
 * regla es reserva legal (H-2 · Ley 2375/2024).
 *
 * FALLA CERRADA a propósito: cualquier estado distinto de `CONFIRMADA` (incluidos los futuros o
 * desconocidos) NO expone el contacto. La única puerta abierta es la que está escrita.
 *
 * DESTINO (decidido por Jelkin; NO implementado todavía): no intercambiar correo/teléfono es lo
 * correcto por minimización —ninguna norma exige contacto externo— (Estrategia · REPORTE-066).
 * Pero CERRAR el contacto tiene DOS prerrequisitos que hoy no existen POR LA PLATAFORMA, y hasta
 * que existan, quitarlo haría daño en vez de proteger:
 *   (a) un CANAL DE CONTINUIDAD padre↔profesional (si no, una cita CONFIRMADA viva se queda sin
 *       forma de realizarse); y
 *   (b) una VÍA DE ESCALAMIENTO de riesgo — la Ley 1090 art. 2 num. 5 OBLIGA al psicólogo a
 *       revelar ante daño inminente al consultante o a terceros. Cerrar el contacto sin darle
 *       otra vía le bloquea un deber LEGAL: no es más privacidad, es un profesional que ve algo
 *       grave y no tiene cómo actuar.
 *
 * Secuencia (la fija el CEO): (1) esta unificación —ahora, sin cambio de conducta— · (2) enlace
 * de la reunión · (3) canal de continuidad + vía de escalamiento · (4) recién ahí se voltea el
 * valor. El cambio de conducta llega en su propia SPEC (por radicar · CEO).
 *
 * Por eso la variable que va a decidir esta función NO es «¿ya empezó la sesión?» (tiempo) sino
 * «¿EXISTE otro canal?». La firma toma HOY solo `estado` y NO se casa con la franja/hora: cuando
 * se voltee el valor, el input que se threadea desde los tres llamadores es la existencia del
 * canal, no un reloj. El nombre dice «PorSesion» por herencia; hoy no hay compuerta de sesión.
 */
export function contactoVisiblePorSesion(estado: EstadoSolicitudCita): boolean {
    return estado === "CONFIRMADA";
}

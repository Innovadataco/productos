import type { EstadoSolicitudCita } from "@prisma/client";
import { primeraCitaConsumida } from "./segunda-cita";

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
 * SPEC-940 reabre la visibilidad POR DIRECCIÓN (antes 754 la cerraba en AMBAS, `false` siempre):
 *   · PADRE→PROFESIONAL (`padre_ve_profesional`): el padre ve el contacto del profesional SOLO tras
 *     CONSUMIR su 1.ª cita con él (`ESTADOS_PRIMERA_CITA_CONSUMIDA`) — antes estaba cerrado.
 *   · PROFESIONAL→PADRE (`profesional_ve_padre`): SIGUE CERRADA (`false` siempre) — eso de 754 vale.
 * El porqué de que la dirección profesional→padre siga cerrada —para que quien lea la línea no la
 * reabra sin contexto—:
 *   · el CANAL de la reunión es el ENLACE de la cita, que pone el operador (SPEC-750) — no el correo;
 *   · el RECURSO de plata (reembolso) va por la PQR (SPEC-752, motivo 2 «Un pago o un cobro»), que
 *     deja constancia de CUÁNDO se reclamó — un correo directo no, y sin esa fecha el plazo de
 *     reversión no se puede contar;
 *   · minimización: ninguna norma exige contacto externo (Estrategia · REPORTE-066); es dato personal
 *     de un padre en protección infantil (H-2 · Ley 2375/2024).
 *
 * Se llegó acá por la secuencia del CEO: (1) unificación #715 · (2) enlace SPEC-750 · (3) canal +
 * escalamiento SPEC-752 · (4) ESTA SPEC voltea el valor. **754 NO se despliega antes que 752**
 * (cerrar antes deja al padre sin vía). Los prerrequisitos que exigía el destino (canal de
 * continuidad + vía de escalamiento, Ley 1090 art. 2 num. 5) los provee 752.
 *
 * La firma usa `estado`: en la dirección padre→profesional SÍ decide (reapertura de SPEC-940 por
 * primera cita consumida); en profesional→padre la puerta sigue cerrada. El candado
 * `contacto-fuente-unica.candado.test.ts` prueba el MECANISMO (la fuente manda); los VALORES por
 * dirección los prueba `contacto-visible.test.ts`.
 */
/**
 * Dirección de la visibilidad. SPEC-940 la hace EXPLÍCITA porque la fuente era simétrica y eso ocultaba una fuga:
 * reabrir «el padre ve al profesional» NO debe reabrir «el profesional ve el correo del padre».
 */
export type DireccionContacto = "padre_ve_profesional" | "profesional_ve_padre";

export function contactoVisiblePorSesion(estado: EstadoSolicitudCita, direccion: DireccionContacto): boolean {
    // SPEC-940 · el profesional NUNCA recibe el contacto del padre por sesión (minimización H-2 · Ley 2375/2024;
    // 754 sigue en esta dirección). El canal del profesional hacia el padre lo media PI.
    if (direccion === "profesional_ve_padre") return false;
    // SPEC-940 · el padre ve el contacto del profesional SOLO tras CONSUMIR su 1.ª cita con él
    // (`ESTADOS_PRIMERA_CITA_CONSUMIDA`) — el MISMO set que bloquea la 2.ª cita por PI: invariante «visible ⟺
    // bloqueado». El override VENCIDO/SUSPENDIDO de `debeExponerContacto` cierra por encima de esto.
    return primeraCitaConsumida(estado);
}

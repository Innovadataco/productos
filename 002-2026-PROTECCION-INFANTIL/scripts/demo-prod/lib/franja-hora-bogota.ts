/**
 * SPEC-773 · Hora de una franja demo EN ZONA DE BOGOTÁ — fuente ÚNICA para los
 * sembradores.
 *
 * El defecto: los sembradores construían `inicio` con `setHours(9 + f%6)` o
 * conservando la hora de la corrida. `setHours` usa la zona del PROCESO, y el
 * entorno corre en UTC → `setHours(9)` son las 9:00 UTC = **4:00 de Bogotá**, y
 * una corrida a las 7am UTC dejaba franjas a las **2am de Bogotá**. La rejilla del
 * calendario clava un riel 7am–8pm (SPEC-771) y esconde todo lo que cae afuera, así
 * que además de sucio era invisible.
 *
 * El arreglo NO inventa una tercera noción de hora local: se apoya en
 * `instanteDesdeHoraBogota` + `diaBogota` (la tooling canónica de `src/lib/fechas`,
 * la misma que 768 dejó para toda la app). Acá solo se agrega la VENTANA plausible.
 *
 * NO cambia el DÍA de `base` (que codifica el pasado/futuro y la lógica de
 * vivo/barrido del sembrador, que va por creadoEn/venceEn, nunca por la hora de la
 * franja): solo fija una hora de atención creíble dentro de la ventana.
 */
import { diaBogota, instanteDesdeHoraBogota, sumarMinutos } from "@/lib/fechas/formato-bogota";

/** Ventana de atención en hora de Bogotá. Un start ≤ 19:00 + 50 min de sesión termina
 *  antes de las 20:00, dentro del riel 7am–8pm de la rejilla (SPEC-771). */
export const HORA_FRANJA_MIN = 7;
export const HORA_FRANJA_MAX = 19;

/** Encaja una hora (absoluta, la que el sembrador PRETENDÍA) dentro de la ventana. Los
 *  sembradores pedían 9..17 (9am–5pm), que ya caen dentro; el clamp es el cinturón. */
function horaEnVentana(horaBogota: number): string {
    const h = Math.max(HORA_FRANJA_MIN, Math.min(HORA_FRANJA_MAX, Math.trunc(horaBogota)));
    return `${String(h).padStart(2, "0")}:00`;
}

/**
 * `inicio`/`fin` de una franja en hora de Bogotá, sobre el DÍA CALENDARIO (Bogotá) de
 * `base`. `horaBogota` es la hora de atención pretendida (se encaja en la ventana).
 */
export function franjaBogota(
    base: Date,
    duracionMinutos: number,
    horaBogota: number,
): { inicio: Date; fin: Date } {
    const inicio = instanteDesdeHoraBogota(diaBogota(base), horaEnVentana(horaBogota));
    return { inicio, fin: sumarMinutos(inicio, duracionMinutos) };
}

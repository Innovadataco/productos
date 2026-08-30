/**
 * SPEC-201 (D-71): quiet hours. Si `enviarEn` cae dentro de la ventana de
 * silencio configurada, se difiere al inicio del próximo horario hábil.
 * Timezone fijo: America/Bogota (D-69).
 */
import { addMinutes, startOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { TIMEZONE_MOTOR } from "./offset";

export const DEFAULT_QUIET_HOURS = "20:00-07:00";

/**
 * SPEC-312 (002-PI-212 · cierra I-165): canales a los que la ventana de silencio
 * NUNCA aplica. Decisión CEO arquitectónica: EMAIL es asíncrono por diseño e
 * IN_APP se ve cuando el usuario mira — ninguno interrumpe físicamente, y retener
 * 2FA/password/pagos/alertas 11h rompe UX crítica (además de empeorar la
 * deliverability por el burst de las 07:00 en EMAIL). Son los 2 únicos canales del
 * enum CanalNotificacion hoy. Fase 2: si aterrizan PUSH/SMS/WhatsApp (que sí
 * interrumpen), NO se agregan acá — se resolverán con un bypass por prioridad.
 */
const CANALES_SIN_QUIET_HOURS = new Set(["EMAIL", "IN_APP"]);

interface VentanaMinutos {
    inicio: number;
    fin: number;
}

function parseVentana(ventana: string): VentanaMinutos {
    const match = ventana.trim().match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) {
        throw new Error(`Ventana de silencio inválida: "${ventana}". Formato esperado HH:MM-HH:MM.`);
    }

    const [, h1, m1, h2, m2] = match;
    const inicio = parseInt(h1, 10) * 60 + parseInt(m1, 10);
    const fin = parseInt(h2, 10) * 60 + parseInt(m2, 10);

    if (
        !Number.isFinite(inicio) ||
        !Number.isFinite(fin) ||
        inicio < 0 ||
        inicio >= 1440 ||
        fin < 0 ||
        fin >= 1440
    ) {
        throw new Error(`Ventana de silencio fuera de rango: "${ventana}".`);
    }

    return { inicio, fin };
}

/**
 * Devuelve `enviarEn` si está fuera de la ventana de silencio; de lo contrario,
 * la fecha/hora del inicio del próximo horario hábil en Bogotá.
 *
 * SPEC-312 (I-165): si `canal` es EMAIL o IN_APP, la ventana NO aplica y se
 * devuelve `enviarEn` sin modificar. El parámetro es opcional (3er arg) para no
 * romper callers/tests que no lo pasen: sin canal, se aplica la ventana igual
 * que antes.
 */
export function aplicarQuietHours(enviarEn: Date, ventana: string = DEFAULT_QUIET_HOURS, canal?: string): Date {
    if (canal && CANALES_SIN_QUIET_HOURS.has(canal)) {
        return enviarEn;
    }
    const { inicio, fin } = parseVentana(ventana);
    const zoned = toZonedTime(enviarEn, TIMEZONE_MOTOR);
    const inicioDia = startOfDay(zoned);
    const minutosDesdeMedianoche =
        zoned.getHours() * 60 + zoned.getMinutes() + zoned.getSeconds() / 60;

    const cruzaMedianoche = inicio > fin;

    if (cruzaMedianoche) {
        // Ventana 20:00-07:00: en silencio si >= 20:00 o < 07:00.
        if (minutosDesdeMedianoche >= inicio) {
            // Misma noche: próximo hábil es 07:00 del día siguiente.
            return fromZonedTime(addMinutes(inicioDia, fin + 1440), TIMEZONE_MOTOR);
        }
        if (minutosDesdeMedianoche < fin) {
            // Madrugada: próximo hábil es 07:00 del mismo día.
            return fromZonedTime(addMinutes(inicioDia, fin), TIMEZONE_MOTOR);
        }
    } else {
        // Ventana 09:00-18:00: en silencio si dentro del rango.
        if (minutosDesdeMedianoche >= inicio && minutosDesdeMedianoche < fin) {
            return fromZonedTime(addMinutes(inicioDia, fin), TIMEZONE_MOTOR);
        }
    }

    return enviarEn;
}

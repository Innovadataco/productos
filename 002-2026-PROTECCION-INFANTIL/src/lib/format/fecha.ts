/**
 * Helpers centralizados de formato de fecha/hora (SPEC-208).
 * Timezone fijo America/Bogotá para coherencia operativa (D-72).
 * Funcionan en cliente y servidor (Node 22 + Intl.DateTimeFormat).
 */

const TZ_BOGOTA = "America/Bogota";
const LOCALE = "es-CO";

function formatear(
    iso: string | null | undefined,
    opciones: Intl.DateTimeFormatOptions
): string {
    if (!iso) return "—";
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "—";
    return new Intl.DateTimeFormat(LOCALE, { ...opciones, timeZone: TZ_BOGOTA }).format(fecha);
}

/** "22 ago 2026" */
export function fechaCorta(iso: string | null | undefined): string {
    return formatear(iso, { year: "numeric", month: "short", day: "numeric" });
}

/** "22 ago 2026 · 15:30" */
export function fechaHora(iso: string | null | undefined): string {
    const fecha = formatear(iso, { year: "numeric", month: "short", day: "numeric" });
    const hora = formatear(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
    if (fecha === "—" || hora === "—") return "—";
    return `${fecha} · ${hora}`;
}

/** "2026-08-22" para atributos datetime. */
export function fechaISO(iso: string | null | undefined): string {
    if (!iso) return "—";
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "—";
    // Construcción manual con TZ Bogotá para evitar conversiones locales.
    const parts = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: TZ_BOGOTA,
    }).formatToParts(fecha);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !d) return "—";
    return `${y}-${m}-${d}`;
}

/**
 * A-70 · G20 — la fecha del HECHO se muestra sin minutos: "30 ago 2026 · 9 p. m."
 *
 * Decisión de Jelkin: al padre no le sirve el minuto exacto de algo que pasó
 * (y fingir precisión que no tiene es peor). En BD los minutos quedan en `00`
 * — el tipo de dato NO cambia, esto es presentación más el redondeo del campo
 * al capturar.
 */
export function fechaHoraSinMinutos(iso: string | null | undefined): string {
    const fecha = formatear(iso, { year: "numeric", month: "short", day: "numeric" });
    if (fecha === "—") return "—";
    // `hour12` con minute omitido da "9 p. m." en es-CO.
    const hora = formatear(iso, { hour: "numeric", hour12: true });
    if (hora === "—") return "—";
    return `${fecha} · ${hora}`;
}

/**
 * A-70 · G20 — normaliza a hora en punto para persistir. Recibe y devuelve el
 * valor del input `datetime-local` ("YYYY-MM-DDTHH:mm"); si viene con minutos
 * los pone en `00`. Cadena vacía pasa tal cual (campo sin llenar).
 */
export function aHoraEnPunto(valorLocal: string): string {
    if (!valorLocal) return valorLocal;
    const [dia, hora] = valorLocal.split("T");
    if (!hora) return valorLocal;
    const hh = hora.slice(0, 2);
    return `${dia}T${hh}:00`;
}

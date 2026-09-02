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

/**
 * A-74 · P1 — piezas del control amable de fecha del hecho.
 *
 * Por qué existe: el `datetime-local` nativo, aun con `step=3600`, PINTA el
 * segmento de minutos ("02/09/2026, 02:00 p.m.") y vacío se ve
 * "dd/mm/aaaa, --:-- ----". A un padre eso le pide una precisión que no tiene.
 * El control lo parte en día + hora 1-12 + a.m./p.m., sin minutos a la vista;
 * el valor que viaja sigue siendo "YYYY-MM-DDTHH:00".
 */
export type Meridiano = "am" | "pm";

/** "2026-09-02T14:00" → { fecha: "2026-09-02", hora12: 2, meridiano: "pm" } */
export function partesHoraLocal(valorLocal: string): { fecha: string; hora12: number | null; meridiano: Meridiano } {
    const [fecha = "", hora = ""] = (valorLocal || "").split("T");
    const hh = Number.parseInt(hora.slice(0, 2), 10);
    if (!fecha || Number.isNaN(hh)) return { fecha, hora12: null, meridiano: "am" };
    const meridiano: Meridiano = hh >= 12 ? "pm" : "am";
    const hora12 = hh % 12 === 0 ? 12 : hh % 12;
    return { fecha, hora12, meridiano };
}

/**
 * Arma el valor que viaja desde las tres piezas. Devuelve "" si falta algo
 * (el campo a medio llenar no debe mandar una fecha inventada).
 * 12 a.m. = medianoche (00) · 12 p.m. = mediodía (12).
 */
export function desdePartesHoraLocal(fecha: string, hora12: number | null, meridiano: Meridiano): string {
    if (!fecha || hora12 === null || Number.isNaN(hora12)) return "";
    const base = hora12 % 12;
    const hh = meridiano === "pm" ? base + 12 : base;
    return `${fecha}T${String(hh).padStart(2, "0")}:00`;
}

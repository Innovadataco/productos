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

/**
 * Constantes y helpers de paginación compartidos.
 *
 * Los endpoints paginados DEBEN usar MAX_PAGE_SIZE para evitar exfiltración
 * masiva de datos y caídas de rendimiento.
 */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export function clampPageSize(raw: number | string | null, max = MAX_PAGE_SIZE): number {
    const parsed = typeof raw === "string" ? Number(raw) : raw ?? DEFAULT_PAGE_SIZE;
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        return DEFAULT_PAGE_SIZE;
    }
    const positive = Math.max(1, Math.floor(parsed));
    return Math.min(positive, max);
}

export function clampPage(raw: number | string | null): number {
    const parsed = typeof raw === "string" ? Number(raw) : raw ?? 1;
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        return 1;
    }
    return Math.max(1, Math.floor(parsed));
}

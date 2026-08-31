// SPEC-036 · validación de returnTo compartida (extraída de /api/auth/link,
// que se retira). Defensa contra open-redirect: solo rutas relativas propias
// de BI. `/operacion` se agregó a la whitelist (faltaba en el original ·
// escrito antes de SPEC-033 · candado 15).

const ALLOW_PREFIXES = ["/dashboard", "/operacion", "/chat", "/api/bi/"];

export function biBase(): string {
    return process.env.BI_BASE_URL ?? "http://localhost:3001";
}

/**
 * Devuelve una ruta relativa segura de BI. `null`/vacío o fuera de la
 * whitelist → `/dashboard`. Si viene absoluta, solo se acepta el host de
 * BI_BASE_URL (se extrae pathname+search); otro host → `/dashboard`.
 */
export function sanitizeReturnTo(raw: string | null): string {
    if (!raw) return "/dashboard";
    let path = raw;
    try {
        const u = new URL(raw);
        const bi = new URL(biBase());
        if (u.host !== bi.host) return "/dashboard";
        path = u.pathname + u.search;
    } catch {
        // no es URL absoluta · tratamos como relativa
    }
    if (!path.startsWith("/")) return "/dashboard";
    if (!ALLOW_PREFIXES.some((p) => path.startsWith(p))) return "/dashboard";
    return path;
}

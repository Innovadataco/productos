/**
 * Helpers para formatear el nombre de plataforma de un reporte,
 * considerando el caso "otro" donde se guarda el nombre escrito por
 * el usuario en `otraPlataforma`.
 */

export function formatPlataforma(
    nombre: string,
    otraPlataforma: string | null | undefined,
    clave?: string
): string {
    if (clave === "otro" || nombre.toLowerCase() === "otra plataforma") {
        const extra = typeof otraPlataforma === "string" ? otraPlataforma.trim() : "";
        if (extra) return extra;
    }
    return nombre || "Plataforma no especificada";
}

export function formatPlataformasResumen(
    plataformas: { nombre: string; clave?: string; otraPlataforma?: string | null; total: number }[],
    totalReportes?: number
): string {
    const total = totalReportes ?? plataformas.reduce((sum, p) => sum + p.total, 0);
    const nombres = plataformas
        .map((p) => formatPlataforma(p.nombre, p.otraPlataforma, p.clave))
        .filter(Boolean);

    if (total <= 0) return "Sin reportes";
    if (nombres.length === 0) return `${total} reporte${total === 1 ? "" : "s"}`;

    const base = `${total} reporte${total === 1 ? "" : "s"}`;
    if (nombres.length === 1) return `${base} en ${nombres[0]}`;
    const ultimo = nombres[nombres.length - 1];
    const inicio = nombres.slice(0, -1).join(", ");
    return `${base} en ${inicio} y ${ultimo}`;
}

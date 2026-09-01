/**
 * Formatos de presentación del Pulso (006) — SOLO presentación:
 * jamás calculan métricas; toman los números ya resueltos por la capa
 * de datos (candados 9 y 10) y los vuelven legibles en español.
 */

/** "hace 3 min" / "hace 1 h" / "hace 2 d" a partir de minutos. */
export function formatoHace(minutos: number): string {
    if (minutos < 1) return "hace menos de 1 min";
    if (minutos < 60) return `hace ${Math.round(minutos)} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `hace ${dias} d`;
}

/** Etiqueta corta del eje de barras: "2026-08-19" → "19" (conserva el cero). */
export function etiquetaDia(dia: string): string {
    const iso = /^\d{4}-\d{2}-(\d{2})/.exec(dia);
    if (iso) return iso[1];
    return dia.slice(0, 5);
}

/** Día completo para tooltip/título: recorta la hora si viene en ISO. */
export function tituloDia(dia: string): string {
    return dia.slice(0, 10);
}

/** Entero con separador de miles es-CO (2818 → "2.818"). Solo formatea. */
export function fmtMiles(n: number): string {
    return n.toLocaleString("es-CO");
}

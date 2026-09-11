/**
 * SPEC-628 — fuente ÚNICA de los avisos que el padre controla, en frases (copy
 * aprobado en SPEC-326 §3.1, diseño CEO-aprobado 2026-08-30). Vive acá para que
 * DOS capas usen la misma frase sin divergir:
 *  - la UI de preferencias (PreferenciasNotificaciones) muestra los toggles;
 *  - el «Historial de cambios» del perfil (SPEC-628) resuelve el `eventoRegla`
 *    del AuditLog a la MISMA frase legible — nunca la clave técnica.
 *
 * El `eventoRegla` auditado es `<evento>.<CANAL>` (p. ej.
 * `reporte.resuelto.EMAIL`). `fraseAviso` recorta el canal y busca por `evento`.
 */

export type AvisoPadre = { evento: string; titulo: string; detalle: string };

/** Los avisos que el padre puede prender/apagar, con su frase (SPEC-326 §3.1). */
export const AVISOS_PADRE: readonly AvisoPadre[] = [
    {
        evento: "padre.circulo_confianza.reporte_enriquecido",
        titulo: "Cuando alguien reporte a una persona de mi círculo",
        detalle: "Te avisamos apenas aparezca un reporte sobre alguien que estás vigilando.",
    },
    {
        evento: "reporte.resuelto",
        titulo: "Cuando se resuelva un reporte que hice",
        detalle: "Te contamos cuando tu reporte quede resuelto.",
    },
] as const;

const CANALES = new Set(["EMAIL", "IN_APP"]);

/** `<evento>.<CANAL>` → `<evento>` (recorta solo si el último segmento es un canal). */
export function eventoDeReglaAviso(eventoRegla: string): string {
    const i = eventoRegla.lastIndexOf(".");
    if (i < 0) return eventoRegla;
    const posibleCanal = eventoRegla.slice(i + 1).toUpperCase();
    return CANALES.has(posibleCanal) ? eventoRegla.slice(0, i) : eventoRegla;
}

/**
 * Frase legible de un aviso del padre, a partir del `eventoRegla` auditado.
 * Devuelve `null` si el evento no es uno de los que el padre controla — el
 * llamador NUNCA debe mostrar la clave técnica en su lugar.
 */
export function fraseAviso(eventoRegla: string): string | null {
    const evento = eventoDeReglaAviso(eventoRegla);
    return AVISOS_PADRE.find((a) => a.evento === evento)?.titulo ?? null;
}

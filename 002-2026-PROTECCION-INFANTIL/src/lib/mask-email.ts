/**
 * SPEC-815 · Enmascarado de correos para los LOGS — fuente ÚNICA.
 *
 * El repo ya había decidido que los correos van enmascarados antes de emitirse a stdout, pero la
 * función vivía copiada inline en tres rutas de auth. Por eso DOS sitios (`digest-semanal`,
 * `apelacion-mantenimiento`) se escaparon sin enmascarar: no había un lugar compartido al que llegar.
 * Esta es ese lugar. Todo log que mencione un correo pasa por acá.
 *
 * Forma: `j***@dominio` — conserva primera letra y dominio (suficiente para depurar un envío sin
 * exponer la cuenta). Endurecido: si la entrada NO parece un correo (sin `@`), enmascara TODO —
 * NUNCA devuelve el valor crudo (las copias inline devolvían el original ante un valor malformado).
 */
export function maskEmail(email: string): string {
    if (typeof email !== "string" || !email.includes("@")) return "***";
    return email.replace(/^(.{1})(.*)(@.*)$/, "$1***$3");
}

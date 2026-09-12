/**
 * SPEC-678 · sexo demo de un hijo, DERIVADO del nombre — fuente ÚNICA compartida por el
 * sembrador (sembrar-hijos-demo5) y el corrector (corregir-sexo-hijos-demo5), para que no
 * puedan divergir.
 *
 * Dos reglas, las dos aprendidas esta jornada:
 *  - El sexo sale del NOMBRE, no de un hash aparte: si no, sale «Valentina (M)» y se nota
 *    al abrir la ficha del hijo.
 *  - PERO ~10% queda en `OTRO` a propósito: es un valor legítimo del enum (Zod: M|F|OTRO),
 *    en un producto sobre menores borrarlo del demo tiene lectura propia, y deja ejercitado
 *    ese camino del formulario. Derivar M/F «a secas» uniformaría el demo — el mismo error
 *    que el 70/30 evita en la otra dirección.
 */
const NOMBRES_M = ["Mateo", "Samuel", "Martín", "Tomás", "Emiliano", "Benjamín", "Gabriel", "Daniel"];
const NOMBRES_F = ["Emma", "Sofía", "Valentina", "Isabella", "Luciana", "Antonella", "Salomé", "Mariana"];
/** Pool combinado para elegir nombre (el género queda implícito en cuál se eligió). */
export const NOMBRES_NINO = [...NOMBRES_M, ...NOMBRES_F];

/** M/F derivado del nombre; `null` si el nombre NO es de la lista demo (no se adivina). */
export function generoDeNombre(nombre: string): "M" | "F" | null {
    if (NOMBRES_M.includes(nombre)) return "M";
    if (NOMBRES_F.includes(nombre)) return "F";
    return null;
}

/**
 * sexo demo final: `OTRO` para ~10% (determinista por `claveOtro`), si no M/F del nombre.
 *
 * `claveOtro` es la llave del 10%: el sembrador pasa `padreId:idx` (el hijo.id aún no existe
 * al crear); el corrector pasa el `hijo.id`. NO coinciden entre sí — cada uno da su propio
 * ~10% estable, que es lo único que importa (el reparto, no QUIÉN). Ambos idempotentes.
 */
export function sexoDemoDeNombre(nombre: string, claveOtro: string): "M" | "F" | "OTRO" {
    // hash simple y determinista de la llave (sin depender del hashInt del llamador).
    let h = 0;
    for (let i = 0; i < claveOtro.length; i++) h = (h * 31 + claveOtro.charCodeAt(i)) >>> 0;
    if (h % 10 === 0) return "OTRO"; // ~10% deliberado
    return generoDeNombre(nombre) ?? "M"; // el nombre demo siempre resuelve M/F; "M" es defensa
}

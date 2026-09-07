/**
 * 3003 — detector de «typo de dominio» en correos.
 *
 * Caso real del dueño: `Jelkin.Carrillo+padre01@gmaail.com` (doble «a») crea
 * una cuenta cuyo enlace de registro se pierde para siempre en un buzón que
 * no existe. El detector compara el dominio escrito contra los proveedores
 * más usados con distancia de Damerau-Levenshtein (admite inserción, borrado,
 * sustitución y TRANSPOSICIÓN: `gmial` → `gmail`) y sugiere el más cercano
 * cuando la distancia es ≤ 1.
 *
 * Reglas duras:
 * - SOLO sugiere: nunca corrige en silencio (corregir solo podría mandar el
 *   enlace de registro al buzón de un tercero).
 * - Dominio exacto conocido → null (no sugiere nada).
 * - Dominio institucional/lejano (`colegiosanpedro.edu.co`) → null: no se
 *   parece a ningún proveedor común, no se toca.
 */

const DOMINIOS_COMUNES: readonly string[] = [
    "gmail.com",
    "hotmail.com",
    "hotmail.es",
    "outlook.com",
    "outlook.es",
    "yahoo.com",
    "yahoo.es",
    "icloud.com",
    "me.com",
    "mac.com",
    "proton.me",
    "protonmail.com",
    "aol.com",
    "live.com",
    "msn.com",
    "gmx.com",
    "zoho.com",
    "mail.com",
];

/**
 * Distancia de Damerau-Levenshtein (optimal string alignment): edición mínima
 * con inserción, borrado, sustitución y transposición de caracteres adyacentes.
 * Dominios de ≤ 30 chars: la matriz completa es trivial.
 */
export function distanciaDamerau(a: string, b: string): number {
    const n = a.length;
    const m = b.length;
    if (n === 0) return m;
    if (m === 0) return n;
    const d: number[][] = Array.from({ length: n + 1 }, (_, i) => {
        const fila = new Array<number>(m + 1).fill(0);
        fila[0] = i;
        return fila;
    });
    for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const costo = a[i - 1] === b[j - 1] ? 0 : 1;
            let mejor = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + costo);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                mejor = Math.min(mejor, d[i - 2][j - 2] + 1);
            }
            d[i][j] = mejor;
        }
    }
    return d[n][m];
}

/**
 * Devuelve el dominio sugerido si el escrito está a distancia ≤ 1 de un
 * proveedor común (y no ES ese proveedor); null en cualquier otro caso.
 */
export function sugerirDominioCorreo(email: string): string | null {
    const partes = email.trim().toLowerCase().split("@");
    if (partes.length !== 2) return null;
    const dominio = partes[1];
    if (!dominio || dominio.length < 4) return null;
    if (DOMINIOS_COMUNES.includes(dominio)) return null;
    let mejor: string | null = null;
    let mejorDistancia = Infinity;
    for (const conocido of DOMINIOS_COMUNES) {
        const distancia = distanciaDamerau(dominio, conocido);
        if (distancia < mejorDistancia) {
            mejorDistancia = distancia;
            mejor = conocido;
        }
    }
    return mejorDistancia <= 1 ? mejor : null;
}

/**
 * Devuelve el correo con el dominio reemplazado por la sugerencia
 * (`jelkin@gmaail.com` + `gmail.com` → `jelkin@gmail.com`). La parte local
 * no se toca (alias `+padre01`, puntos y mayúsculas incluidos).
 */
export function aplicarSugerenciaDominio(email: string, dominioSugerido: string): string {
    const indice = email.lastIndexOf("@");
    if (indice === -1) return email;
    return `${email.slice(0, indice)}@${dominioSugerido}`;
}

/**
 * 3003 · atajos de dominio: los proveedores más usados como botones de un
 * toque. El dominio lo escribe el botón, no el teclado → el typo es imposible.
 * Regla única: sin @ se AGREGA `@dominio`; con @ se REEMPLAZA solo el dominio
 * (la parte local jamás se toca, alias incluidos).
 */
export const ATAJOS_DOMINIO: readonly string[] = [
    "gmail.com",
    "hotmail.com",
    "outlook.com",
    "yahoo.com",
    "icloud.com",
];

export function completarDominio(email: string, dominio: string): string {
    const indice = email.lastIndexOf("@");
    if (indice === -1) return `${email}@${dominio}`;
    return `${email.slice(0, indice)}@${dominio}`;
}

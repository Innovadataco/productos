export function normalizarIdentificador(valor: string, tipo?: string): string {
    const tipoLower = (tipo || "").trim().toLowerCase();
    if (tipoLower === "email") {
        return valor.trim().toLowerCase();
    }
    return valor.trim().toLowerCase();
}

/**
 * Infiere el tipo de un identificador a partir de su valor cuando el usuario
 * no lo indica: email si contiene "@", teléfono si es numérico (con o sin "+"),
 * nick en cualquier otro caso.
 */
export function inferirTipoIdentificador(valor: string): string {
    const v = valor.trim();
    if (v.includes("@")) return "email";
    if (/^\+?\d{7,15}$/.test(v.replace(/[\s()-]/g, ""))) return "telefono";
    return "nick";
}

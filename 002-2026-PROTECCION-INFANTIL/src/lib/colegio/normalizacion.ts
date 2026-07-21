export function normalizarIdentificador(valor: string, tipo?: string): string {
    const tipoLower = (tipo || "").trim().toLowerCase();
    if (tipoLower === "email") {
        return valor.trim().toLowerCase();
    }
    return valor.trim().toLowerCase();
}

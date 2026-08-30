/**
 * SPEC-310 (002-PI-211 · I-30 parte PI): defensa contra open redirect para el
 * puente de sesión PI→BI. Whitelist estricta de hosts — cualquier valor fuera
 * de ella (ausente, malformado, protocol-relative, host ajeno) cae al default.
 */

const DEFAULT_RETURN_TO = "https://bi.innovadataco.com/dashboard";

const HOSTS_PERMITIDOS: Record<string, ("http:" | "https:")[]> = {
    "bi.innovadataco.com": ["https:"],
    "localhost:3001": ["http:", "https:"],
};

export function validarReturnTo(returnTo: string | null | undefined): string {
    if (!returnTo) return DEFAULT_RETURN_TO;

    let url: URL;
    try {
        url = new URL(returnTo);
    } catch {
        return DEFAULT_RETURN_TO;
    }

    const protocolosPermitidos = HOSTS_PERMITIDOS[url.host];
    if (!protocolosPermitidos || !protocolosPermitidos.includes(url.protocol as "http:" | "https:")) {
        return DEFAULT_RETURN_TO;
    }

    return returnTo;
}

export { DEFAULT_RETURN_TO };

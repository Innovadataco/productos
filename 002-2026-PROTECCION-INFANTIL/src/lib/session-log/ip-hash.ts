import { calcularIpHash, getClientIp } from "@/lib/anti-abuso/fuente-reporte";

/**
 * Calcula el hash de IP para SesionLog reutilizando el helper de anti-abuso.
 * El helper ya trunca la IP a /24 (IPv4) o /64 (IPv6) antes de hashear.
 */
export function calcularIpHashSesion(request?: Request): string {
    const raw = getClientIp(request);
    return calcularIpHash(raw);
}

export function truncarUserAgent(userAgent: string | null | undefined): string | null {
    if (!userAgent) return null;
    const limpio = userAgent.trim();
    if (limpio.length === 0) return null;
    return limpio.slice(0, 256);
}

export function ipHashCorto(ipHash: string): string {
    return ipHash.slice(-4);
}

/**
 * SPEC-184 (002-PI-079): validador de rangos de test RFC 5737.
 *
 * Solo se permiten IPs inyectables en los bloques reservados para documentación
 * y pruebas:
 *   - 192.0.2.0/24
 *   - 198.51.100.0/24
 *   - 203.0.113.0/24
 *
 * Cualquier otra IP (incluyendo 8.8.8.8, 127.0.0.1, 10.0.0.0/8, etc.) se
 * rechaza con error claro. IPv6 no está soportada para inyección.
 */

interface Rango {
    red: number;
    mascara: number;
    label: string;
}

const RANGOS: Rango[] = [
    { red: ipAEntero("192.0.2.0"), mascara: 24, label: "192.0.2.0/24" },
    { red: ipAEntero("198.51.100.0"), mascara: 24, label: "198.51.100.0/24" },
    { red: ipAEntero("203.0.113.0"), mascara: 24, label: "203.0.113.0/24" },
];

function ipAEntero(ip: string): number {
    const partes = ip.split(".").map(Number);
    return (partes[0] << 24) | (partes[1] << 16) | (partes[2] << 8) | partes[3];
}

function esIpValida(ip: string): boolean {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip);
}

/**
 * Valida que la IP esté en un rango RFC 5737. Devuelve un objeto con `ok` y
 * mensaje descriptivo en caso de rechazo.
 */
export function validarIpInyectable(ip: string): { ok: true } | { ok: false; mensaje: string } {
    if (!ip || typeof ip !== "string") {
        return { ok: false, mensaje: "La IP es obligatoria." };
    }
    if (!esIpValida(ip)) {
        return { ok: false, mensaje: "Formato de IP inválido. Use IPv4." };
    }
    const octetos = ip.split(".").map(Number);
    if (octetos.some((o) => o < 0 || o > 255)) {
        return { ok: false, mensaje: "Cada octeto debe estar entre 0 y 255." };
    }

    const entero = ipAEntero(ip);
    const enRango = RANGOS.some((r) => {
        const shift = 32 - r.mascara;
        return (entero >>> shift) === (r.red >>> shift);
    });

    if (!enRango) {
        return {
            ok: false,
            mensaje: `La IP ${ip} no está en un rango de test permitido (RFC 5737: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).`,
        };
    }

    return { ok: true };
}

/**
 * SPEC-287 · Unit tests de sesion-estado-cookie (HMAC-SHA256, TTL, tampering).
 *
 * Cobertura: firma/verificación estable, tampering rechazado en tiempo constante,
 * TTL expirado rechazado, formato malo rechazado, cookie ausente rechazada,
 * los 3 flags del payload validados.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { firmarSesionEstado, leerSesionEstado, TTL_SEG, NOMBRE_COOKIE } from "./vigencia-cookie";

const SECRETO = "test-secret-de-32-chars-o-mas!!";

const ESTADO_LIMPIO = {
    vigencia: "ACTIVA" as const,
    requiereConsentimiento: false,
    debeCambiarPassword: false,
};

describe("firmarSesionEstado + leerSesionEstado — round trip", () => {
    it("ACTIVA + sin gates pendientes", async () => {
        const cookie = await firmarSesionEstado(ESTADO_LIMPIO, SECRETO);
        const payload = await leerSesionEstado(cookie, SECRETO);
        expect(payload).not.toBeNull();
        expect(payload?.vigencia).toBe("ACTIVA");
        expect(payload?.requiereConsentimiento).toBe(false);
        expect(payload?.debeCambiarPassword).toBe(false);
    });

    it("SIN_SUSCRIPCION + requiere consentimiento + debe cambiar password", async () => {
        const cookie = await firmarSesionEstado(
            { vigencia: "SIN_SUSCRIPCION", requiereConsentimiento: true, debeCambiarPassword: true },
            SECRETO,
        );
        const payload = await leerSesionEstado(cookie, SECRETO);
        expect(payload?.vigencia).toBe("SIN_SUSCRIPCION");
        expect(payload?.requiereConsentimiento).toBe(true);
        expect(payload?.debeCambiarPassword).toBe(true);
    });
});

describe("leerSesionEstado — rechazos", () => {
    it("cookie ausente → null", async () => {
        expect(await leerSesionEstado(null, SECRETO)).toBeNull();
        expect(await leerSesionEstado(undefined, SECRETO)).toBeNull();
        expect(await leerSesionEstado("", SECRETO)).toBeNull();
    });

    it("cookie sin separador → null", async () => {
        expect(await leerSesionEstado("solounapieza", SECRETO)).toBeNull();
    });

    it("firma inválida → null (tampering)", async () => {
        const cookie = await firmarSesionEstado(ESTADO_LIMPIO, SECRETO);
        const [payload] = cookie.split(".");
        const tampered = `${payload}.firma-manipulada`;
        expect(await leerSesionEstado(tampered, SECRETO)).toBeNull();
    });

    it("payload manipulado con firma vieja → null", async () => {
        const cookie = await firmarSesionEstado(
            { vigencia: "SIN_SUSCRIPCION", requiereConsentimiento: false, debeCambiarPassword: false },
            SECRETO,
        );
        const [, sig] = cookie.split(".");
        // Reemplazar el payload por otro base64 diferente con la firma original
        const otroPayload = btoa(JSON.stringify({ vigencia: "ACTIVA", requiereConsentimiento: false, debeCambiarPassword: false, iat: 1 })).replace(/=+$/, "");
        expect(await leerSesionEstado(`${otroPayload}.${sig}`, SECRETO)).toBeNull();
    });

    it("secreto distinto → null", async () => {
        const cookie = await firmarSesionEstado(ESTADO_LIMPIO, SECRETO);
        expect(await leerSesionEstado(cookie, "otro-secret-de-32-chars-o-mas!!")).toBeNull();
    });

    it("payload sin flags booleanos requeridos → null", async () => {
        // Firmar manualmente un payload incompleto para asegurar el rechazo.
        const payloadIncompleto = { vigencia: "ACTIVA", iat: Math.floor(Date.now() / 1000) };
        const payloadB64 = btoa(JSON.stringify(payloadIncompleto)).replace(/=+$/, "");
        const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(SECRETO),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"],
        );
        const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64)));
        const sigB64 = btoa(String.fromCharCode(...sig)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
        expect(await leerSesionEstado(`${payloadB64}.${sigB64}`, SECRETO)).toBeNull();
    });
});

describe("leerSesionEstado — TTL", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("dentro del TTL → válida", async () => {
        vi.setSystemTime(new Date("2026-08-27T00:00:00Z"));
        const cookie = await firmarSesionEstado(ESTADO_LIMPIO, SECRETO);
        vi.setSystemTime(new Date("2026-08-27T00:04:00Z"));
        expect(await leerSesionEstado(cookie, SECRETO)).not.toBeNull();
    });

    it("después del TTL → null", async () => {
        vi.setSystemTime(new Date("2026-08-27T00:00:00Z"));
        const cookie = await firmarSesionEstado(ESTADO_LIMPIO, SECRETO);
        vi.setSystemTime(new Date("2026-08-27T00:06:00Z"));
        expect(await leerSesionEstado(cookie, SECRETO)).toBeNull();
    });

    it("iat en el futuro (más allá del sesgo tolerado) → null", async () => {
        vi.setSystemTime(new Date("2026-08-27T00:10:00Z"));
        const cookie = await firmarSesionEstado(ESTADO_LIMPIO, SECRETO);
        vi.setSystemTime(new Date("2026-08-27T00:00:00Z"));
        expect(await leerSesionEstado(cookie, SECRETO)).toBeNull();
    });

    it("TTL_SEG default = 300 (5 min)", () => {
        expect(TTL_SEG).toBe(300);
    });

    it("NOMBRE_COOKIE = 'sesion_estado'", () => {
        expect(NOMBRE_COOKIE).toBe("sesion_estado");
    });
});

describe("firmarSesionEstado — validaciones", () => {
    it("secret vacío → error", async () => {
        await expect(firmarSesionEstado(ESTADO_LIMPIO, "")).rejects.toThrow();
    });

    it("secret muy corto → error", async () => {
        await expect(firmarSesionEstado(ESTADO_LIMPIO, "corto")).rejects.toThrow();
    });
});

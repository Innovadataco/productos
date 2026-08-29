import { describe, it, expect } from "vitest";
import { validarIpInyectable } from "./rfc5737";

describe("validarIpInyectable (RFC 5737)", () => {
    it("acepta IPs en 192.0.2.0/24", () => {
        expect(validarIpInyectable("192.0.2.1")).toEqual({ ok: true });
        expect(validarIpInyectable("192.0.2.254")).toEqual({ ok: true });
    });

    it("acepta IPs en 198.51.100.0/24", () => {
        expect(validarIpInyectable("198.51.100.1")).toEqual({ ok: true });
        expect(validarIpInyectable("198.51.100.255")).toEqual({ ok: true });
    });

    it("acepta IPs en 203.0.113.0/24", () => {
        expect(validarIpInyectable("203.0.113.1")).toEqual({ ok: true });
        expect(validarIpInyectable("203.0.113.254")).toEqual({ ok: true });
    });

    it("rechaza IP real (8.8.8.8)", () => {
        const result = validarIpInyectable("8.8.8.8");
        expect(result.ok).toBe(false);
        expect((result as { ok: false; mensaje: string }).mensaje).toContain("RFC 5737");
    });

    it("rechaza privadas y loopback", () => {
        expect(validarIpInyectable("127.0.0.1").ok).toBe(false);
        expect(validarIpInyectable("10.0.0.1").ok).toBe(false);
        expect(validarIpInyectable("192.168.1.1").ok).toBe(false);
    });

    it("rechaza octetos fuera de rango", () => {
        const result = validarIpInyectable("192.0.2.256");
        expect(result.ok).toBe(false);
        expect((result as { ok: false; mensaje: string }).mensaje).toContain("0 y 255");
    });

    it("rechaza formato inválido", () => {
        expect(validarIpInyectable("192.0.2").ok).toBe(false);
        expect(validarIpInyectable("no-es-ip").ok).toBe(false);
        expect(validarIpInyectable("").ok).toBe(false);
    });

    it("rechaza IPv6", () => {
        expect(validarIpInyectable("2001:db8::1").ok).toBe(false);
    });
});

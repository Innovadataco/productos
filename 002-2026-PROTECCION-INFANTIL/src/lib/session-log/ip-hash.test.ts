import { describe, it, expect } from "vitest";
import { calcularIpHashSesion, truncarUserAgent, ipHashCorto } from "./ip-hash";

describe("session-log / ip-hash", () => {
    describe("calcularIpHashSesion", () => {
        it("devuelve hash estable para una IP", () => {
            const req = new Request("http://localhost:5005/api/session/ping", {
                headers: { "x-forwarded-for": "192.168.1.100" },
            });
            const hash = calcularIpHashSesion(req);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
            expect(calcularIpHashSesion(req)).toBe(hash);
        });

        it("devuelve hash para request sin cabeceras de IP", () => {
            const req = new Request("http://localhost:5005/api/session/ping");
            const hash = calcularIpHashSesion(req);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it("acepta undefined (llamado desde worker)", () => {
            const hash = calcularIpHashSesion(undefined);
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe("truncarUserAgent", () => {
        it("devuelve null para valores vacíos", () => {
            expect(truncarUserAgent(null)).toBeNull();
            expect(truncarUserAgent(undefined)).toBeNull();
            expect(truncarUserAgent("")).toBeNull();
            expect(truncarUserAgent("   ")).toBeNull();
        });

        it("devuelve el user-agent limpio si cabe", () => {
            expect(truncarUserAgent("Mozilla/5.0")).toBe("Mozilla/5.0");
            expect(truncarUserAgent("  Mozilla/5.0  ")).toBe("Mozilla/5.0");
        });

        it("trunca a 256 caracteres", () => {
            const largo = "a".repeat(300);
            expect(truncarUserAgent(largo)).toHaveLength(256);
        });
    });

    describe("ipHashCorto", () => {
        it("devuelve los últimos 4 caracteres", () => {
            expect(ipHashCorto("abcdef123456")).toBe("3456");
            expect(ipHashCorto("abc")).toBe("abc");
        });
    });
});

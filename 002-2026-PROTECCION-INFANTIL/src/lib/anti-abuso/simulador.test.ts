import { describe, it, expect } from "vitest";
import { generarPayloads } from "./simulador";
import type { SimularAbusoBody } from "./simulador";

describe("generarPayloads", () => {
    it("robot_inundando genera N payloads desde la misma IP", () => {
        const params: SimularAbusoBody = { escenario: "robot_inundando", n: 5, ip: "192.0.2.10" };
        const payloads = generarPayloads(params);
        expect(payloads).toHaveLength(5);
        expect(new Set(payloads.map((p) => p.ip)).size).toBe(1);
        expect(payloads[0].ip).toBe("192.0.2.10");
        expect(payloads.every((p) => p.plataforma === "whatsapp")).toBe(true);
    });

    it("ataque_coordinado genera IPs rotativas hacia el mismo identificador", () => {
        const params: SimularAbusoBody = { escenario: "ataque_coordinado", n: 5, ip: "198.51.100.1", identificador: "3000000001" };
        const payloads = generarPayloads(params);
        expect(payloads).toHaveLength(5);
        expect(new Set(payloads.map((p) => p.identificador)).size).toBe(1);
        expect(new Set(payloads.map((p) => p.ip)).size).toBe(5);
    });

    it("bot_ips_rotativas genera IPs e identificadores variados", () => {
        const params: SimularAbusoBody = { escenario: "bot_ips_rotativas", n: 5, ip: "203.0.113.1" };
        const payloads = generarPayloads(params);
        expect(payloads).toHaveLength(5);
        expect(new Set(payloads.map((p) => p.ip)).size).toBeGreaterThan(1);
        expect(new Set(payloads.map((p) => p.identificador)).size).toBeGreaterThan(1);
    });

    it("personalizado usa IP e identificador fijos", () => {
        const params: SimularAbusoBody = { escenario: "personalizado", n: 3, ip: "192.0.2.50", identificador: "3009999999", plataforma: "instagram" };
        const payloads = generarPayloads(params);
        expect(payloads).toHaveLength(3);
        expect(payloads.every((p) => p.ip === "192.0.2.50")).toBe(true);
        expect(payloads.every((p) => p.identificador === "3009999999")).toBe(true);
        expect(payloads.every((p) => p.plataforma === "instagram")).toBe(true);
    });
});

import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AppError } from "@/lib/errors";
import { generarPayloads, crearSimulacionAbuso, cancelarSimulacionAbuso } from "./simulador";
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

    it("soporta array de IPs e identificadores", () => {
        const params: SimularAbusoBody = {
            escenario: "robot_inundando",
            n: 6,
            ips: ["192.0.2.10", "192.0.2.11"],
            identificadores: ["3001111111", "3002222222"],
        };
        const payloads = generarPayloads(params);
        expect(payloads).toHaveLength(6);
        expect(new Set(payloads.map((p) => p.ip)).size).toBe(2);
        expect(new Set(payloads.map((p) => p.identificador)).size).toBe(2);
    });
});

describe("crearSimulacionAbuso (integración)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea una simulación y guarda config con usuarioId", async () => {
        const admin = await crearUsuario("ADMIN");
        const parent = await crearUsuario("PARENT");
        const run = await crearSimulacionAbuso({ escenario: "denunciante_spam", n: 3, usuarioId: parent.id }, admin.id);
        expect(run.escenario).toBe("denunciante_spam");
        expect(run.totalReportes).toBe(3);
        const guardado = await prisma.simulacionAbusoRun.findUnique({ where: { id: run.id } });
        expect(guardado).not.toBeNull();
        const config = (guardado?.configJson ?? {}) as Record<string, unknown>;
        expect(config.usuarioId).toBe(parent.id);
    });

    it("falla loud con 400 si denunciante_spam no tiene usuarioId", async () => {
        const admin = await crearUsuario("ADMIN");
        await expect(crearSimulacionAbuso({ escenario: "denunciante_spam", n: 3 }, admin.id)).rejects.toThrow(AppError);
        await expect(crearSimulacionAbuso({ escenario: "denunciante_spam", n: 3 }, admin.id)).rejects.toThrow(
            "Falta configurar simulacion.spam.usuario_id en Configuración → Sistema. Debe apuntar al id de un usuario PARENT de prueba."
        );
    });

    it("falla loud si el usuarioId no es PARENT activo", async () => {
        const admin = await crearUsuario("ADMIN");
        const otro = await crearUsuario("ADMIN");
        await expect(crearSimulacionAbuso({ escenario: "denunciante_spam", n: 3, usuarioId: otro.id }, admin.id)).rejects.toThrow(AppError);
        await expect(crearSimulacionAbuso({ escenario: "denunciante_spam", n: 3, usuarioId: otro.id }, admin.id)).rejects.toThrow(
            "no es un PARENT activo"
        );
    });

    it("rechaza IP real (8.8.8.8) con AppError 400", async () => {
        const admin = await crearUsuario("ADMIN");
        await expect(crearSimulacionAbuso({ escenario: "personalizado", n: 1, ip: "8.8.8.8" }, admin.id)).rejects.toThrow(AppError);
        await expect(crearSimulacionAbuso({ escenario: "personalizado", n: 1, ip: "8.8.8.8" }, admin.id)).rejects.toThrow("RFC 5737");
    });

    it("cancelar marca la corrida como CANCELADA sin fechaFin", async () => {
        const admin = await crearUsuario("ADMIN");
        const run = await crearSimulacionAbuso({ escenario: "robot_inundando", n: 3 }, admin.id);
        const ok = await cancelarSimulacionAbuso(run.id, admin.id);
        expect(ok).toBe(true);
        const actualizado = await prisma.simulacionAbusoRun.findUnique({ where: { id: run.id } });
        expect(actualizado?.estado).toBe("CANCELADA");
        const config = (actualizado?.configJson ?? {}) as Record<string, unknown>;
        expect(config).not.toHaveProperty("fechaFin");
    });
});

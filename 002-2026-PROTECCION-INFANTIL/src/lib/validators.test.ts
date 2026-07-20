import { describe, it, expect } from "vitest";
import {
    authRegisterSchema,
    recuperarSolicitarSchema,
    restablecerPasswordSchema,
} from "./validators";

describe("authRegisterSchema", () => {
    it("acepta un payload válido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
        });
        expect(result.success).toBe(true);
    });

    it("rechaza email inválido", () => {
        const result = authRegisterSchema.safeParse({
            email: "no-es-email",
            password: "Segura123",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña corta", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "corta1",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña sin letra", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "12345678",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña sin número", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "SoloLetras",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza rol inválido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "SUPER_ADMIN",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza campos adicionales", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
            extra: "campo no permitido",
        });
        expect(result.success).toBe(false);
    });

    it("acepta tenantId opcional válido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
            tenantId: "550e8400-e29b-41d4-a716-446655440000",
        });
        expect(result.success).toBe(true);
    });

    it("rechaza tenantId inválido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
            tenantId: "id-invalido",
        });
        expect(result.success).toBe(false);
    });
});

describe("recuperarSolicitarSchema", () => {
    it("acepta email válido", () => {
        const result = recuperarSolicitarSchema.safeParse({ email: "usuario@ejemplo.com" });
        expect(result.success).toBe(true);
    });

    it("rechaza email inválido", () => {
        const result = recuperarSolicitarSchema.safeParse({ email: "no-es-email" });
        expect(result.success).toBe(false);
    });

    it("rechaza email vacío", () => {
        const result = recuperarSolicitarSchema.safeParse({ email: "" });
        expect(result.success).toBe(false);
    });

    it("rechaza email demasiado largo", () => {
        const longEmail = "a".repeat(250) + "@ejemplo.com";
        const result = recuperarSolicitarSchema.safeParse({ email: longEmail });
        expect(result.success).toBe(false);
    });
});

describe("restablecerPasswordSchema", () => {
    it("acepta token y contraseña válidos", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "NuevaPass456",
        });
        expect(result.success).toBe(true);
    });

    it("rechaza token vacío", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "",
            password: "NuevaPass456",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña débil", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "corta",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña sin número", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "SoloLetras",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza campos adicionales", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "NuevaPass456",
            extra: "campo no permitido",
        });
        expect(result.success).toBe(false);
    });
});

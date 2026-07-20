import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado, crearParametrosReportes } from "@/lib/reporte-test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: () => {
            // no-op para tests
        },
    }),
}));

describe("POST /api/auth/register", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("registra un usuario válido como ADMIN", async () => {
        const admin = await crearUsuario("ADMIN", "admin-register@example.com", "AdminPass123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/register",
            { email: "nuevo@example.com", password: "Segura123", rol: "PARENT" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.user.email).toBe("nuevo@example.com");
        expect(data.user.rol).toBe("PARENT");
    });

    it("rechaza email inválido con VALIDATION_ERROR", async () => {
        const admin = await crearUsuario("ADMIN", "admin-register@example.com", "AdminPass123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/register",
            { email: "no-es-email", password: "Segura123", rol: "PARENT" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza contraseña débil con VALIDATION_ERROR", async () => {
        const admin = await crearUsuario("ADMIN", "admin-register@example.com", "AdminPass123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/register",
            { email: "nuevo@example.com", password: "1234", rol: "PARENT" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza rol inválido con VALIDATION_ERROR", async () => {
        const admin = await crearUsuario("ADMIN", "admin-register@example.com", "AdminPass123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/register",
            { email: "nuevo@example.com", password: "Segura123", rol: "HACKER" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza campos adicionales con VALIDATION_ERROR", async () => {
        const admin = await crearUsuario("ADMIN", "admin-register@example.com", "AdminPass123");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            "http://localhost:5005/api/auth/register",
            { email: "nuevo@example.com", password: "Segura123", rol: "PARENT", extra: "campo" },
            mockToken
        );

        const res = await POST(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza sin autenticación", async () => {
        const req = new Request("http://localhost:5005/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "nuevo@example.com", password: "Segura123", rol: "PARENT" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });
});

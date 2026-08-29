import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
        set: vi.fn(),
    }),
}));

function getSesiones(token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return GET(
        new Request("http://localhost:5005/api/admin/sesiones", {
            headers,
        })
    );
}

describe("GET /api/admin/sesiones (SPEC-206)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("admin lista sesiones activas con paginación", async () => {
        const admin = await crearUsuario("ADMIN", "admin-sesiones@example.com");
        const padre = await crearUsuario("PARENT", "padre-activo@example.com");
        await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "abcd1234",
            },
        });
        const adminSesion = await prisma.sesionLog.create({
            data: {
                usuarioId: admin.id,
                rol: admin.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "adminhash",
            },
        });
        mockToken = await createToken({ sub: admin.id, rol: admin.rol, sesionLogId: adminSesion.id });

        const res = await getSesiones(mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();
        // La sesión activa del admin también aparece; verificamos la del padre.
        expect(json.items.length).toBeGreaterThanOrEqual(1);
        const padreItem = json.items.find((i: { email: string }) => i.email === "padre-activo@example.com");
        expect(padreItem).toBeDefined();
        expect(padreItem.ipHashCorto).toBe("1234");
        expect(json.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it("operador sin módulo recibe 403", async () => {
        const operador = await crearUsuario("OPERADOR", "operador-sesiones@example.com");
        const opSesion = await prisma.sesionLog.create({
            data: {
                usuarioId: operador.id,
                rol: operador.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "ophash",
            },
        });
        mockToken = await createToken({ sub: operador.id, rol: operador.rol, sesionLogId: opSesion.id });

        const res = await getSesiones(mockToken);
        expect(res.status).toBe(403);
    });

    it("no lista sesiones cerradas", async () => {
        const admin = await crearUsuario("ADMIN", "admin-cerradas@example.com");
        const padre = await crearUsuario("PARENT", "padre-cerrado@example.com");
        await prisma.sesionLog.create({
            data: {
                usuarioId: padre.id,
                rol: padre.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                cerradaEn: new Date(),
                motivoCierre: "FORZADA",
                ipHash: "abcd1234",
            },
        });
        const adminSesion = await prisma.sesionLog.create({
            data: {
                usuarioId: admin.id,
                rol: admin.rol,
                iniciadaEn: new Date(),
                ultimaActividadEn: new Date(),
                ipHash: "adminhash2",
            },
        });
        mockToken = await createToken({ sub: admin.id, rol: admin.rol, sesionLogId: adminSesion.id });

        const res = await getSesiones(mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();
        // Solo la sesión activa del admin debe aparecer; la del padre está cerrada.
        expect(json.items.every((i: { email: string }) => i.email !== "padre-cerrado@example.com")).toBe(true);
        expect(json.pagination.total).toBeGreaterThanOrEqual(0);
    });
});

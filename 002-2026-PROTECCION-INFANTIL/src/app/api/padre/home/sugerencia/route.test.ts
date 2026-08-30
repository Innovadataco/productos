/**
 * SPEC-307 (A-50): tests de integración de GET /api/padre/home/sugerencia.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function requestSugerencia() {
    return new Request("http://localhost:5005/api/padre/home/sugerencia", { method: "GET" });
}

describe("/api/padre/home/sugerencia (SPEC-307)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("200: devuelve sugerencia del padre autenticado con shape correcto", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GET(requestSugerencia());
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.tipo).toBe("INVITAR_CONTACTOS");
        expect(typeof json.titulo).toBe("string");
        expect(typeof json.mensaje).toBe("string");
        expect(json.accion).toHaveProperty("etiqueta");
        expect(json.accion).toHaveProperty("href");
        expect(json.metadata).toHaveProperty("contactosVerde");
    });

    it("403: un rol distinto de PARENT no puede consultar", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(requestSugerencia());
        expect(res.status).toBe(403);
    });

    it("401: sin sesión", async () => {
        const res = await GET(requestSugerencia());
        expect(res.status).toBe(401);
    });
});

/**
 * SPEC-590 — GET /api/padre/perfil/auditoria: «Historial de cambios» de
 * «Mi perfil». El scope es SIEMPRE el usuario de la sesión (jamás por query),
 * paginado y del más reciente al más viejo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

function url(query = ""): Request {
    return new Request(`http://localhost:5005/api/padre/perfil/auditoria${query}`);
}

describe("GET /api/padre/perfil/auditoria (SPEC-590)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("401 sin sesión", async () => {
        const res = await GET(url());
        expect(res.status).toBe(401);
    });

    it("devuelve solo los PERFIL_CAMBIO del propio usuario, con etiqueta y shape de paginación", async () => {
        const padre = await crearUsuario("PARENT");
        const otro = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await prisma.auditLog.create({
            data: {
                accion: "PERFIL_CAMBIO",
                tipoRecurso: "Usuario",
                recursoId: padre.id,
                usuarioId: padre.id,
                valorAnterior: JSON.stringify({ campo: "telefono", valor: null }),
                valorNuevo: JSON.stringify({ campo: "telefono", valor: "+57 300 111 2233" }),
                ipAddress: "127.0.0.1",
                userAgent: "vitest",
            },
        });
        // Ruido: cambio de OTRO usuario — no debe aparecer.
        await prisma.auditLog.create({
            data: {
                accion: "PERFIL_CAMBIO",
                tipoRecurso: "Usuario",
                recursoId: otro.id,
                usuarioId: otro.id,
                valorNuevo: JSON.stringify({ campo: "telefono", valor: "999" }),
                ipAddress: "127.0.0.1",
                userAgent: "vitest",
            },
        });
        // Ruido: otra acción del PROPIO usuario — tampoco aparece.
        await prisma.auditLog.create({
            data: {
                accion: "USER_CREATE",
                tipoRecurso: "Usuario",
                recursoId: padre.id,
                usuarioId: padre.id,
                ipAddress: "127.0.0.1",
                userAgent: "vitest",
            },
        });

        const res = await GET(url());
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].campo).toBe("telefono");
        expect(json.items[0].etiqueta).toBe("Teléfono");
        expect(json.items[0].anterior).toBeNull();
        expect(json.items[0].nuevo).toBe("+57 300 111 2233");
        expect(json.pagination).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    });

    it("ordena del más reciente al más viejo y pagina", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        await prisma.auditLog.create({
            data: {
                accion: "PERFIL_CAMBIO",
                tipoRecurso: "Usuario",
                recursoId: padre.id,
                usuarioId: padre.id,
                valorNuevo: JSON.stringify({ campo: "telefono", valor: "111" }),
                ipAddress: "127.0.0.1",
                userAgent: "vitest",
            },
        });
        await prisma.auditLog.create({
            data: {
                accion: "PERFIL_CAMBIO",
                tipoRecurso: "Usuario",
                recursoId: padre.id,
                usuarioId: padre.id,
                valorAnterior: JSON.stringify({ campo: "email", valor: "viejo@example.com" }),
                valorNuevo: JSON.stringify({ campo: "email", valor: "nuevo@example.com" }),
                ipAddress: "127.0.0.1",
                userAgent: "vitest",
            },
        });

        const primera = await GET(url("?page=1&pageSize=1"));
        const json1 = await primera.json();
        expect(json1.items).toHaveLength(1);
        expect(json1.items[0].campo).toBe("email");
        expect(json1.pagination).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });

        const segunda = await GET(url("?page=2&pageSize=1"));
        const json2 = await segunda.json();
        expect(json2.items[0].campo).toBe("telefono");
    });

    it("rechaza pageSize fuera de rango", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET(url("?pageSize=500"));
        expect(res.status).toBe(400);
    });
});

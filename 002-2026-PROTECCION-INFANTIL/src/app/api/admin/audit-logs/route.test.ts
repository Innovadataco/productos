import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("GET /api/admin/audit-logs", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    async function seedLogs() {
        const admin = await crearUsuario("ADMIN", "admin@audit.local");
        const operador = await crearUsuario("OPERADOR", "op@audit.local");
        const comite = await crearUsuario("COMITE_VALIDACION", "comite@audit.local");

        await prisma.auditLog.createMany({
            data: [
                {
                    accion: "OPERADOR_CREADO",
                    tipoRecurso: "usuario",
                    recursoId: operador.id,
                    usuarioId: admin.id,
                    valorNuevo: JSON.stringify({ rol: "OPERADOR" }),
                    ipAddress: "127.0.0.1",
                    userAgent: "test",
                },
                {
                    accion: "OPERADOR_ACTIVADO",
                    tipoRecurso: "usuario",
                    recursoId: operador.id,
                    usuarioId: admin.id,
                    valorNuevo: JSON.stringify({ estado: "activo" }),
                    ipAddress: "127.0.0.1",
                    userAgent: "test",
                },
                {
                    accion: "COMITE_CREADO",
                    tipoRecurso: "usuario",
                    recursoId: comite.id,
                    usuarioId: admin.id,
                    valorNuevo: JSON.stringify({ rol: "COMITE_VALIDACION" }),
                    ipAddress: "127.0.0.1",
                    userAgent: "test",
                },
                {
                    accion: "LOGIN",
                    tipoRecurso: "session",
                    usuarioId: admin.id,
                    ipAddress: "127.0.0.1",
                    userAgent: "test",
                },
            ],
        });

        return { admin, operador, comite };
    }

    it("retorna todos los campos requeridos para ADMIN", async () => {
        const { admin } = await seedLogs();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request("http://localhost:5005/api/admin/audit-logs"));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.length).toBeGreaterThan(0);

        const item = json.items[0];
        expect(item).toHaveProperty("accion");
        expect(item).toHaveProperty("tipoRecurso");
        expect(item).toHaveProperty("recursoId");
        expect(item).toHaveProperty("usuario");
        expect(item.usuario).toHaveProperty("nombre");
        expect(item.usuario).toHaveProperty("email");
        expect(item).toHaveProperty("creadoEn");
        expect(item).toHaveProperty("valorNuevo");
    });

    it("filtra por acciones múltiples (OPERADOR_*)", async () => {
        const { admin } = await seedLogs();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/audit-logs?acciones=OPERADOR_CREADO,OPERADOR_ACTIVADO")
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(2);
        expect(json.items.every((i: { accion: string }) => i.accion.startsWith("OPERADOR_"))).toBe(true);
    });

    it("filtra por acciones del comité (COMITE_*)", async () => {
        const { admin } = await seedLogs();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/audit-logs?acciones=COMITE_CREADO")
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].accion).toBe("COMITE_CREADO");
    });

    it("filtra por búsqueda de usuario (q)", async () => {
        const { admin } = await seedLogs();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/audit-logs?q=admin@audit.local")
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.length).toBeGreaterThan(0);
        expect(json.items.every((i: { usuario: { email: string } | null }) => i.usuario?.email === "admin@audit.local")).toBe(true);
    });

    it("filtra por recursoId", async () => {
        const { admin, operador } = await seedLogs();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/audit-logs?recursoId=${operador.id}`)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items.length).toBeGreaterThan(0);
        expect(json.items.every((i: { recursoId: string | null }) => i.recursoId === operador.id)).toBe(true);
    });

    it("pagina los resultados", async () => {
        const { admin } = await seedLogs();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(
            new Request("http://localhost:5005/api/admin/audit-logs?page=1&pageSize=2")
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(2);
        expect(json.pagination.page).toBe(1);
        expect(json.pagination.pageSize).toBe(2);
        expect(json.pagination.total).toBe(4);
        expect(json.pagination.totalPages).toBe(2);
    });

    it("rechaza si el usuario no es ADMIN", async () => {
        const parent = await crearUsuario("PARENT", "parent@audit.local");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await GET(new Request("http://localhost:5005/api/admin/audit-logs"));
        expect(res.status).toBe(403);
    });
});

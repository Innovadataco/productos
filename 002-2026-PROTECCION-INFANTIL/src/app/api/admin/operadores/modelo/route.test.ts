import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearParametrosReportes } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("/api/admin/operadores/modelo", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        mockToken = undefined;
    });

    it("GET devuelve el modelo actual", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(new Request("http://localhost:5005/api/admin/operadores/modelo"));
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.cupoMaximoDefault).toBe(10);
        expect(data.estrategia).toBe("ponderado_carga_inversa");
    });

    it("PATCH actualiza la configuración y registra audit", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await PATCH(
            new Request("http://localhost:5005/api/admin/operadores/modelo", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cupoMaximoDefault: 15, estrategia: "aleatorio_puro" }),
            })
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.cupoMaximoDefault).toBe(15);
        expect(data.estrategia).toBe("aleatorio_puro");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "CONFIGURACION_ASIGNACION_ACTUALIZADA" },
        });
        expect(audit).not.toBeNull();
        expect(audit?.usuarioId).toBe(admin.id);
    });

    it("rechaza valores inválidos", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await PATCH(
            new Request("http://localhost:5005/api/admin/operadores/modelo", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cupoMaximoDefault: 0, estrategia: "no_existe" }),
            })
        );
        expect(res.status).toBe(400);
    });

    it("rechaza si no es admin", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const res = await GET(new Request("http://localhost:5005/api/admin/operadores/modelo"));
        expect(res.status).toBe(403);
    });
});

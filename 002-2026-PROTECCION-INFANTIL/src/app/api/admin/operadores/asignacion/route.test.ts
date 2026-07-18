import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearParametrosReportes } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

describe("GET /api/admin/operadores/asignacion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        mockToken = undefined;
    });

    it("devuelve estado en vivo de asignación", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        await prisma.perfilOperador.create({ data: { usuarioId: operador.id, creadoPorId: admin.id, cupoMaximo: 5 } });

        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await prisma.reporte.createMany({
            data: [
                { identificador: "a", plataformaId: plataforma!.id, texto: "t", fechaIncidente: new Date(), ciudad: "Bogotá", pais: "Colombia", estado: "REVISION_MANUAL", esAnonimo: true },
                { identificador: "b", plataformaId: plataforma!.id, texto: "t", fechaIncidente: new Date(), ciudad: "Bogotá", pais: "Colombia", estado: "REVISION_MANUAL", esAnonimo: true, operadorId: operador.id },
            ],
        });

        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(new Request("http://localhost:5005/api/admin/operadores/asignacion"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.sinAsignar).toBe(1);
        expect(data.operadores).toHaveLength(1);
        expect(data.operadores[0].casosAbiertos).toBe(1);
        expect(data.operadores[0].cupoMaximo).toBe(5);
        expect(data.operadores[0].libre).toBe(4);
        expect(data.estrategia).toBe("ponderado_carga_inversa");
    });

    it("rechaza si no es admin", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const res = await GET(new Request("http://localhost:5005/api/admin/operadores/asignacion"));
        expect(res.status).toBe(403);
    });
});

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

describe("GET /api/admin/estadisticas/clasificacion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        mockToken = undefined;
    });

    it("devuelve indicadores y estructura vacía cuando no hay datos", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request("http://localhost:5005/api/admin/estadisticas/clasificacion"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.indicadores.sinAsignar).toBe(0);
        expect(data.indicadores.enGestion).toBe(0);
        expect(data.indicadores.atendidosHoy).toBe(0);
        expect(data.metricasOperador).toEqual([]);
        expect(data.tabla.reportes).toEqual([]);
    });

    it("cuenta casos sin asignar y en gestión", async () => {
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
        const res = await GET(new Request("http://localhost:5005/api/admin/estadisticas/clasificacion"));
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.indicadores.sinAsignar).toBe(1);
        expect(data.indicadores.enGestion).toBe(1);
    });

    it("rechaza si no es admin", async () => {
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const res = await GET(new Request("http://localhost:5005/api/admin/estadisticas/clasificacion"));
        expect(res.status).toBe(403);
    });
});

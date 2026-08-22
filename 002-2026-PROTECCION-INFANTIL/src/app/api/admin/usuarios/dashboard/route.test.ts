import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearParametrosReportes } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function getDashboard(token?: string) {
    return GET(
        new Request("http://localhost:5005/api/admin/usuarios/dashboard", {
            headers: token ? { cookie: `token=${token}` } : {},
        })
    );
}

describe("GET /api/admin/usuarios/dashboard", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const res = await getDashboard();
        expect(res.status).toBe(401);
    });

    it("devuelve 403 para un token PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await getDashboard(mockToken);
        expect(res.status).toBe(403);
    });

    it("devuelve 5 tarjetas KPI y alertas", async () => {
        const admin = await crearUsuario("ADMIN");
        await crearUsuario("PARENT", "padre1@example.com");
        await crearUsuario("PARENT", "padre2@example.com");
        await crearUsuario("OPERADOR", "op@example.com");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getDashboard(mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.kpi).toHaveLength(5);
        expect(json.kpi.map((k: { key: string }) => k.key)).toEqual([
            "padres",
            "rectores",
            "operadores",
            "comite",
            "admins",
        ]);

        const padres = json.kpi.find((k: { key: string }) => k.key === "padres");
        expect(padres.total).toBe(2);
        expect(padres.activos).toBe(2);

        const operadores = json.kpi.find((k: { key: string }) => k.key === "operadores");
        expect(operadores.total).toBe(1);

        expect(Array.isArray(json.alertas)).toBe(true);
    });

    it("alerta cuando un operador está al cupo", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        await prisma.perfilOperador.create({ data: { usuarioId: operador.id, creadoPorId: admin.id, cupoMaximo: 1 } });
        const plataforma = await crearPlataforma();
        await prisma.reporte.create({
            data: {
                identificador: "a",
                plataformaId: plataforma.id,
                texto: "t",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                estado: "REVISION_MANUAL",
                esAnonimo: true,
                operadorId: operador.id,
            },
        });

        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getDashboard(mockToken);
        const json = await res.json();

        const alerta = json.alertas.find((a: { tipo: string }) => a.tipo === "operadores_sobrecargados");
        expect(alerta).toBeDefined();
        expect(json.kpi.find((k: { key: string }) => k.key === "operadores").alerta).toBe(true);
    });
});

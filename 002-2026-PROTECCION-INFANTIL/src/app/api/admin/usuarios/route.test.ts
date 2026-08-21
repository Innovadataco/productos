import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function getUsuarios(url: string) {
    return GET(
        new Request(`http://localhost:5005/api/admin/usuarios${url}`, {
            headers: mockToken ? { cookie: `token=${mockToken}` } : {},
        })
    );
}

async function crearReporteParaUsuario(usuarioId: string, eliminado = false) {
    const plataforma = await crearPlataforma();
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Math.floor(Math.random() * 1e7)}`,
            plataformaId: plataforma.id,
            texto: "Texto de reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            usuarioId,
            eliminado,
        },
    });
}

describe("GET /api/admin/usuarios", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const res = await getUsuarios("");
        expect(res.status).toBe(401);
    });

    it("devuelve 403 para un token PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await getUsuarios("");
        expect(res.status).toBe(403);
    });

    it("lista solo cuentas PARENT por defecto con conteo de reportes", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre1@example.com");
        await crearUsuario("PARENT", "padre2@example.com");
        await crearUsuario("OPERADOR", "op@example.com");
        await crearReporteParaUsuario(padre.id);
        await crearReporteParaUsuario(padre.id, true);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getUsuarios("");
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.items).toHaveLength(2);
        expect(json.items.every((u: { email: string }) => u.email.startsWith("padre"))).toBe(true);

        const item = json.items.find((u: { id: string }) => u.id === padre.id);
        expect(item).toMatchObject({ email: "padre1@example.com", estado: "activo", reportesEnviados: 1 });
        expect(item.colegiosAsociados).toEqual([]);

        expect(JSON.stringify(json)).not.toContain("Texto de reporte de prueba");
        expect(JSON.stringify(json)).not.toContain("+57300");
    });

    it("filtra por estado y con/sin reportes", async () => {
        const admin = await crearUsuario("ADMIN");
        const padreConReporte = await crearUsuario("PARENT", "con@example.com");
        await crearUsuario("PARENT", "sin@example.com");
        await crearReporteParaUsuario(padreConReporte.id);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const con = await (await getUsuarios("?conReportes=true")).json();
        expect(con.items).toHaveLength(1);
        expect(con.items[0].email).toBe("con@example.com");

        const sin = await (await getUsuarios("?conReportes=false")).json();
        expect(sin.items).toHaveLength(1);
        expect(sin.items[0].email).toBe("sin@example.com");
    });

    it("rechaza pageSize > 100", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getUsuarios("?pageSize=101");
        expect(res.status).toBe(400);
    });
});

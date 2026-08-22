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

function getUsuarios(url: string, token?: string) {
    return GET(
        new Request(`http://localhost:5005/api/admin/usuarios${url}`, {
            headers: token ? { cookie: `token=${token}` } : {},
        })
    );
}

async function crearReporteParaUsuario(usuarioId: string, eliminado = false, diasAtras = 0) {
    const plataforma = await crearPlataforma();
    const creadoEn = new Date();
    creadoEn.setDate(creadoEn.getDate() - diasAtras);
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
            creadoEn,
        },
    });
}

describe("GET /api/admin/usuarios", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
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
        expect(item).toMatchObject({ email: "padre1@example.com", estado: "activo", reportesEnviados: 1, reportesUltimos30Dias: 1 });
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

        const con = await (await getUsuarios("?conReportes=true", mockToken)).json();
        expect(con.items).toHaveLength(1);
        expect(con.items[0].email).toBe("con@example.com");

        const sin = await (await getUsuarios("?conReportes=false", mockToken)).json();
        expect(sin.items).toHaveLength(1);
        expect(sin.items[0].email).toBe("sin@example.com");
    });

    it("rechaza pageSize > 100", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getUsuarios("?pageSize=101", mockToken);
        expect(res.status).toBe(400);
    });

    it("lista operadores con los mismos conteos que /operadores/asignacion", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        await prisma.perfilOperador.create({ data: { usuarioId: operador.id, creadoPorId: admin.id, cupoMaximo: 5 } });
        const plataforma = await crearPlataforma();
        await prisma.reporte.createMany({
            data: [
                { identificador: "a", plataformaId: plataforma.id, texto: "t", fechaIncidente: new Date(), ciudad: "Bogotá", pais: "Colombia", estado: "REVISION_MANUAL", esAnonimo: true },
                { identificador: "b", plataformaId: plataforma.id, texto: "t", fechaIncidente: new Date(), ciudad: "Bogotá", pais: "Colombia", estado: "REVISION_MANUAL", esAnonimo: true, operadorId: operador.id },
            ],
        });

        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getUsuarios("?rol=OPERADOR", mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.items).toHaveLength(1);
        expect(json.items[0].casosAbiertos).toBe(1);
        expect(json.items[0].cupoMaximo).toBe(5);
        expect(json.pagination.total).toBe(1);
    });

    it("lista comités de convivencia con métricas del colegio", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await import("@/lib/reporte-test-utils").then((m) => m.crearColegioConAdmin());
        const comite = await prisma.usuario.create({
            data: {
                email: "comite@example.com",
                nombre: "Comité",
                passwordHash: "x",
                rol: "COMITE_CONVIVENCIA",
                estado: "activo",
                comiteColegioId: colegio.id,
            },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getUsuarios("?rol=COMITE_CONVIVENCIA", mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.items).toHaveLength(1);
        expect(json.items[0].id).toBe(comite.id);
        expect(json.items[0].colegio.id).toBe(colegio.id);
    });
});

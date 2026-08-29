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

function getPadres(url: string) {
    return GET(
        new Request(`http://localhost:5005/api/admin/padres${url}`, {
            headers: mockToken ? { cookie: `token=${mockToken}` } : {},
        })
    );
}

async function crearReporteParaPadre(usuarioId: string, eliminado = false) {
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

describe("GET /api/admin/padres", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const res = await getPadres("");
        expect(res.status).toBe(401);
    });

    it("devuelve 403 para un token PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await getPadres("");
        expect(res.status).toBe(403);
    });

    it("devuelve 403 para un token OPERADOR", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const res = await getPadres("");
        expect(res.status).toBe(403);
    });

    it("lista solo cuentas PARENT con campos de cuenta y conteo agregado de reportes", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre1@example.com");
        await crearUsuario("PARENT", "padre2@example.com");
        await crearUsuario("OPERADOR", "op@example.com");
        await crearReporteParaPadre(padre.id);
        await crearReporteParaPadre(padre.id, true); // eliminado: no cuenta
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getPadres("");
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.items).toHaveLength(2);
        expect(json.items.every((p: { email: string }) => p.email.startsWith("padre"))).toBe(true);
        expect(json.pagination).toMatchObject({ page: 1, pageSize: 25, total: 2, totalPages: 1 });

        const item = json.items.find((p: { id: string }) => p.id === padre.id);
        expect(item).toMatchObject({ email: "padre1@example.com", estado: "activo", debeCambiarPassword: false, reportes: 1 });
        expect(item.creadoEn).toBeDefined();

        // Privacidad: nunca textos de reportes ni identificadores reportados
        expect(JSON.stringify(json)).not.toContain("Texto de reporte de prueba");
        expect(JSON.stringify(json)).not.toContain("+57300");
    });

    it("filtra por email o nombre con q (case-insensitive)", async () => {
        const admin = await crearUsuario("ADMIN");
        await prisma.usuario.create({
            data: { email: "ana@example.com", nombre: "Ana Lopez", passwordHash: "x", rol: "PARENT", estado: "activo" },
        });
        await prisma.usuario.create({
            data: { email: "luis@example.com", nombre: "Luis Perez", passwordHash: "x", rol: "PARENT", estado: "activo" },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const porEmail = await (await getPadres("?q=LUIS@")).json();
        expect(porEmail.items).toHaveLength(1);
        expect(porEmail.items[0].email).toBe("luis@example.com");

        const porNombre = await (await getPadres("?q=ana l")).json();
        expect(porNombre.items).toHaveLength(1);
        expect(porNombre.items[0].nombre).toBe("Ana Lopez");
    });

    it("pagina con page/pageSize y rechaza pageSize>100", async () => {
        const admin = await crearUsuario("ADMIN");
        for (let i = 1; i <= 3; i++) {
            await crearUsuario("PARENT", `padre-pag-${i}@example.com`);
        }
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const pagina2 = await (await getPadres("?page=2&pageSize=2")).json();
        expect(pagina2.items).toHaveLength(1);
        expect(pagina2.pagination).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });

        const res = await getPadres("?pageSize=101");
        expect(res.status).toBe(400);
    });
});

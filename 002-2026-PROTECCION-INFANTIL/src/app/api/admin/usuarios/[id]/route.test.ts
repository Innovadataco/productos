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

function getUsuario(id: string, token?: string) {
    return GET(
        new Request(`http://localhost:5005/api/admin/usuarios/${id}`, {
            headers: token ? { cookie: `token=${token}` } : {},
        }),
        { params: Promise.resolve({ id }) }
    );
}

async function crearReporteParaUsuario(usuarioId: string) {
    const plataforma = await crearPlataforma();
    return prisma.reporte.create({
        data: {
            identificador: "+573001234567",
            plataformaId: plataforma.id,
            texto: "Texto de reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            usuarioId,
        },
    });
}

describe("GET /api/admin/usuarios/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const padre = await crearUsuario("PARENT");
        const res = await getUsuario(padre.id);
        expect(res.status).toBe(401);
    });

    it("devuelve detalle de PARENT con metadatos de reportes", async () => {
        const admin = await crearUsuario("ADMIN");
        const padre = await crearUsuario("PARENT", "padre@example.com");
        await crearReporteParaUsuario(padre.id);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getUsuario(padre.id, mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.rol).toBe("PARENT");
        expect(json.email).toBe("padre@example.com");
        expect(json.reportes.total).toBe(1);
        expect(json.reportes.items[0].estado).toBeDefined();
        expect(json.reportes.items[0].plataforma).toBeDefined();

        expect(JSON.stringify(json)).not.toContain("Texto de reporte de prueba");
        expect(JSON.stringify(json)).not.toContain("+57300");
    });

    it("devuelve detalle de OPERADOR con métricas", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "op@example.com");
        await prisma.perfilOperador.create({ data: { usuarioId: operador.id, creadoPorId: admin.id, cupoMaximo: 5 } });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getUsuario(operador.id, mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.rol).toBe("OPERADOR");
        expect(json.cupoMaximo).toBe(5);
        expect(Array.isArray(json.casosAbiertos)).toBe(true);
        expect(json.totalAbiertos).toBe(0);
    });

    it("devuelve detalle de SCHOOL_ADMIN con colegio", async () => {
        const admin = await crearUsuario("ADMIN");
        const { admin: rector } = await import("@/lib/reporte-test-utils").then((m) => m.crearColegioConAdmin());
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getUsuario(rector.id, mockToken);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.rol).toBe("SCHOOL_ADMIN");
        expect(json.colegios).toHaveLength(1);
        expect(json.colegios[0].alumnos).toBe(0);
    });

    it("devuelve 404 para usuario inexistente", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getUsuario("c000000000000000000000000", mockToken);
        expect(res.status).toBe(404);
    });
});

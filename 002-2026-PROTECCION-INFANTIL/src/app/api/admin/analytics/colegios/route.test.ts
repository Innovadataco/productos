import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearProfesor,
    crearPlataforma,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function getColegios(url: string) {
    return GET(
        new Request(`http://localhost:5005/api/admin/analytics/colegios${url}`, {
            headers: mockToken ? { cookie: `token=${mockToken}` } : {},
        })
    );
}

async function crearReporteParaTenant(tenantId: string) {
    const plataforma = await crearPlataforma();
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Math.floor(Math.random() * 1e7)}`,
            plataformaId: plataforma.id,
            texto: "Texto de reporte de prueba",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            tenantId,
            eliminado: false,
        },
    });
}

describe("GET /api/admin/analytics/colegios", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const res = await getColegios("");
        expect(res.status).toBe(401);
    });

    it("devuelve 403 para PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await getColegios("");
        expect(res.status).toBe(403);
    });

    it("devuelve resumen con métricas agregadas y semáforo", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio, tenant } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        await crearEstudiante(curso.id, colegio.id);
        await crearProfesor(colegio.id);
        await crearReporteParaTenant(tenant.id);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getColegios("");
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.items).toHaveLength(1);
        const item = json.items[0];
        expect(item.id).toBe(colegio.id);
        expect(item.alumnos).toBe(1);
        expect(item.profesores).toBe(1);
        expect(item.reportesTotal).toBe(1);
        expect(item.reportesUltimos30Dias).toBe(1);
        expect(["verde", "amarillo", "rojo"]).toContain(item.semaforo);

        expect(JSON.stringify(json)).not.toContain("Texto de reporte de prueba");
    });

    it("busca por nombre", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio } = await crearColegioConAdmin();
        await prisma.colegio.update({ where: { id: colegio.id }, data: { nombre: "Colegio Especial" } });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getColegios("?q=Especial");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].nombre).toBe("Colegio Especial");
    });
});

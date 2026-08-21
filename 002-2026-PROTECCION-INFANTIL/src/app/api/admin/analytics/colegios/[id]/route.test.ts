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

function getColegio(id: string) {
    return GET(
        new Request(`http://localhost:5005/api/admin/analytics/colegios/${id}`, {
            headers: mockToken ? { cookie: `token=${mockToken}` } : {},
        }),
        { params: Promise.resolve({ id }) }
    );
}

async function crearReporteParaTenant(tenantId: string) {
    const plataforma = await crearPlataforma();
    return prisma.reporte.create({
        data: {
            identificador: "+573001234567",
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

describe("GET /api/admin/analytics/colegios/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve 401 sin token", async () => {
        const { colegio } = await crearColegioConAdmin();
        const res = await getColegio(colegio.id);
        expect(res.status).toBe(401);
    });

    it("devuelve ficha con 7 secciones y sin PII", async () => {
        const admin = await crearUsuario("ADMIN");
        const { colegio, tenant } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        await crearEstudiante(curso.id, colegio.id);
        await crearProfesor(colegio.id);
        await crearReporteParaTenant(tenant.id);
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await getColegio(colegio.id);
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.id).toBe(colegio.id);
        expect(json.infoBasica).toBeDefined();
        expect(json.metricasTamaño).toBeDefined();
        expect(json.actividadReportes).toBeDefined();
        expect(json.comite).toBeDefined();
        expect(json.alertas).toBeDefined();
        expect(json.hallazgos).toBeDefined();
        expect(json.comparacionMedia).toBeDefined();

        expect(JSON.stringify(json)).not.toContain("Texto de reporte de prueba");
    });

    it("devuelve 404 para colegio inexistente", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await getColegio("c000000000000000000000000");
        expect(res.status).toBe(404);
    });
});

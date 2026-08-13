/**
 * SPEC-169 (Fase G): tests de GET /api/colegio/cobertura.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearPlataforma,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { method, headers });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/cobertura", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET devuelve porcentajes y conteos por tipo de sujeto", async () => {
        await setupSchoolAdmin();
        const res = await GET(request("GET", "http://localhost:5005/api/colegio/cobertura", mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.cobertura.estudiantes).toMatchObject({ total: 0, conIdentificador: 0, porcentaje: 0 });
        expect(json.cobertura.profesores).toMatchObject({ total: 0, conIdentificador: 0, porcentaje: 0 });
        expect(json.cobertura.acudientes).toMatchObject({ total: 0, conIdentificador: 0, porcentaje: 0 });
    });

    it("refleja cobertura real de estudiantes", async () => {
        const { colegio } = await setupSchoolAdmin();
        const plataforma = await crearPlataforma();
        const curso = await crearCurso(colegio.id);
        const e1 = await crearEstudiante(curso.id, colegio.id);
        const e2 = await crearEstudiante(curso.id, colegio.id);
        await crearIdentificadorEstudiante(e1.id, { plataformaId: plataforma.id, estado: "activo" });

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/cobertura", mockToken));
        const json = await res.json();
        expect(json.cobertura.estudiantes.total).toBe(2);
        expect(json.cobertura.estudiantes.conIdentificador).toBe(1);
        expect(json.cobertura.estudiantes.porcentaje).toBe(0.5);
    });

    it("sin sesión devuelve 401", async () => {
        await setupSchoolAdmin();
        mockToken = undefined;
        const res = await GET(request("GET", "http://localhost:5005/api/colegio/cobertura"));
        expect(res.status).toBe(401);
    });
});

/**
 * SPEC-148 (T002, FR-003): tests de GET /api/colegio/buscar.
 * A/B con dos colegios: B nunca ve lo de A. Solo activos, mínimo 2 caracteres,
 * resultados agrupados. Roles ajenos (ADMIN/PARENT) reciben 403.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearUsuario,
    crearCurso,
    crearEstudiante,
    crearProfesor,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { method: "GET", headers });
}

const URL_BASE = "http://localhost:5005/api/colegio/buscar";

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/buscar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve resultados agrupados del propio colegio con contexto mínimo", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "Ana", apellidos: "Torres" });
        const curso = await crearCurso(colegio.id, { nombre: "Séptimo A", profesorTitularId: profesor.id });
        const estudiante = await crearEstudiante(curso.id, colegio.id, { nombre: "Ana", apellidos: "Ruiz" });

        const res = await GET(request(`${URL_BASE}?q=ana`, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.estudiantes).toEqual([{ id: estudiante.id, nombre: "Ana", apellidos: "Ruiz", curso: "Séptimo A" }]);
        expect(json.profesores).toEqual([{ id: profesor.id, nombre: "Ana", apellidos: "Torres" }]);
        expect(json.restantes).toEqual({ estudiantes: 0, cursos: 0, profesores: 0 });

        const resCurso = await GET(request(`${URL_BASE}?q=séptimo`, mockToken));
        const jsonCurso = await resCurso.json();
        expect(jsonCurso.cursos).toEqual([{ id: curso.id, nombre: "Séptimo A", titular: "Ana Torres" }]);
    });

    it("A/B: el colegio B nunca recibe resultados del colegio A", async () => {
        const { colegio: colegioA } = await setupSchoolAdmin();
        const cursoA = await crearCurso(colegioA.id, { nombre: "Séptimo A" });
        await crearEstudiante(cursoA.id, colegioA.id, { nombre: "Ana", apellidos: "De A" });
        await crearProfesor(colegioA.id, { nombre: "Ana", apellidos: "De A" });

        const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();
        const cursoB = await crearCurso(colegioB.id, { nombre: "Séptimo B" });
        await crearEstudiante(cursoB.id, colegioB.id, { nombre: "Ana", apellidos: "De B" });
        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");

        const res = await GET(request(`${URL_BASE}?q=ana`, mockToken));
        const json = await res.json();
        expect(json.estudiantes).toHaveLength(1);
        expect(json.estudiantes[0].apellidos).toBe("De B");
        expect(json.profesores).toEqual([]);
    });

    it("menos de 2 caracteres responde 200 con grupos vacíos", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "Séptimo A" });
        await crearEstudiante(curso.id, colegio.id, { nombre: "Ana", apellidos: "Ruiz" });

        for (const q of ["", "a"]) {
            const res = await GET(request(`${URL_BASE}?q=${q}`, mockToken));
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.estudiantes).toEqual([]);
            expect(json.cursos).toEqual([]);
            expect(json.profesores).toEqual([]);
        }
    });

    it("solo activos: la profesora dada de baja no aparece en la búsqueda", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearProfesor(colegio.id, { nombre: "Ana", apellidos: "Inactiva", estado: "inactivo" });

        const res = await GET(request(`${URL_BASE}?q=ana`, mockToken));
        const json = await res.json();
        expect(json.profesores).toEqual([]);
    });

    it("ADMIN no puede usar el buscador del colegio", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(request(`${URL_BASE}?q=ana`, mockToken));
        expect(res.status).toBe(403);
    });

    it("PARENT no puede usar el buscador del colegio", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await GET(request(`${URL_BASE}?q=ana`, mockToken));
        expect(res.status).toBe(403);
    });
});

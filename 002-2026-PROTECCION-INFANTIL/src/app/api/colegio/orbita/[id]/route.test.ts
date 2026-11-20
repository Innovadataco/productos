/**
 * SPEC-965 — tests de GET /api/colegio/orbita/[id] (capa 2 del overview Órbita).
 * Muro del panel del colegio (401 sin sesión), tenant (404 curso de otro colegio) y forma del DTO.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearCurso, crearEstudiante } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

function request(url: string, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { method: "GET", headers });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/orbita/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET devuelve la capa 2 del curso: mirada (sin contacto → ámbar) + resto en calma", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "A-1" });
        await crearEstudiante(curso.id, colegio.id); // sin acudiente → sin_contacto

        const res = await GET(request(`http://localhost:5005/api/colegio/orbita/${curso.id}`, mockToken), {
            params: Promise.resolve({ id: curso.id }),
        });
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.curso.alumnosMirada).toHaveLength(1);
        expect(json.curso.alumnosMirada[0].riesgo).toBe("sin_contacto");
        expect(json.curso.restoEnCalma).toBe(0);
        expect(json.curso.curso.color).toBe("pino"); // 0 reportes → pino
    });

    it("sin sesión devuelve 401", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "A-1" });
        mockToken = undefined;
        const res = await GET(request(`http://localhost:5005/api/colegio/orbita/${curso.id}`), {
            params: Promise.resolve({ id: curso.id }),
        });
        expect(res.status).toBe(401);
    });

    it("curso de OTRO colegio → 404 (tenant)", async () => {
        await setupSchoolAdmin(); // sesión del colegio A
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "B-1" });
        const res = await GET(request(`http://localhost:5005/api/colegio/orbita/${cursoB.id}`, mockToken), {
            params: Promise.resolve({ id: cursoB.id }),
        });
        expect(res.status).toBe(404);
    });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { DELETE as DELETEVinculo } from "./[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearUsuario, crearCurso, crearProfesor } from "@/lib/reporte-test-utils";
import { MateriaRepository } from "@/lib/dal/repositories/materia";
import { CursoMateriaRepository } from "@/lib/dal/repositories/curso-materia";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function request(method: string, url: string, body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/cursos/[cursoId]/materias", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN lista y asigna materias a un curso propio", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const materia = await new MateriaRepository().crear(colegio.id, "Matemáticas");
        const profesor = await crearProfesor(colegio.id, { nombre: "Ana", apellidos: "López" });

        const getRes = await GET(
            request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, undefined, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(getRes.status).toBe(200);
        expect((await getRes.json()).materias).toHaveLength(0);

        const postRes = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, { materiaId: materia.id, profesorId: profesor.id }, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.vinculo.materia.nombre).toBe("Matemáticas");
        expect(postJson.vinculo.profesor.nombre).toBe("Ana");

        const getRes2 = await GET(
            request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, undefined, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect((await getRes2.json()).materias).toHaveLength(1);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CURSO_MATERIA_CREADA", recursoId: postJson.vinculo.id },
        });
        expect(audit).not.toBeNull();
    });

    it("rechaza asignar materia duplicada al curso", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const materia = await new MateriaRepository().crear(colegio.id, "Matemáticas");
        await new CursoMateriaRepository().crear(colegio.id, { cursoId: curso.id, materiaId: materia.id });

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, { materiaId: materia.id }, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(res.status).toBe(409);
    });

    it("rechaza asignar materia de otro colegio", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const materiaAjena = await new MateriaRepository().crear(otroColegio.id, "Matemáticas");

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, { materiaId: materiaAjena.id }, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("rechaza asignar profesor de otro colegio", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const materia = await new MateriaRepository().crear(colegio.id, "Matemáticas");
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const profesorAjeno = await crearProfesor(otroColegio.id, { nombre: "Ana", apellidos: "López" });

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, { materiaId: materia.id, profesorId: profesorAjeno.id }, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN desasigna una materia de su curso", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const materia = await new MateriaRepository().crear(colegio.id, "Matemáticas");
        const vinculo = await new CursoMateriaRepository().crear(colegio.id, { cursoId: curso.id, materiaId: materia.id });

        const res = await DELETEVinculo(
            request("DELETE", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias/${vinculo.id}`, undefined, mockToken),
            { params: Promise.resolve({ cursoId: curso.id, id: vinculo.id }) }
        );
        expect(res.status).toBe(200);
        expect((await res.json()).vinculo.estado).toBe("inactivo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CURSO_MATERIA_DESACTIVADA", recursoId: vinculo.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN de otro colegio no accede al curso ajeno", async () => {
        const { admin: admin1, colegio: colegio1 } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio1.id, { nombre: "6A" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const getRes = await GET(
            request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, undefined, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(getRes.status).toBe(404);

        const postRes = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, { materiaId: "cm0000000000000000000000" }, mockToken),
            { params: Promise.resolve({ cursoId: curso.id }) }
        );
        expect(postRes.status).toBe(404);
    });

    it("ADMIN y PARENT no pueden acceder", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });

        for (const rol of ["ADMIN", "PARENT"] as const) {
            const u = await crearUsuario(rol);
            mockToken = await crearTokenUsuario(u.id, rol);
            const res = await GET(
                request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/materias`, undefined, mockToken),
                { params: Promise.resolve({ cursoId: curso.id }) }
            );
            expect(res.status).toBe(403);
        }
    });
});

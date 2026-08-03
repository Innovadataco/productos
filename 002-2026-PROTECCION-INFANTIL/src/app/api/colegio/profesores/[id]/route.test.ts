/**
 * SPEC-145 (FR-005/006/008/009/014): tests de GET/PATCH /api/colegio/profesores/[id]
 * y de la asignación curso↔profesor (D1=A):
 *  - CONDICIÓN 1: asignar a un curso de A un profesor de B DEBE fallar (POST y PATCH).
 *  - CONDICIÓN 2: la baja suave del titular CONSERVA `profesorTitularId` en el curso.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { POST as POSTCurso } from "../../cursos/route";
import { PATCH as PATCHCurso } from "../../cursos/[id]/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearCurso, crearProfesor } from "@/lib/reporte-test-utils";

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

describe("/api/colegio/profesores/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("GET devuelve el profesor propio por id", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await GET(
            request("GET", `http://localhost:5005/api/colegio/profesores/${profesor.id}`, undefined, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.profesor.id).toBe(profesor.id);
    });

    it("GET de un profesor de OTRO colegio devuelve 404 (A/B)", async () => {
        await setupSchoolAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const profesorB = await crearProfesor(colegioB.id, { nombre: "Carlos", apellidos: "Gómez" });

        const res = await GET(
            request("GET", `http://localhost:5005/api/colegio/profesores/${profesorB.id}`, undefined, mockToken),
            { params: Promise.resolve({ id: profesorB.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("PATCH edita campos del profesor propio y audita COLEGIO_PROFESOR_EDITADO", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await PATCH(
            request("PATCH", `http://localhost:5005/api/colegio/profesores/${profesor.id}`, { telefono: "+573009998877" }, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.profesor.telefono).toBe("+573009998877");
        expect(json.profesor.nombre).toBe("María");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_PROFESOR_EDITADO", recursoId: profesor.id },
        });
        expect(audit).not.toBeNull();
    });

    it("PATCH de un profesor de OTRO colegio devuelve 404 y no toca la fila (A/B)", async () => {
        await setupSchoolAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const profesorB = await crearProfesor(colegioB.id, { nombre: "Carlos", apellidos: "Gómez" });

        const res = await PATCH(
            request("PATCH", `http://localhost:5005/api/colegio/profesores/${profesorB.id}`, { nombre: "Hackeado" }, mockToken),
            { params: Promise.resolve({ id: profesorB.id }) }
        );
        expect(res.status).toBe(404);

        const intacto = await prisma.profesor.findUniqueOrThrow({ where: { id: profesorB.id } });
        expect(intacto.nombre).toBe("Carlos");
    });

    it("PATCH con estado 'inactivo' es baja suave: la fila EXISTE y audita COLEGIO_PROFESOR_DESACTIVADO", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await PATCH(
            request("PATCH", `http://localhost:5005/api/colegio/profesores/${profesor.id}`, { estado: "inactivo" }, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.profesor.estado).toBe("inactivo");

        const fila = await prisma.profesor.findUnique({ where: { id: profesor.id } });
        expect(fila, "soft delete: la fila sigue en BD").not.toBeNull();
        expect(fila?.estado).toBe("inactivo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_PROFESOR_DESACTIVADO", recursoId: profesor.id },
        });
        expect(audit).not.toBeNull();
    });

    it("PATCH con estado inválido devuelve 400", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await PATCH(
            request("PATCH", `http://localhost:5005/api/colegio/profesores/${profesor.id}`, { estado: "suspendido" }, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(400);
    });

    it("PATCH con email inválido devuelve 400", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await PATCH(
            request("PATCH", `http://localhost:5005/api/colegio/profesores/${profesor.id}`, { email: "no-es-email" }, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(400);
    });

    it("PATCH de profesor inexistente devuelve 404", async () => {
        await setupSchoolAdmin();

        const res = await PATCH(
            request("PATCH", "http://localhost:5005/api/colegio/profesores/cm0k5example12345678901234567890", { telefono: "+573001112233" }, mockToken),
            { params: Promise.resolve({ id: "cm0k5example12345678901234567890" }) }
        );
        expect(res.status).toBe(404);
    });
});

describe("asignación curso↔profesor (D1=A, COND-1/COND-2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("POST /api/colegio/cursos asigna un titular del MISMO colegio", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });

        const res = await POSTCurso(
            request("POST", "http://localhost:5005/api/colegio/cursos", { nombre: "6A", profesorTitularId: profesor.id }, mockToken)
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.curso.profesorTitularId).toBe(profesor.id);
    });

    it("CONDICIÓN 1 — POST: asignar a un curso de A un profesor de B DEBE fallar", async () => {
        await setupSchoolAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const profesorB = await crearProfesor(colegioB.id, { nombre: "Carlos", apellidos: "Gómez" });

        const res = await POSTCurso(
            request("POST", "http://localhost:5005/api/colegio/cursos", { nombre: "6A", profesorTitularId: profesorB.id }, mockToken)
        );
        expect(res.status, "cross-tenant: nunca 201").toBe(404);

        // Y no quedó ningún curso creado con ese titular ajeno.
        const fugas = await prisma.curso.count({ where: { profesorTitularId: profesorB.id } });
        expect(fugas).toBe(0);
    });

    it("CONDICIÓN 1 — PATCH: asignar a un curso de A un profesor de B DEBE fallar", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const { colegio: colegioB } = await crearColegioConAdmin();
        const profesorB = await crearProfesor(colegioB.id, { nombre: "Carlos", apellidos: "Gómez" });

        const res = await PATCHCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}`, { profesorTitularId: profesorB.id }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(res.status, "cross-tenant: nunca 200").toBe(404);

        const intacto = await prisma.curso.findUniqueOrThrow({ where: { id: curso.id } });
        expect(intacto.profesorTitularId).toBeNull();
    });

    it("PATCH con profesorTitularId inexistente devuelve 404", async () => {
        const { colegio } = await setupSchoolAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });

        const res = await PATCHCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}`, { profesorTitularId: "cm0k5example12345678901234567890" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("PATCH con profesorTitularId null desasigna explícitamente", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });
        const curso = await crearCurso(colegio.id, { nombre: "6A", profesorTitularId: profesor.id });

        const res = await PATCHCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}`, { profesorTitularId: null }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.curso.profesorTitularId).toBeNull();
    });

    it("CONDICIÓN 2 (FR-014): la baja suave del titular CONSERVA profesorTitularId en el curso", async () => {
        const { colegio } = await setupSchoolAdmin();
        const profesor = await crearProfesor(colegio.id, { nombre: "María", apellidos: "López" });
        const curso = await crearCurso(colegio.id, { nombre: "6A", profesorTitularId: profesor.id });

        // Baja suave del titular: NO se bloquea y NO se anula la asignación.
        const res = await PATCH(
            request("PATCH", `http://localhost:5005/api/colegio/profesores/${profesor.id}`, { estado: "inactivo" }, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status, "la baja del titular no se bloquea").toBe(200);

        const cursoTras = await prisma.curso.findUniqueOrThrow({ where: { id: curso.id } });
        expect(cursoTras.profesorTitularId, "el titular histórico se conserva (información forense)").toBe(profesor.id);

        const profesorTras = await prisma.profesor.findUniqueOrThrow({ where: { id: profesor.id } });
        expect(profesorTras.estado).toBe("inactivo");
    });
});

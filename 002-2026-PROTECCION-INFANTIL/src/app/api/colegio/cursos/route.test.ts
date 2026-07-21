import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHCurso } from "./[id]/route";
import { PATCH as PATCHEstadoCurso } from "./[id]/estado/route";
import { GET as GETAlumnos, POST as POSTAlumno } from "./[id]/alumnos/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearUsuario, crearCurso, crearAlumno } from "@/lib/reporte-test-utils";

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
        body: body ? JSON.stringify(body) : undefined,
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

describe("/api/colegio/cursos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN crea y lista cursos de su colegio", async () => {
        const { colegio } = await setupSchoolAdmin();

        const postRes = await POST(request("POST", "http://localhost:5005/api/colegio/cursos", { nombre: "6A", grado: "Sexto", anioLectivo: "2026" }, mockToken));
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.curso.nombre).toBe("6A");
        expect(postJson.curso.colegioId).toBe(colegio.id);

        const getRes = await GET(request("GET", "http://localhost:5005/api/colegio/cursos", undefined, mockToken));
        expect(getRes.status).toBe(200);
        const getJson = await getRes.json();
        expect(getJson.cursos).toHaveLength(1);
        expect(getJson.cursos[0].nombre).toBe("6A");
    });

    it("rechaza crear curso con nombre duplicado en el mismo colegio", async () => {
        await setupSchoolAdmin();

        await POST(request("POST", "http://localhost:5005/api/colegio/cursos", { nombre: "6A" }, mockToken));
        const res = await POST(request("POST", "http://localhost:5005/api/colegio/cursos", { nombre: "6A" }, mockToken));

        expect(res.status).toBe(409);
    });

    it("SCHOOL_ADMIN edita un curso propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "7B" });

        const res = await PATCHCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}`, { nombre: "7B - Matemáticas" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.curso.nombre).toBe("7B - Matemáticas");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_CURSO_EDITADO", recursoId: curso.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un curso propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "8C" });

        const res = await PATCHEstadoCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.curso.estado).toBe("inactivo");
    });

    it("rechaza desactivar un curso ya inactivo", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "9D", estado: "inactivo" });

        const res = await PATCHEstadoCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(409);
    });

    it("SCHOOL_ADMIN de otro colegio no ve ni muta cursos ajenos", async () => {
        const { admin: admin1 } = await setupSchoolAdmin();
        const curso = await crearCurso(admin1.colegioId!, { nombre: "Otro" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const getRes = await GET(request("GET", "http://localhost:5005/api/colegio/cursos", undefined, mockToken));
        const getJson = await getRes.json();
        expect(getJson.cursos).toHaveLength(0);

        const patchRes = await PATCHCurso(
            request("PATCH", `http://localhost:5005/api/colegio/cursos/${curso.id}`, { nombre: "Hackeado" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(patchRes.status).toBe(404);
    });

    it("ADMIN no puede acceder a /api/colegio/cursos", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/cursos", undefined, mockToken));
        expect(res.status).toBe(403);
    });

    it("PARENT no puede acceder a /api/colegio/cursos", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/cursos", undefined, mockToken));
        expect(res.status).toBe(403);
    });

    it("SCHOOL_ADMIN con colegio vencido recibe 403", async () => {
        const { admin, colegio } = await setupSchoolAdmin();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.colegio.update({
            where: { id: colegio.id },
            data: { finServicio: ayer },
        });

        const res = await GET(request("GET", "http://localhost:5005/api/colegio/cursos", undefined, mockToken));
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.error.code).toBe("FORBIDDEN");
    });
});

describe("/api/colegio/cursos/[id]/alumnos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN crea y lista alumnos en un curso propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });

        const postRes = await POSTAlumno(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, { nombre: "María Gómez" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.alumno.nombre).toBe("María Gómez");
        expect(postJson.alumno.colegioId).toBe(admin.colegioId);

        const getRes = await GETAlumnos(
            request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, undefined, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        const getJson = await getRes.json();
        expect(getJson.alumnos).toHaveLength(1);
    });

    it("rechaza crear alumno en curso de otro colegio", async () => {
        await setupSchoolAdmin();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "Curso Ajeno" });

        const res = await POSTAlumno(
            request("POST", `http://localhost:5005/api/colegio/cursos/${otroCurso.id}/alumnos`, { nombre: "Intruso" }, mockToken),
            { params: Promise.resolve({ id: otroCurso.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("rechaza crear alumno con nombre duplicado en el curso", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const res = await POSTAlumno(
            request("POST", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, { nombre: "María Gómez" }, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(res.status).toBe(409);
    });
});

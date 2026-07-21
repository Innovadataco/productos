import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHAlumno } from "@/app/api/colegio/alumnos/[id]/route";
import { PATCH as PATCHEstadoAlumno } from "@/app/api/colegio/alumnos/[id]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearCurso, crearAlumno } from "@/lib/reporte-test-utils";

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

describe("/api/colegio/cursos/[id]/alumnos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN lista solo alumnos activos del curso", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        await crearAlumno(curso.id, admin.colegioId!, { nombre: "Activo" });
        await crearAlumno(curso.id, admin.colegioId!, { nombre: "Inactivo", estado: "inactivo" });

        const res = await GET(
            request("GET", `http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, undefined, mockToken),
            { params: Promise.resolve({ id: curso.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alumnos).toHaveLength(1);
        expect(json.alumnos[0].nombre).toBe("Activo");
    });

    it("SCHOOL_ADMIN edita un alumno propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const res = await PATCHAlumno(
            request("PATCH", `http://localhost:5005/api/colegio/alumnos/${alumno.id}`, { nombre: "María Gómez Torres" }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alumno.nombre).toBe("María Gómez Torres");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ALUMNO_EDITADO", recursoId: alumno.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un alumno propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "Carlos Ruiz" });

        const res = await PATCHEstadoAlumno(
            request("PATCH", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/estado`, "inactivo", mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.alumno.estado).toBe("inactivo");
    });

    it("SCHOOL_ADMIN de otro colegio no puede crear alumnos en curso ajeno", async () => {
        await setupSchoolAdmin();
        const { admin: admin2, colegio: colegio2 } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(colegio2.id, { nombre: "Curso Ajeno" });

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/cursos/${otroCurso.id}/alumnos`, { nombre: "Intruso" }, mockToken),
            { params: Promise.resolve({ id: otroCurso.id }) }
        );

        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN de otro colegio no puede editar alumno ajeno", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "Propio" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await PATCHAlumno(
            request("PATCH", `http://localhost:5005/api/colegio/alumnos/${alumno.id}`, { nombre: "Hackeado" }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(404);
    });
});

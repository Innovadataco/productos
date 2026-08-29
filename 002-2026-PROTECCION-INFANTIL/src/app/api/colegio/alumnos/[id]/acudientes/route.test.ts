/**
 * SPEC-163: tests de API de acudientes de un estudiante.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHAcudiente } from "./[acudienteId]/route";
import { PATCH as PATCHEstadoAcudiente } from "./[acudienteId]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearCurso, crearEstudiante, crearAcudienteEstudiante } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
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

describe("/api/colegio/alumnos/[id]/acudientes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN agrega y lista acudientes de un alumno propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const postRes = await POST(
            request("POST", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, {
                orden: 1,
                nombre: "Marta Gómez",
                relacion: "madre",
                telefono: "+573001112233",
            }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.acudiente.nombre).toBe("Marta Gómez");

        const getRes = await GET(
            request("GET", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, undefined, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );
        const getJson = await getRes.json();
        expect(getJson.acudientes).toHaveLength(1);
    });

    it("rechaza un tercer acudiente activo", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        await POST(
            request("POST", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, {
                orden: 1,
                nombre: "A1",
                relacion: "madre",
            }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );
        await POST(
            request("POST", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, {
                orden: 2,
                nombre: "A2",
                relacion: "padre",
            }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, {
                orden: 1,
                nombre: "A3",
                relacion: "tío",
            }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );
        expect(res.status).toBe(409);
    });

    it("rechaza orden ocupado activo", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        await POST(
            request("POST", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, {
                orden: 1,
                nombre: "A1",
                relacion: "madre",
            }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        const res = await POST(
            request("POST", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes`, {
                orden: 1,
                nombre: "A2",
                relacion: "padre",
            }, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );
        expect(res.status).toBe(409);
    });

    it("SCHOOL_ADMIN edita un acudiente propio y se audita", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id, { orden: 1, nombre: "Marta", relacion: "madre" });

        const res = await PATCHAcudiente(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes/${acudiente.id}`,
                { nombre: "Marta Torres", relacion: "tía" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id, acudienteId: acudiente.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.acudiente.nombre).toBe("Marta Torres");
        expect(json.acudiente.relacion).toBe("tía");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ACUDIENTE_EDITADO", recursoId: acudiente.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un acudiente propio y apaga sus identificadores", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id, { orden: 1, nombre: "Marta", relacion: "madre" });

        const res = await PATCHEstadoAcudiente(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes/${acudiente.id}/estado`,
                "inactivo",
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id, acudienteId: acudiente.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.acudiente.estado).toBe("inactivo");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_ACUDIENTE_DESACTIVADO", recursoId: acudiente.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN de otro colegio no agrega acudientes a alumno ajeno", async () => {
        await setupSchoolAdmin();
        const { admin: admin2, colegio: colegio2 } = await crearColegioConAdmin();
        const curso2 = await crearCurso(colegio2.id, { nombre: "Curso Ajeno" });
        const alumno2 = await crearEstudiante(curso2.id, colegio2.id, { nombre: "Alumno Ajeno" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno2.id}/acudientes`,
                { orden: 1, nombre: "Intruso", relacion: "tío" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno2.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN de otro colegio no edita acudiente ajeno", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id, { orden: 1, nombre: "Marta", relacion: "madre" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await PATCHAcudiente(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/acudientes/${acudiente.id}`,
                { nombre: "Hackeado" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id, acudienteId: acudiente.id }) }
        );
        expect(res.status).toBe(404);
    });
});

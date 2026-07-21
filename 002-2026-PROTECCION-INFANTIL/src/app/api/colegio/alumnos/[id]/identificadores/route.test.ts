import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHIdentificador } from "@/app/api/colegio/identificadores/[id]/route";
import { PATCH as PATCHEstadoIdentificador } from "@/app/api/colegio/identificadores/[id]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearAlumno,
    crearPlataforma,
    crearIdentificadorAlumno,
} from "@/lib/reporte-test-utils";

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

describe("/api/colegio/alumnos/[id]/identificadores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN agrega y lista identificadores de un alumno propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const postRes = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567", etiquetaRelacion: "ALUMNO" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.identificador.valor).toBe("+573001234567".toLowerCase());

        const getRes = await GET(
            request("GET", `http://localhost:5005/api/colegio/alumnos/${alumno.id}/identificadores`, undefined, mockToken),
            { params: Promise.resolve({ id: alumno.id }) }
        );
        const getJson = await getRes.json();
        expect(getJson.identificadores).toHaveLength(1);
    });

    it("normaliza identificadores a minúsculas y sin espacios", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/identificadores`,
                { tipo: "email", valor: "  Maria@Example.COM  ", etiquetaRelacion: "MADRE" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.identificador.valor).toBe("maria@example.com");
        expect(json.identificador.etiquetaRelacion).toBe("MADRE");
    });

    it("rechaza identificador duplicado para el mismo alumno", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(409);
    });

    it("valida que la plataforma exista (rechaza CUID inválido)", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno.id}/identificadores`,
                { tipo: "usuario", valor: "nick1", plataformaId: "nonexistent-cuid" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno.id }) }
        );

        expect(res.status).toBe(400);
    });

    it("SCHOOL_ADMIN edita un identificador propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const identificador = await crearIdentificadorAlumno(alumno.id, { tipo: "telefono", valor: "+573001234567" });

        const res = await PATCHIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/identificadores/${identificador.id}`,
                { valor: "+573009876543", etiquetaRelacion: "PADRE" },
                mockToken
            ),
            { params: Promise.resolve({ id: identificador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.identificador.valor).toBe("+573009876543");
        expect(json.identificador.etiquetaRelacion).toBe("PADRE");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_IDENTIFICADOR_EDITADO", recursoId: identificador.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un identificador propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const identificador = await crearIdentificadorAlumno(alumno.id, { tipo: "telefono", valor: "+573001234567" });

        const res = await PATCHEstadoIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/identificadores/${identificador.id}/estado`,
                "inactivo",
                mockToken
            ),
            { params: Promise.resolve({ id: identificador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.identificador.estado).toBe("inactivo");
    });

    it("SCHOOL_ADMIN de otro colegio no agrega identificadores a alumno ajeno", async () => {
        await setupSchoolAdmin();
        const { admin: admin2, colegio: colegio2 } = await crearColegioConAdmin();
        const curso2 = await crearCurso(colegio2.id, { nombre: "Curso Ajeno" });
        const alumno2 = await crearAlumno(curso2.id, colegio2.id, { nombre: "Alumno Ajeno" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/alumnos/${alumno2.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: alumno2.id }) }
        );

        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN de otro colegio no edita identificador ajeno", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearAlumno(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const identificador = await crearIdentificadorAlumno(alumno.id, { tipo: "telefono", valor: "+573001234567" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await PATCHIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/identificadores/${identificador.id}`,
                { valor: "hackeado" },
                mockToken
            ),
            { params: Promise.resolve({ id: identificador.id }) }
        );

        expect(res.status).toBe(404);
    });
});

/**
 * SPEC-163: tests de API de identificadores de un acudiente.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHIdentificador } from "./[identificadorId]/route";
import { PATCH as PATCHEstadoIdentificador } from "./[identificadorId]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearAcudienteEstudiante,
    crearPlataforma,
    crearIdentificadorAcudiente,
} from "@/lib/reporte-test-utils";

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

describe("/api/colegio/acudientes/[id]/identificadores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN agrega y lista identificadores de un acudiente propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);

        const postRes = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id }) }
        );
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.identificador.valor).toBe("+573001234567".toLowerCase());

        const getRes = await GET(
            request("GET", `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores`, undefined, mockToken),
            { params: Promise.resolve({ id: acudiente.id }) }
        );
        const getJson = await getRes.json();
        expect(getJson.identificadores).toHaveLength(1);
    });

    it("infiere el tipo cuando no se envía", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores`,
                { valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id }) }
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.identificador.tipo).toBe("telefono");
    });

    it("rechaza identificador duplicado para el mismo acudiente", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);
        await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id }) }
        );

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id }) }
        );
        expect(res.status).toBe(409);
    });

    it("valida que la plataforma exista", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores`,
                { tipo: "usuario", valor: "nick1", plataformaId: "nonexistent-cuid" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id }) }
        );
        expect(res.status).toBe(400);
    });

    it("SCHOOL_ADMIN edita un identificador propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);
        const identificador = await crearIdentificadorAcudiente(acudiente.id, admin.colegioId!, { tipo: "telefono", valor: "+573001234567" });

        const res = await PATCHIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores/${identificador.id}`,
                { valor: "+573009876543" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id, identificadorId: identificador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.identificador.valor).toBe("+573009876543");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_IDENTIFICADOR_ACUDIENTE_EDITADO", recursoId: identificador.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un identificador propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);
        const identificador = await crearIdentificadorAcudiente(acudiente.id, admin.colegioId!, { tipo: "telefono", valor: "+573001234567" });

        const res = await PATCHEstadoIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores/${identificador.id}/estado`,
                "inactivo",
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id, identificadorId: identificador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.identificador.estado).toBe("inactivo");
    });

    it("SCHOOL_ADMIN de otro colegio no agrega identificadores a acudiente ajeno", async () => {
        await setupSchoolAdmin();
        const { admin: admin2, colegio: colegio2 } = await crearColegioConAdmin();
        const curso2 = await crearCurso(colegio2.id, { nombre: "Curso Ajeno" });
        const alumno2 = await crearEstudiante(curso2.id, colegio2.id, { nombre: "Alumno Ajeno" });
        const acudiente2 = await crearAcudienteEstudiante(alumno2.id);

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/acudientes/${acudiente2.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente2.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN de otro colegio no edita identificador ajeno", async () => {
        const { admin } = await setupSchoolAdmin();
        const curso = await crearCurso(admin.colegioId!, { nombre: "6A" });
        const alumno = await crearEstudiante(curso.id, admin.colegioId!, { nombre: "María Gómez" });
        const acudiente = await crearAcudienteEstudiante(alumno.id);
        const identificador = await crearIdentificadorAcudiente(acudiente.id, admin.colegioId!, { tipo: "telefono", valor: "+573001234567" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await PATCHIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/acudientes/${acudiente.id}/identificadores/${identificador.id}`,
                { valor: "hackeado" },
                mockToken
            ),
            { params: Promise.resolve({ id: acudiente.id, identificadorId: identificador.id }) }
        );
        expect(res.status).toBe(404);
    });
});

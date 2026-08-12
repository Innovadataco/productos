/**
 * SPEC-164: tests de API de identificadores de un profesor.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { PATCH as PATCHIdentificador } from "@/app/api/colegio/identificadores-profesor/[id]/route";
import { PATCH as PATCHEstadoIdentificador } from "@/app/api/colegio/identificadores-profesor/[id]/estado/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearProfesor,
    crearPlataforma,
    crearIdentificadorProfesor,
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

describe("/api/colegio/profesores/[id]/identificadores", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN agrega y lista identificadores de un profesor propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });

        const postRes = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/profesores/${profesor.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(postRes.status).toBe(201);
        const postJson = await postRes.json();
        expect(postJson.identificador.valor).toBe("+573001234567");

        const getRes = await GET(
            request("GET", `http://localhost:5005/api/colegio/profesores/${profesor.id}/identificadores`, undefined, mockToken),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        const getJson = await getRes.json();
        expect(getJson.identificadores).toHaveLength(1);
    });

    it("infiere el tipo cuando no se envía", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/profesores/${profesor.id}/identificadores`,
                { valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.identificador.tipo).toBe("telefono");
    });

    it("rechaza identificador duplicado para el mismo profesor", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });
        await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/profesores/${profesor.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: profesor.id }) }
        );

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/profesores/${profesor.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(409);
    });

    it("valida que la plataforma exista", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/profesores/${profesor.id}/identificadores`,
                { tipo: "usuario", valor: "nick1", plataformaId: "nonexistent-cuid" },
                mockToken
            ),
            { params: Promise.resolve({ id: profesor.id }) }
        );
        expect(res.status).toBe(400);
    });

    it("SCHOOL_ADMIN edita un identificador propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });
        const identificador = await crearIdentificadorProfesor(profesor.id, admin.colegioId!, { tipo: "telefono", valor: "+573001234567" });

        const res = await PATCHIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/identificadores-profesor/${identificador.id}`,
                { valor: "+573009876543" },
                mockToken
            ),
            { params: Promise.resolve({ id: identificador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.identificador.valor).toBe("+573009876543");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "COLEGIO_IDENTIFICADOR_PROFESOR_EDITADO", recursoId: identificador.id },
        });
        expect(audit).not.toBeNull();
    });

    it("SCHOOL_ADMIN desactiva un identificador propio", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });
        const identificador = await crearIdentificadorProfesor(profesor.id, admin.colegioId!, { tipo: "telefono", valor: "+573001234567" });

        const res = await PATCHEstadoIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/identificadores-profesor/${identificador.id}/estado`,
                "inactivo",
                mockToken
            ),
            { params: Promise.resolve({ id: identificador.id }) }
        );

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.identificador.estado).toBe("inactivo");
    });

    it("SCHOOL_ADMIN de otro colegio no agrega identificadores a profesor ajeno", async () => {
        await setupSchoolAdmin();
        const { admin: admin2, colegio: colegio2 } = await crearColegioConAdmin();
        const profesor2 = await crearProfesor(colegio2.id, { nombre: "Profesor Ajeno" });

        const res = await POST(
            request(
                "POST",
                `http://localhost:5005/api/colegio/profesores/${profesor2.id}/identificadores`,
                { tipo: "telefono", valor: "+573001234567" },
                mockToken
            ),
            { params: Promise.resolve({ id: profesor2.id }) }
        );
        expect(res.status).toBe(404);
    });

    it("SCHOOL_ADMIN de otro colegio no edita identificador ajeno", async () => {
        const { admin } = await setupSchoolAdmin();
        const profesor = await crearProfesor(admin.colegioId!, { nombre: "Carlos Pérez" });
        const identificador = await crearIdentificadorProfesor(profesor.id, admin.colegioId!, { tipo: "telefono", valor: "+573001234567" });

        const { admin: admin2 } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

        const res = await PATCHIdentificador(
            request(
                "PATCH",
                `http://localhost:5005/api/colegio/identificadores-profesor/${identificador.id}`,
                { valor: "hackeado" },
                mockToken
            ),
            { params: Promise.resolve({ id: identificador.id }) }
        );
        expect(res.status).toBe(404);
    });
});

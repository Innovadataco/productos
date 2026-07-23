import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function getRequest(query = ""): Request {
    return new Request(`http://localhost/api/colegio/auditoria${query}`, { method: "GET" });
}

async function crearLog(colegioId: string | null, accion: string, usuarioId?: string) {
    return prisma.auditLog.create({
        data: {
            accion: accion as never,
            tipoRecurso: "Curso",
            recursoId: "rec-1",
            usuarioId: usuarioId ?? null,
            colegioId,
            ipAddress: "127.0.0.1",
            userAgent: "test",
        },
    });
}

describe("GET /api/colegio/auditoria (FR-008 aislamiento)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("un colegio solo ve acciones COLEGIO_* de SU colegio", async () => {
        const { admin: adminA, colegio: colegioA } = await crearColegioConAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();

        const logA1 = await crearLog(colegioA.id, "COLEGIO_CURSO_CREADO", adminA.id);
        const logA2 = await crearLog(colegioA.id, "COLEGIO_CREADO");
        await crearLog(colegioB.id, "COLEGIO_CURSO_CREADO"); // de otro colegio
        await crearLog(colegioA.id, "LOGIN", adminA.id); // acción no COLEGIO_*
        await crearLog(null, "COLEGIO_CURSO_CREADO"); // sin colegioId

        mockToken = await crearTokenUsuario(adminA.id, "SCHOOL_ADMIN");
        const res = await GET(getRequest());
        expect(res.status).toBe(200);

        const body = await res.json();
        const ids = body.items.map((i: { id: string }) => i.id);
        expect(ids).toContain(logA1.id);
        expect(ids).toContain(logA2.id);
        expect(body.items).toHaveLength(2);
        // FR-008: nada del colegio B, nada de acciones no COLEGIO_*, nada sin colegioId
        expect(body.items.every((i: { colegioId: string }) => i.colegioId === colegioA.id)).toBe(true);
    });

    it("filtra por tipo de acción dentro de su propio colegio", async () => {
        const { admin: adminA, colegio: colegioA } = await crearColegioConAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();

        const cursoA = await crearLog(colegioA.id, "COLEGIO_CURSO_CREADO");
        await crearLog(colegioA.id, "COLEGIO_ALUMNO_CREADO");
        await crearLog(colegioB.id, "COLEGIO_CURSO_CREADO");

        mockToken = await crearTokenUsuario(adminA.id, "SCHOOL_ADMIN");
        const res = await GET(getRequest("?acciones=COLEGIO_CURSO_CREADO"));
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe(cursoA.id);
    });

    it("el colegio B no ve nada del colegio A", async () => {
        const { colegio: colegioA } = await crearColegioConAdmin();
        const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();

        await crearLog(colegioA.id, "COLEGIO_CURSO_CREADO");
        const logB = await crearLog(colegioB.id, "COLEGIO_CREADO");

        mockToken = await crearTokenUsuario(adminB.id, "SCHOOL_ADMIN");
        const res = await GET(getRequest());
        const body = await res.json();

        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe(logB.id);
    });

    it("rechaza roles distintos de SCHOOL_ADMIN", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const res = await GET(getRequest());
        expect(res.status).toBe(403);
    });

    it("rechaza sin autenticación", async () => {
        const res = await GET(getRequest());
        expect(res.status).toBe(401);
    });
});

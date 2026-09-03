/**
 * SPEC-380 (PR B · C4/D-100) — endpoints de identificadores del integrante.
 * Smoke test: crear + listar como SCHOOL_ADMIN del mismo colegio, y como
 * COMITE_CONVIVENCIA de ese colegio; PARENT queda fuera; cross-tenant → 404.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearColegioConAdmin, crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function crearComiteConIntegrante() {
    const { admin, colegio } = await crearColegioConAdmin();
    const comite = await prisma.usuario.create({
        data: {
            email: `comite-${Date.now()}${Math.floor(Math.random() * 1000)}@test.local`,
            passwordHash: "x",
            rol: "COMITE_CONVIVENCIA",
            estado: "activo",
            comiteColegioId: colegio.id,
        },
    });
    const integrante = await prisma.integranteComite.create({
        data: {
            comiteId: comite.id,
            nombres: "Ana",
            apellidos: "Ruiz",
            tipoIdentificacion: "CEDULA_CIUDADANIA",
            numeroIdentificacion: `${Date.now()}${Math.floor(Math.random() * 1000)}`,
            hashIdentificacion: `hash-${Date.now()}${Math.floor(Math.random() * 1000)}`,
            email: `ana-${Date.now()}@test.local`,
            cargo: "Rectora",
            estado: "ACTIVO",
            creadoPorId: admin.id,
        },
    });
    return { admin, colegio, comite, integrante };
}

function req(method: "GET" | "POST", integranteId: string, body?: unknown): Request {
    return new Request(`http://localhost:5005/api/colegio/comite/integrantes/${integranteId}/identificadores`, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

describe("GET/POST /api/colegio/comite/integrantes/[id]/identificadores (SPEC-380 PR B)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());

    it("SCHOOL_ADMIN del colegio: crea y lista identificadores del integrante", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const resCreate = await POST(
            req("POST", integrante.id, { valor: "ana@colegio.co" }),
            { params: Promise.resolve({ id: integrante.id }) }
        );
        expect(resCreate.status).toBe(201);
        const bodyCreate = await resCreate.json();
        expect(bodyCreate.identificador.valor).toBe("ana@colegio.co");

        const resList = await GET(req("GET", integrante.id), { params: Promise.resolve({ id: integrante.id }) });
        expect(resList.status).toBe(200);
        const bodyList = await resList.json();
        expect(bodyList.items).toHaveLength(1);
    });

    it("COMITE_CONVIVENCIA del colegio: también puede gestionar", async () => {
        const { comite, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");

        const res = await POST(
            req("POST", integrante.id, { valor: "@ana_test" }),
            { params: Promise.resolve({ id: integrante.id }) }
        );
        expect(res.status).toBe(201);
    });

    it("mismo identificador dos veces → 409 (duplicado)", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await POST(req("POST", integrante.id, { valor: "misma@cuenta.co" }), {
            params: Promise.resolve({ id: integrante.id }),
        });
        const res2 = await POST(req("POST", integrante.id, { valor: "misma@cuenta.co" }), {
            params: Promise.resolve({ id: integrante.id }),
        });
        expect(res2.status).toBe(409);
    });

    it("SCHOOL_ADMIN de OTRO colegio → 404 (tenant-first)", async () => {
        const { integrante } = await crearComiteConIntegrante();
        const { admin: otro } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(otro.id, "SCHOOL_ADMIN");
        const res = await POST(req("POST", integrante.id, { valor: "ajeno@test.co" }), {
            params: Promise.resolve({ id: integrante.id }),
        });
        expect(res.status).toBe(404);
    });

    it("PARENT → 403 (cuenta sin colegio)", async () => {
        const { integrante } = await crearComiteConIntegrante();
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const res = await POST(req("POST", integrante.id, { valor: "padre@test.co" }), {
            params: Promise.resolve({ id: integrante.id }),
        });
        expect(res.status).toBe(403);
    });
});

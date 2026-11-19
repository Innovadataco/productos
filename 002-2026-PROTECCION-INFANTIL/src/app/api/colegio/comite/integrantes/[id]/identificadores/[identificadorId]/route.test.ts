/**
 * SPEC-932 · PATCH /api/colegio/comite/integrantes/[id]/identificadores/[identificadorId] — EDICIÓN (el comité
 * gana «Editar» con el componente único) + el cambio de estado de siempre.
 * Pertenencia: colegio de la sesión + integrante de la ruta. Plataforma validada. Duplicado → 409.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { PATCH } from "./route";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearColegioConAdmin, crearTokenUsuario } from "@/lib/reporte-test-utils";

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

function req(method: "POST" | "PATCH", url: string, body: unknown): Request {
    return new Request(`http://localhost:5005${url}`, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify(body),
    });
}

async function crearIdent(integranteId: string, valor: string): Promise<string> {
    const res = await POST(req("POST", `/api/colegio/comite/integrantes/${integranteId}/identificadores`, { valor }), {
        params: Promise.resolve({ id: integranteId }),
    });
    expect(res.status).toBe(201);
    return (await res.json()).identificador.id;
}

function patch(integranteId: string, identificadorId: string, body: unknown) {
    return PATCH(req("PATCH", `/api/colegio/comite/integrantes/${integranteId}/identificadores/${identificadorId}`, body), {
        params: Promise.resolve({ id: integranteId, identificadorId }),
    });
}

describe("PATCH identificador del integrante (SPEC-932 · edición)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());

    it("edita valor + plataforma (tipo re-inferido)", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const id = await crearIdent(integrante.id, "@viejo");
        const plataforma = await prisma.plataforma.findFirst();
        const res = await patch(integrante.id, id, { valor: "nuevo@correo.co", plataformaId: plataforma?.id ?? null });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.identificador.valor).toBe("nuevo@correo.co");
        expect(body.identificador.tipo).not.toBe("usuario");
        expect(body.identificador.plataformaId).toBe(plataforma?.id ?? null);
    });

    it("plataforma inexistente → 404 (antes: la FK reventaba en 500)", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const id = await crearIdent(integrante.id, "@x");
        const res = await patch(integrante.id, id, { valor: "@x2", plataformaId: "cmplataformanoexiste0001" });
        expect(res.status).toBe(404);
    });

    it("duplicado dentro del integrante → 409", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await crearIdent(integrante.id, "@uno");
        const id2 = await crearIdent(integrante.id, "@dos");
        const res = await patch(integrante.id, id2, { valor: "@uno", plataformaId: null });
        expect(res.status).toBe(409);
    });

    it("PERTENENCIA: el id de OTRO integrante en la ruta → 404, no edita", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const id = await crearIdent(integrante.id, "@propio");
        const otro = await prisma.integranteComite.create({
            data: { ...(await prisma.integranteComite.findUniqueOrThrow({ where: { id: integrante.id }, select: { comiteId: true, creadoPorId: true } })),
                nombres: "Luis", apellidos: "Paz", tipoIdentificacion: "CEDULA_CIUDADANIA",
                numeroIdentificacion: `${Date.now()}9`, hashIdentificacion: `hash-otro-${Date.now()}`,
                email: `luis-${Date.now()}@test.local`, cargo: "Docente", estado: "ACTIVO" },
        });
        const res = await patch(otro.id, id, { valor: "@cambiado", plataformaId: null });
        expect(res.status).toBe(404);
        expect((await prisma.identificadorIntegranteComite.findUniqueOrThrow({ where: { id } })).valor).toBe("@propio");
    });

    it("PERTENENCIA: SCHOOL_ADMIN de OTRO colegio → 404", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const id = await crearIdent(integrante.id, "@ajeno");
        const { admin: otro } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(otro.id, "SCHOOL_ADMIN");
        const res = await patch(integrante.id, id, { valor: "@robado", plataformaId: null });
        expect(res.status).toBe(404);
    });

    it("el cambio de estado sigue funcionando ({ estado })", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const id = await crearIdent(integrante.id, "@estado");
        const res = await patch(integrante.id, id, { estado: "inactivo" });
        expect(res.status).toBe(200);
        expect((await res.json()).identificador.estado).toBe("inactivo");
    });

    it("body mixto/vacío → 400 (ni estado ni edición válida)", async () => {
        const { admin, integrante } = await crearComiteConIntegrante();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const id = await crearIdent(integrante.id, "@mixto");
        expect((await patch(integrante.id, id, {})).status).toBe(400);
        expect((await patch(integrante.id, id, { estado: "inactivo", valor: "@y" })).status).toBe(400);
    });
});

/**
 * SPEC-225 (FR-012, FR-016): tests de integración de
 * GET /api/admin/analisis/anomalias — matriz 200/400/401/403, filtros y
 * paginación estándar del contrato.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

const URL_BASE = "http://localhost:5005/api/admin/analisis/anomalias";

async function crearAnomalia(overrides: Record<string, unknown> = {}) {
    return prisma.anomalia.create({
        data: {
            tipo: "CAIDA_RECAUDO_CIUDAD",
            sujetoTipo: "Ciudad",
            sujetoId: unico("ciudad"),
            severidad: "ALTA",
            descripcion: "El recaudo autorizado cayó 41% respecto a la semana anterior.",
            datosContexto: { variacionPct: -41, umbralPct: 30 },
            ...overrides,
        },
    });
}

function llamar(query = "") {
    const req = crearRequestAutenticado("GET", `${URL_BASE}${query}`, undefined, mockToken);
    return GET(req);
}

describe("GET /api/admin/analisis/anomalias", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: lista paginada con default estado=ABIERTAS, orden detectadaEn desc", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearAnomalia();
        await new Promise((r) => setTimeout(r, 5));
        const reciente = await crearAnomalia();
        await crearAnomalia({ resueltaEn: new Date(), resueltaPorAdminId: admin.id });

        const res = await llamar();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.pagination).toMatchObject({ page: 1, pageSize: 25, total: 2, totalPages: 1 });
        expect(body.items).toHaveLength(2); // la resuelta no aparece por default
        expect(body.items[0].id).toBe(reciente.id);
    });

    it("200: filtros tipo/severidad/estado y paginación", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearAnomalia({ severidad: "ALTA" });
        await crearAnomalia({ severidad: "MEDIA", tipo: "USO_CAIDO_ABRUPTO", sujetoTipo: "Colegio" });
        await crearAnomalia({ resueltaEn: new Date(), resueltaPorAdminId: admin.id });

        const soloMedia = await (await llamar("?severidad=MEDIA&estado=TODAS")).json();
        expect(soloMedia.pagination.total).toBe(1);
        expect(soloMedia.items[0].tipo).toBe("USO_CAIDO_ABRUPTO");

        const resueltas = await (await llamar("?estado=RESUELTAS")).json();
        expect(resueltas.pagination.total).toBe(1);

        const pagina = await (await llamar("?estado=TODAS&page=2&pageSize=2")).json();
        expect(pagina.pagination).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
        expect(pagina.items).toHaveLength(1);
    });

    it("400: valores inválidos de tipo/severidad/estado/pageSize", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        for (const query of [
            "?tipo=NO_EXISTE",
            "?severidad=CRITICA",
            "?estado=ABIERTO",
            "?pageSize=101",
            "?page=0",
        ]) {
            const res = await llamar(query);
            expect(res.status).toBe(400);
        }
    });

    it("401: sin sesión", async () => {
        mockToken = undefined;
        const res = await llamar();
        expect(res.status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await llamar();
        expect(res.status).toBe(403);
    });
});

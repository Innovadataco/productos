/**
 * SPEC-142 (F6): GET /api/colegio/patrones — guardas (rol/vigencia/tenant) y
 * payload k-anonimizado del colegio propio (cross-tenant aislado).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearPlataforma,
    crearPaisCiudad,
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import { PatronInstitucionalRepository } from "@/lib/dal/repositories/patron-institucional";
import { periodoTrimestre } from "@/lib/colegio/patrones";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const PERIODO = periodoTrimestre(new Date());

async function sembrarPatrones(colegioId: string, plataformaId: string, veces: number, conducta: CategoriaConducta = "EXTORSION") {
    const repo = new PatronInstitucionalRepository();
    for (let i = 0; i < veces; i++) {
        await repo.upsertIncrementar(colegioId, { periodo: PERIODO, grado: "7", conducta, plataformaId });
    }
}

describe("GET /api/colegio/patrones (SPEC-142, F6)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    it("SCHOOL_ADMIN ve los agregados de SU colegio con k aplicado", async () => {
        const plataforma = await crearPlataforma();
        const { colegio, admin } = await crearColegioConAdmin();
        const { colegio: otro } = await crearColegioConAdmin();
        await sembrarPatrones(colegio.id, plataforma.id, 3);
        await sembrarPatrones(otro.id, plataforma.id, 5, "DOXING");
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await GET(crearRequestAutenticado("GET", `http://localhost:5005/api/colegio/patrones?periodo=${PERIODO}`, undefined, mockToken));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.colegioId).toBe(colegio.id);
        expect(body.total).toBe(3);
        expect(body.k).toBe(3);
        expect(body.porGrado).toEqual([{ clave: "7", conteo: 3 }]);
        expect(body.porConducta).toEqual([{ clave: "EXTORSION", conteo: 3 }]);
        expect(body.porPlataforma).toEqual([{ plataforma: "WhatsApp", conteo: 3 }]);
        // Cross-tenant: nada del otro colegio.
        expect(body.total).not.toBe(8);
        expect(JSON.stringify(body)).not.toContain("DOXING");
        // Sin PII en el payload.
        expect(JSON.stringify(body)).not.toContain("identificadorEstudiante");
    });

    it("rechaza a PARENT (403) y anónimo (401)", async () => {
        const parent = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(parent.id, "PARENT");
        const resParent = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/colegio/patrones", undefined, mockToken));
        expect(resParent.status).toBe(403);

        mockToken = undefined;
        const resAnon = await GET(new Request("http://localhost:5005/api/colegio/patrones"));
        expect(resAnon.status).toBe(401);
    });

    it("SCHOOL_ADMIN de otro colegio no ve nada ajeno (aislamiento)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio } = await crearColegioConAdmin();
        const { admin: adminOtro } = await crearColegioConAdmin();
        await sembrarPatrones(colegio.id, plataforma.id, 5);
        mockToken = await crearTokenUsuario(adminOtro.id, "SCHOOL_ADMIN");

        const res = await GET(crearRequestAutenticado("GET", `http://localhost:5005/api/colegio/patrones?periodo=${PERIODO}`, undefined, mockToken));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(0);
        expect(body.porGrado).toEqual([]);
    });

    it("valida el formato del período (400)", async () => {
        const { admin } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/colegio/patrones?periodo=2026-T3", undefined, mockToken));
        expect(res.status).toBe(400);
    });
});

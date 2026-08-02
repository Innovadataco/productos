/**
 * SPEC-139 (F5, ZEUS D-4): GET /api/admin/matches — detalle agregado paginado
 * + tendencia, solo ADMIN, y guard FR-009 (nunca denunciantes ni textos).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const TAG = Math.random().toString(36).slice(2, 8);

async function crearEvento(identificadorValor: string, plataformaId: string, opciones: { interCiudad?: boolean } = {}) {
    const agregado = await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador: identificadorValor, plataformaId } },
        update: {},
        create: { identificador: identificadorValor, plataformaId, totalReportes: 2, reportesAprobados: 2 },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificadorValor,
            plataformaId,
            texto: "Texto de prueba del listado de matches con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-${TAG}-${Math.random().toString(36).slice(2, 6)}`,
            estado: "CLASIFICADO",
        },
    });
    return prisma.eventoMatch.create({
        data: {
            identificadorId: agregado.id,
            reporteNuevoId: reporte.id,
            conteoAcumulado: 2,
            ciudades: opciones.interCiudad ? ["Bogotá", "Cali"] : ["Bogotá"],
            conductasCoincidentes: ["EXTORSION"],
            interCiudad: opciones.interCiudad ?? false,
        },
    });
}

describe("GET /api/admin/matches (SPEC-139, F5)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        mockToken = undefined;
    });

    it("lista eventos con detalle agregado paginado y tendencia", async () => {
        const plataforma = await crearPlataforma();
        await crearEvento(`+57341${TAG}`, plataforma.id, { interCiudad: true });
        await crearEvento(`+57342${TAG}`, plataforma.id);
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/admin/matches?page=1&pageSize=10", undefined, mockToken));
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.pagination.total).toBe(2);
        expect(body.items).toHaveLength(2);
        const inter = body.items.find((i: { interCiudad: boolean }) => i.interCiudad);
        expect(inter.ciudades).toEqual(["Bogotá", "Cali"]);
        expect(inter.conteoAcumulado).toBe(2);
        expect(inter.conductasCoincidentes).toEqual(["EXTORSION"]);
        expect(Array.isArray(body.tendencia)).toBe(true);
        expect(body.tendencia.length).toBeGreaterThan(0);

        // FR-009: el payload NUNCA lleva identidad de denunciantes ni textos.
        const crudo = JSON.stringify(body);
        expect(crudo).not.toContain("usuarioId");
        expect(crudo).not.toContain("ipHash");
        expect(crudo).not.toContain("fingerprintHash");
        expect(crudo).not.toContain("Texto de prueba");
    });

    it("pagina con page/pageSize estándar", async () => {
        const plataforma = await crearPlataforma();
        await crearEvento(`+57343${TAG}`, plataforma.id);
        await crearEvento(`+57344${TAG}`, plataforma.id);
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/admin/matches?page=2&pageSize=1", undefined, mockToken));
        const body = await res.json();
        expect(body.items).toHaveLength(1);
        expect(body.pagination).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
    });

    it("rechaza a OPERADOR (403) y anónimo (401)", async () => {
        const operador = await crearUsuario("OPERADOR");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");
        const resOp = await GET(crearRequestAutenticado("GET", "http://localhost:5005/api/admin/matches", undefined, mockToken));
        expect(resOp.status).toBe(403);

        mockToken = undefined;
        const resAnon = await GET(new Request("http://localhost:5005/api/admin/matches"));
        expect(resAnon.status).toBe(401);
    });
});

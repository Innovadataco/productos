import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

/**
 * SPEC-580: tests de integración de GET /api/paises?contexto=reporte.
 * El filtro por `geo.paises_reporte` aplica SOLO al contexto "reporte"; sin
 * contexto el endpoint sigue devolviendo todos los activos. Pais es catálogo
 * estático excluido del truncate de resetDatabase (test-utils.ts), así que el
 * fixture usa códigos ficticios "Z*" idempotentes (upsert) y se limpia al final.
 */
describe("GET /api/paises (SPEC-580)", () => {
    const CODIGOS_FIXTURE = ["ZP", "ZQ", "ZR"];

    beforeEach(async () => {
        await resetDatabase();
        await prisma.pais.createMany({
            data: [
                { codigo: "ZP", nombre: "Pais Test P" },
                { codigo: "ZQ", nombre: "Pais Test Q" },
                { codigo: "ZR", nombre: "Pais Test R", esActivo: false },
            ],
            skipDuplicates: true,
        });
    });

    afterAll(async () => {
        await prisma.pais.deleteMany({ where: { codigo: { in: CODIGOS_FIXTURE } } });
        await prisma.$disconnect();
    });

    async function crearParamPaisesReporte(valor: string) {
        await prisma.parametroSistema.create({
            data: {
                clave: "geo.paises_reporte",
                valor,
                tipo: "STRING",
                categoria: "SYSTEM",
                esPublico: false,
            },
        });
    }

    function llamar(query: string) {
        return GET(new Request(`http://localhost/api/paises${query}`));
    }

    it("sin contexto devuelve todos los activos aunque el parámetro tenga valor", async () => {
        await crearParamPaisesReporte("ZP");
        const res = await llamar("");
        expect(res.status).toBe(200);
        const json = await res.json();
        const codigos = json.paises.map((p: { codigo: string }) => p.codigo);
        expect(codigos).toContain("ZP");
        expect(codigos).toContain("ZQ");
        expect(codigos).not.toContain("ZR"); // inactivo nunca se lista
    });

    it("contexto=reporte con parámetro 'ZP' devuelve solo ese país", async () => {
        await crearParamPaisesReporte("ZP");
        const res = await llamar("?contexto=reporte");
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.paises).toHaveLength(1);
        expect(json.paises[0].codigo).toBe("ZP");
    });

    it("contexto=reporte con parámetro vacío devuelve todos los activos", async () => {
        await crearParamPaisesReporte("");
        const res = await llamar("?contexto=reporte");
        expect(res.status).toBe(200);
        const json = await res.json();
        const codigos = json.paises.map((p: { codigo: string }) => p.codigo);
        expect(codigos).toContain("ZP");
        expect(codigos).toContain("ZQ");
        expect(codigos).not.toContain("ZR");
    });

    it("contexto=reporte con parámetro inexistente devuelve todos los activos", async () => {
        const res = await llamar("?contexto=reporte");
        expect(res.status).toBe(200);
        const json = await res.json();
        const codigos = json.paises.map((p: { codigo: string }) => p.codigo);
        expect(codigos).toContain("ZP");
        expect(codigos).toContain("ZQ");
        expect(codigos).not.toContain("ZR");
    });

    it("contexto=reporte tolera espacios alrededor de las comas", async () => {
        await crearParamPaisesReporte("ZP, ZQ");
        const res = await llamar("?contexto=reporte");
        const json = await res.json();
        const codigos = json.paises.map((p: { codigo: string }) => p.codigo);
        expect(codigos).toContain("ZP");
        expect(codigos).toContain("ZQ");
        expect(codigos).not.toContain("ZR");
    });

    it("rechaza un contexto no soportado con 400", async () => {
        const res = await llamar("?contexto=colegio");
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.code).toBe("VALIDATION_ERROR");
    });
});

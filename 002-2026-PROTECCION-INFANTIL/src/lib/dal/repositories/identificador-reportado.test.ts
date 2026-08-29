/**
 * E-8 (LOTE 2): tests de listarParaSimulacion/contarTodos (simulación de score).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { IdentificadorReportadoRepository } from "./identificador-reportado";

const TAG = Math.random().toString(36).slice(2, 8);

async function crearIdentificador(identificador: string, ultimoReporteEn: Date) {
    const plataforma = await crearPlataforma();
    return prisma.identificadorReportado.create({
        data: {
            identificador,
            plataformaId: plataforma.id,
            totalReportes: 1,
            reportesAutenticados: 1,
            ultimoReporteEn,
        },
    });
}

describe("IdentificadorReportadoRepository (E-8 LOTE 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("contarTodos cuenta los agregados y listarParaSimulacion ordena por recencia y pagina", async () => {
        const repo = new IdentificadorReportadoRepository();
        const viejo = await crearIdentificador(`+57311${TAG}A`, new Date("2026-07-01T00:00:00Z"));
        const reciente = await crearIdentificador(`+57311${TAG}B`, new Date("2026-07-20T00:00:00Z"));
        const medio = await crearIdentificador(`+57311${TAG}C`, new Date("2026-07-10T00:00:00Z"));

        expect(await repo.contarTodos()).toBe(3);

        const pagina = await repo.listarParaSimulacion({ skip: 0, take: 50 });
        expect(pagina.map((r) => r.id)).toEqual([reciente.id, medio.id, viejo.id]);
        expect(pagina[0]).toMatchObject({ identificador: `+57311${TAG}B` });
        expect("score" in pagina[0]).toBe(false);

        const segunda = await repo.listarParaSimulacion({ skip: 2, take: 1 });
        expect(segunda.map((r) => r.id)).toEqual([viejo.id]);
    });
});

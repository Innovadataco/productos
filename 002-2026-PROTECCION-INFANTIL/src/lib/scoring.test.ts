import { describe, it, expect, beforeEach } from "vitest";
import { calcularScore, determinarNivelRiesgo, recalcularYGuardarScore, isSourceWeightEnabled } from "./scoring";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "./reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

async function crearReporteClasificado(
    identificador: string,
    plataformaId: string,
    categoria: CategoriaConducta,
    esAnonimo: boolean,
    creadoEn: Date,
    ciudad = "Bogotá",
    pais = "Colombia"
) {
    const numeroSeguimiento = `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para scoring.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad,
            pais,
            esAnonimo,
            numeroSeguimiento,
            estado: "CLASIFICADO",
            creadoEn,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.85,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    return reporte;
}

describe("determinarNivelRiesgo", () => {
    it("clasifica correctamente los 4 niveles", () => {
        const t = { low: 35, medium: 60, high: 80 };
        expect(determinarNivelRiesgo(20, t)).toBe("BAJO");
        expect(determinarNivelRiesgo(40, t)).toBe("MEDIO");
        expect(determinarNivelRiesgo(70, t)).toBe("ALTO");
        expect(determinarNivelRiesgo(85, t)).toBe("CRITICO");
    });
});

describe("calcularScore", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve score 0 y nivel BAJO sin reportes", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const result = await calcularScore("+57300000000", plataforma!.id);
        expect(result.score).toBe(0);
        expect(result.nivelRiesgo).toBe("BAJO");
        expect(result.totalReportes).toBe(0);
    });

    it("score es mayor para categorías más severas", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 5; i++) {
            await crearReporteClasificado(
                "+57300SEVERO",
                plataforma!.id,
                "COMPARTIMIENTO_SEXUAL",
                false,
                new Date(Date.now() - i * 86400000)
            );
        }
        const result = await calcularScore("+57300SEVERO", plataforma!.id);
        expect(result.score).toBeGreaterThan(60);
        expect(result.nivelRiesgo).toBeOneOf(["ALTO", "CRITICO"]);
        expect(result.categorias[0].categoria).toBe("COMPARTIMIENTO_SEXUAL");
    });

    it("aumenta la diversidad geográfica", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteClasificado("+57300DIV", plataforma!.id, "OFRECIMIENTO_REGALOS", false, new Date(), "Bogotá", "Colombia");
        await crearReporteClasificado("+57300DIV", plataforma!.id, "OFRECIMIENTO_REGALOS", false, new Date(), "Medellín", "Colombia");
        const result = await calcularScore("+57300DIV", plataforma!.id);
        expect(result.ciudadesUnicas).toBe(2);
        expect(result.paisesUnicos).toBe(1);
    });

    it("devuelve scores desagregados y pesos unitarios cuando el flag está desactivado", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteClasificado("+57300MIX", plataforma!.id, "OTRO", true, new Date());
        await crearReporteClasificado("+57300MIX", plataforma!.id, "OTRO", false, new Date());

        expect(await isSourceWeightEnabled()).toBe(false);

        const result = await calcularScore("+57300MIX", plataforma!.id);
        expect(result.scoreAnonimo).toBeGreaterThan(0);
        expect(result.scoreAutenticado).toBeGreaterThan(0);
        expect(result.pesoAnonimoPromedio).toBe(1);
        expect(result.pesoAutenticadoPromedio).toBe(1);
        expect(result.scoreAjustado).toBe(result.scoreAnonimo + result.scoreAutenticado);
        expect(result.scoreAjustado).toBeLessThanOrEqual(100);
    });

    it("aplica pesos de fuente cuando se fuerza el ajuste", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const r1 = await crearReporteClasificado("+57300FORCE", plataforma!.id, "SOLICITUD_ENCUENTRO", true, new Date());
        await prisma.reporte.update({ where: { id: r1.id }, data: { fuenteConfianza: 0.5 } });

        const result = await calcularScore("+57300FORCE", plataforma!.id, undefined, { forceSourceWeight: true });
        expect(result.pesoAnonimoPromedio).toBe(0.5);
        expect(result.scoreAjustado).toBe(Math.min(Math.round(result.scoreAnonimo * 0.5), 100));
    });
});

describe("recalcularYGuardarScore", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("persiste score y nivel en IdentificadorReportado", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            await crearReporteClasificado(
                "+57300PERSIST",
                plataforma!.id,
                "SOLICITUD_ENCUENTRO",
                false,
                new Date(Date.now() - i * 86400000)
            );
        }

        const result = await recalcularYGuardarScore("+57300PERSIST", plataforma!.id);

        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: "+57300PERSIST", plataformaId: plataforma!.id } },
        });

        expect(agregado).not.toBeNull();
        expect(agregado!.score).toBe(result.score);
        expect(agregado!.scoreAnonimo).toBe(result.scoreAnonimo);
        expect(agregado!.scoreAutenticado).toBe(result.scoreAutenticado);
        expect(agregado!.scoreAjustado).toBe(result.scoreAjustado);
        expect(agregado!.nivelRiesgo).toBe(result.nivelRiesgo);
    });
});

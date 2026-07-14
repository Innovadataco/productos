import { describe, it, expect, beforeEach } from "vitest";
import { calcularRanking, calcularNivelRiesgo } from "./ranking";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "./reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

async function crearReporteClasificado(
    identificador: string,
    plataformaId: string,
    categoria: CategoriaConducta,
    esAnonimo: boolean,
    creadoEn: Date
) {
    const numeroSeguimiento = `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para reporte clasificado.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
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

describe("calcularNivelRiesgo", () => {
    it("retorna BAJO por debajo del umbral inferior", () => {
        expect(calcularNivelRiesgo(20, { low: 30, medium: 70 })).toBe("BAJO");
    });
    it("retorna MEDIO entre umbrales", () => {
        expect(calcularNivelRiesgo(50, { low: 30, medium: 70 })).toBe("MEDIO");
    });
    it("retorna ALTO por encima del umbral medio", () => {
        expect(calcularNivelRiesgo(80, { low: 30, medium: 70 })).toBe("ALTO");
    });
});

describe("calcularRanking", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve score 0 para identificador sin reportes", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const result = await calcularRanking("+57300000000", plataforma!.id);
        expect(result.score).toBe(0);
        expect(result.totalReportes).toBe(0);
        expect(result.nivelRiesgo).toBe("BAJO");
    });

    it("aumenta score con reportes de categorías severas", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            await crearReporteClasificado(
                "+57300SEVERO",
                plataforma!.id,
                "COMPARTIMIENTO_SEXUAL",
                false,
                new Date(Date.now() - i * 86400000)
            );
        }
        const result = await calcularRanking("+57300SEVERO", plataforma!.id);
        expect(result.totalReportes).toBe(3);
        expect(result.categorias[0].categoria).toBe("COMPARTIMIENTO_SEXUAL");
        expect(result.score).toBeGreaterThan(0);
    });

    it("incluye distribución por ciudad y timeline", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteClasificado("+57300DIST", plataforma!.id, "OFRECIMIENTO_REGALOS", true, new Date());
        const result = await calcularRanking("+57300DIST", plataforma!.id);
        expect(result.distribucion.porCiudad["Bogotá"]).toBe(1);
        expect(result.distribucion.porPais["Colombia"]).toBe(1);
        expect(result.timeline.length).toBeGreaterThan(0);
    });
});

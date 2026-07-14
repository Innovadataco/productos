import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";

async function crearReporteVisible(numeroSeguimiento: string, identificador: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para seguimiento enriquecido.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: usuario.id,
            numeroSeguimiento,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.92,
            contienePii: true,
            piiDetectada: ["María"],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: plataforma!.id } },
        update: { totalReportes: 1, reportesAutenticados: 1, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId: plataforma!.id,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    return reporte;
}

describe("GET /api/reportes/seguimiento/[numero]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve 404 si el número no existe", async () => {
        const res = await GET(new Request("http://localhost:5005/api/reportes/seguimiento/RPT-NOEXISTE"), { params: Promise.resolve({ numero: "RPT-NOEXISTE" }) });
        expect(res.status).toBe(404);
    });

    it("devuelve clasificación y ranking cuando el identificador es visible", async () => {
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.report_threshold" }, data: { valor: "1" } });
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.min_authenticated_ratio" }, data: { valor: "0" } });

        const numero = "RPT-ENRICH";
        const identificador = "+57300ENRICH";
        await crearReporteVisible(numero, identificador);

        const res = await GET(new Request("http://localhost:5005/api/reportes/seguimiento/RPT-ENRICH"), { params: Promise.resolve({ numero }) });
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.numeroSeguimiento).toBe(numero);
        expect(body.clasificacion.categoria).toBe("OFRECIMIENTO_REGALOS");
        expect(body.clasificacion.categoriaLabel).toBe("Ofrecimiento de regalos");
        expect(body.clasificacion.contienePii).toBe(true);
        expect(body.ranking).not.toBeNull();
        expect(body.ranking.score).toBeGreaterThanOrEqual(0);
        expect(body.ranking.score).toBeLessThanOrEqual(100);
        expect(["BAJO", "MEDIO", "ALTO"]).toContain(body.ranking.nivelRiesgo);
    });
});

import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

async function crearReporteAgregado(
    identificador: string,
    plataformaId: string,
    categoria: CategoriaConducta,
    ciudad: string,
    pais: string,
    esAnonimo: boolean
) {
    const numeroSeguimiento = `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const ciudadRecord = await prisma.ciudad.findUnique({
        where: { nombre_paisId: { nombre: ciudad, paisId: (await prisma.pais.findUnique({ where: { codigo: "CO" } }))!.id } },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para estadísticas públicas.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad,
            pais,
            ciudadId: ciudadRecord?.id,
            paisId: ciudadRecord?.paisId,
            esAnonimo,
            numeroSeguimiento,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria,
            confianza: 0.8,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    return reporte;
}

async function crearIdentificador(
    identificador: string,
    plataformaId: string,
    score: number,
    nivelRiesgo: string
) {
    return prisma.identificadorReportado.create({
        data: {
            identificador,
            plataformaId,
            totalReportes: 1,
            score,
            nivelRiesgo,
            esVisiblePublicamente: true,
            actualizadoEn: new Date(),
        },
    });
}

describe("GET /api/estadisticas-publicas", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve estadísticas agregadas sin datos personales", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const instagram = await crearPlataforma("instagram", "Instagram", "red_social");

        for (let i = 0; i < 3; i++) {
            await crearReporteAgregado("+57300PUBLIC", plataforma!.id, "OFRECIMIENTO_REGALOS", "Bogotá", "Colombia", i === 0);
        }
        await crearReporteAgregado("+57300PUBLIC", instagram.id, "CONTACTO_INSISTENTE", "Bogotá", "Colombia", false);
        await crearReporteAgregado("+57300OTRO", plataforma!.id, "EXTORSION", "Medellín", "Colombia", false);

        await crearIdentificador("+57300PUBLIC", plataforma!.id, 75, "ALTO");
        await crearIdentificador("+57300OTRO", plataforma!.id, 45, "MEDIO");

        const res = await GET();
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.totales.reportes).toBe(5);
        expect(body.totales.identificadoresUnicos).toBe(2);
        expect(body.totales.reportesAutenticados).toBe(4);
        expect(body.totales.reportesAnonimos).toBe(1);
        expect(body.totales.scorePromedio).toBe(60);

        expect(body.porPlataforma).toHaveLength(2);
        const whatsappEntry = body.porPlataforma.find((p: { plataforma: string }) => p.plataforma === "WhatsApp");
        expect(whatsappEntry.count).toBe(4);

        expect(body.porPais).toHaveLength(1);
        expect(body.porPais[0].pais).toBe("Colombia");
        expect(body.porPais[0].count).toBe(5);

        expect(body.porCiudad).toHaveLength(2);
        const bogota = body.porCiudad.find((c: { ciudad: string }) => c.ciudad === "Bogotá");
        expect(bogota.count).toBe(4);
        expect(bogota.lat).toBe(4.711);
        expect(bogota.lng).toBe(-74.0721);

        expect(body.porNivelRiesgo).toHaveLength(2);
        expect(body.porCategoria).toHaveLength(3);

        expect(body.porGrupoCategoria).toBeDefined();
        expect(body.porGrupoCategoria.length).toBeGreaterThanOrEqual(2);
        const manipulacion = body.porGrupoCategoria.find(
            (g: { clave: string }) => g.clave === "manipulacion_engano"
        );
        expect(manipulacion.total).toBe(4);
        const amenazas = body.porGrupoCategoria.find(
            (g: { clave: string }) => g.clave === "amenazas_extorsion"
        );
        expect(amenazas.total).toBe(1);

        expect(body.ultimosIdentificadores).toBeUndefined();
        expect(body.texto).toBeUndefined();
        expect(body.email).toBeUndefined();
    });

    it("devuelve estructura vacía cuando no hay datos", async () => {
        const res = await GET();
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.totales.reportes).toBe(0);
        expect(body.porPlataforma).toEqual([]);
        expect(body.porCiudad).toEqual([]);
        expect(body.porGrupoCategoria).toEqual([]);
        expect(body.ultimosIdentificadores).toBeUndefined();
    });
});

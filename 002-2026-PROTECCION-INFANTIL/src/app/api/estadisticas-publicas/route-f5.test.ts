/**
 * SPEC-139 (F5, ZEUS D-4): estadísticas públicas — el público solo ve el
 * CONTEO agregado de identificadores con match, nunca el detalle (§1.3).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";

const TAG = Math.random().toString(36).slice(2, 8);

async function crearEvento(identificadorValor: string, plataformaId: string, agregadoId?: string) {
    const agregado =
        agregadoId !== undefined
            ? { id: agregadoId }
            : await prisma.identificadorReportado.upsert({
                where: { identificador_plataformaId: { identificador: identificadorValor, plataformaId } },
                update: {},
                create: { identificador: identificadorValor, plataformaId, totalReportes: 2, reportesAprobados: 2 },
            });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificadorValor,
            plataformaId,
            texto: "Texto de prueba de estadísticas públicas con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-${TAG}-${Math.random().toString(36).slice(2, 6)}`,
            estado: "CLASIFICADO",
        },
    });
    await prisma.eventoMatch.create({
        data: {
            identificadorId: agregado.id,
            reporteNuevoId: reporte.id,
            conteoAcumulado: 2,
            ciudades: ["Bogotá"],
            conductasCoincidentes: ["EXTORSION"],
            interCiudad: false,
        },
    });
    return agregado;
}

describe("GET /api/estadisticas-publicas (SPEC-139, F5: conteo agregado)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("expone identificadoresConMatch (distinct identificador) y NUNCA el detalle", async () => {
        const plataforma = await crearPlataforma();
        // Dos eventos del MISMO identificador + uno de otro → conteo 2.
        const agregado = await crearEvento(`+57361${TAG}`, plataforma.id);
        await crearEvento(`+57361${TAG}`, plataforma.id, agregado.id);
        await crearEvento(`+57362${TAG}`, plataforma.id);

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.totales.identificadoresConMatch).toBe(2);
        // El detalle del match NO sale en la superficie pública.
        const crudo = JSON.stringify(body);
        expect(crudo).not.toContain("conductasCoincidentes");
        expect(crudo).not.toContain("interCiudad");
        expect(crudo).not.toContain("reporteNuevoId");
    });

    it("sin matches: conteo 0", async () => {
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.totales.identificadoresConMatch).toBe(0);
    });
});

/**
 * SPEC-131 (BL-5): la visibilidad pública se decide SOLO con reportes aprobados
 * (predicado único spec 089/D-08). SPAM/OTRO no suman; un identificador solo-spam
 * no es visible; el ratio de autenticados se calcula sobre la base aprobada.
 * O-2: tras cada recálculo los contadores del agregado == predicado.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { crearParametrosReportes, crearPlataforma } from "./reporte-test-utils";
import { recalcularYGuardarScore } from "./scoring";
import { actualizarVisibilidadPublica } from "./visibility";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

let plataformaId: string;

async function crearReporte(
    identificador: string,
    estado: EstadoReporte,
    categoria: CategoriaConducta | null,
    esAnonimo: boolean,
    eliminado = false
) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para visibilidad.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo,
            numeroSeguimiento: `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            estado,
            eliminado,
        },
    });
    if (categoria) {
        await prisma.clasificacionIA.create({
            data: { reporteId: reporte.id, categoria, confianza: 0.9, contienePii: false, piiDetectada: [], modeloUsado: "ornith:9b", latenciaMs: 100 },
        });
    }
    return reporte;
}

async function visibilidadDe(identificador: string): Promise<boolean> {
    await actualizarVisibilidadPublica(identificador, plataformaId);
    const agregado = await prisma.identificadorReportado.findUnique({
        where: { identificador_plataformaId: { identificador, plataformaId } },
    });
    return agregado?.esVisiblePublicamente ?? false;
}

beforeEach(async () => {
    await resetDatabase();
    await crearParametrosReportes();
    const plat = await crearPlataforma();
    plataformaId = plat.id;
});

describe("visibilidad solo por aprobados (SPEC-131)", () => {
    it("SC-001: un identificador con SOLO spam NO es visible (conteo aprobado = 0)", async () => {
        const id = "+573100000001";
        await crearReporte(id, "POSIBLE_SPAM", "SPAM", true);
        await crearReporte(id, "CLASIFICADO", "SPAM", true);
        await crearReporte(id, "CLASIFICADO", "OTRO", false);
        await recalcularYGuardarScore(id, plataformaId);

        expect(await visibilidadDe(id)).toBe(false);
        const agregado = await prisma.identificadorReportado.findUnique({ where: { identificador_plataformaId: { identificador: id, plataformaId } } });
        expect(agregado?.reportesAprobados).toBe(0);
        expect(agregado?.autenticadosAprobados).toBe(0);
    });

    it("SC-002: el spam NO empuja al umbral (umbral-1 aprobados + spam → no visible)", async () => {
        const id = "+573100000002";
        // Umbral default = 3: solo 2 aprobados + 3 spam crudos.
        await crearReporte(id, "CLASIFICADO", "SOLICITUD_MATERIAL", false);
        await crearReporte(id, "CLASIFICADO", "CONTACTO_INSISTENTE", true);
        await crearReporte(id, "POSIBLE_SPAM", "SPAM", true);
        await crearReporte(id, "POSIBLE_SPAM", "SPAM", true);
        await crearReporte(id, "CLASIFICADO", "SPAM", true);
        await recalcularYGuardarScore(id, plataformaId);

        const agregado = await prisma.identificadorReportado.findUnique({ where: { identificador_plataformaId: { identificador: id, plataformaId } } });
        expect(agregado?.reportesAprobados).toBe(2);
        expect(agregado?.totalReportes).toBeGreaterThanOrEqual(2); // crudo queda para diagnóstico
        expect(await visibilidadDe(id)).toBe(false);
    });

    it("SC-002b: con el umbral de aprobados cumplido, es visible", async () => {
        const id = "+573100000003";
        await crearReporte(id, "CLASIFICADO", "SOLICITUD_MATERIAL", false);
        await crearReporte(id, "CLASIFICADO", "CONTACTO_INSISTENTE", false);
        await crearReporte(id, "CORREGIDO", "SUPLANTACION_IDENTIDAD", true);
        await recalcularYGuardarScore(id, plataformaId);

        expect(await visibilidadDe(id)).toBe(true);
    });

    it("SC-003: el ratio se calcula sobre la base aprobada (autenticados aprobados / aprobados)", async () => {
        const id = "+573100000004";
        // 3 aprobados: 1 autenticado (ratio 1/3 < 0.5 → no visible aun con umbral).
        await crearReporte(id, "CLASIFICADO", "SOLICITUD_MATERIAL", false);
        await crearReporte(id, "CLASIFICADO", "CONTACTO_INSISTENTE", true);
        await crearReporte(id, "CLASIFICADO", "SUPLANTACION_IDENTIDAD", true);
        // Spam autenticado: NO debe inflar los autenticados del ratio.
        await crearReporte(id, "CLASIFICADO", "SPAM", false);
        await recalcularYGuardarScore(id, plataformaId);

        const agregado = await prisma.identificadorReportado.findUnique({ where: { identificador_plataformaId: { identificador: id, plataformaId } } });
        expect(agregado?.reportesAprobados).toBe(3);
        expect(agregado?.autenticadosAprobados).toBe(1);
        expect(await visibilidadDe(id)).toBe(false);

        // Con 2 de 3 autenticados aprobados (ratio 2/3 ≥ 0.5) sí es visible.
        const id2 = "+573100000005";
        await crearReporte(id2, "CLASIFICADO", "SOLICITUD_MATERIAL", false);
        await crearReporte(id2, "CLASIFICADO", "CONTACTO_INSISTENTE", false);
        await crearReporte(id2, "CLASIFICADO", "SUPLANTACION_IDENTIDAD", true);
        await recalcularYGuardarScore(id2, plataformaId);
        expect(await visibilidadDe(id2)).toBe(true);
    });

    it("ocultoPorComiteEn gana aun con el umbral aprobado cumplido (SPEC-110 intacto)", async () => {
        const id = "+573100000006";
        await crearReporte(id, "CLASIFICADO", "SOLICITUD_MATERIAL", false);
        await crearReporte(id, "CLASIFICADO", "CONTACTO_INSISTENTE", false);
        await crearReporte(id, "CLASIFICADO", "SUPLANTACION_IDENTIDAD", false);
        await recalcularYGuardarScore(id, plataformaId);
        await prisma.identificadorReportado.update({
            where: { identificador_plataformaId: { identificador: id, plataformaId } },
            data: { ocultoPorComiteEn: new Date() },
        });

        expect(await visibilidadDe(id)).toBe(false);
    });

    it("O-2: tras corregir una categoría hacia SPAM, el recálculo baja los contadores aprobados", async () => {
        const id = "+573100000007";
        const r1 = await crearReporte(id, "CLASIFICADO", "SOLICITUD_MATERIAL", false);
        await crearReporte(id, "CLASIFICADO", "CONTACTO_INSISTENTE", false);
        await recalcularYGuardarScore(id, plataformaId);

        let agregado = await prisma.identificadorReportado.findUnique({ where: { identificador_plataformaId: { identificador: id, plataformaId } } });
        expect(agregado?.reportesAprobados).toBe(2);
        expect(agregado?.autenticadosAprobados).toBe(2);

        // Corrección humana: la categoría pasa a SPAM → deja de ser aprobado.
        await prisma.clasificacionIA.update({ where: { reporteId: r1.id }, data: { categoria: "SPAM" } });
        await recalcularYGuardarScore(id, plataformaId);

        agregado = await prisma.identificadorReportado.findUnique({ where: { identificador_plataformaId: { identificador: id, plataformaId } } });
        expect(agregado?.reportesAprobados).toBe(1);
        expect(agregado?.autenticadosAprobados).toBe(1);
        expect(await visibilidadDe(id)).toBe(false);
    });
});

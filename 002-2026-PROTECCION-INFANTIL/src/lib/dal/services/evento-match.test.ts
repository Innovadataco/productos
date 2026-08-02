/**
 * SPEC-139 (F5): detección del EventoMatch — ambos caminos usan este servicio.
 * Cubre SC-001 (fuentes distintas, conteo acumulado), SC-002 (mismo denunciante
 * y conservador sin huella), SC-003 (idempotencia), puerta D-08 e interCiudad.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { detectarYRegistrarMatch } from "./evento-match";

const TAG = Math.random().toString(36).slice(2, 8);
let correlativo = 0;

async function crearReporteAprobado(opciones: {
    identificador: string;
    plataformaId: string;
    ciudad?: string;
    categoria?: string;
    estado?: string;
    usuarioId?: string;
    huella?: string;
    eliminado?: boolean;
}) {
    correlativo += 1;
    const reporte = await prisma.reporte.create({
        data: {
            identificador: opciones.identificador,
            plataformaId: opciones.plataformaId,
            texto: "Texto de prueba del evento de match con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: opciones.ciudad ?? "Bogotá",
            pais: "Colombia",
            esAnonimo: !opciones.usuarioId,
            usuarioId: opciones.usuarioId ?? null,
            numeroSeguimiento: `RPT-${TAG}-${correlativo}`,
            estado: (opciones.estado ?? "CLASIFICADO") as "CLASIFICADO",
            eliminado: opciones.eliminado ?? false,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: (opciones.categoria ?? "EXTORSION") as "EXTORSION",
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 100,
        },
    });
    if (opciones.huella) {
        await prisma.fuenteReporte.create({
            data: { reporteId: reporte.id, ipHash: opciones.huella, pesoAplicado: 1 },
        });
    }
    return reporte;
}

async function crearAgregado(identificador: string, plataformaId: string) {
    return prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId } },
        update: {},
        create: { identificador, plataformaId, totalReportes: 1, reportesAprobados: 1 },
    });
}

describe("detectarYRegistrarMatch (SPEC-139, F5)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("SC-001: dos aprobados de usuarios distintos → UN evento con conteo 2 y metadatos", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57311${TAG}`;
        await crearAgregado(id, plataforma.id);
        const a = await crearUsuario("PARENT");
        const b = await crearUsuario("PARENT");
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id, ciudad: "Bogotá" });
        const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: b.id, ciudad: "Medellín" });

        const resultado = await detectarYRegistrarMatch(nuevo.id);
        expect(resultado.registrado).toBe(true);

        const evento = await prisma.eventoMatch.findUnique({ where: { reporteNuevoId: nuevo.id } });
        expect(evento).not.toBeNull();
        expect(evento!.conteoAcumulado).toBe(2);
        expect(evento!.ciudades).toEqual(["Bogotá", "Medellín"]);
        expect(evento!.conductasCoincidentes).toEqual(["EXTORSION"]);
        expect(evento!.interCiudad).toBe(true);

        // Auditoría de la mutación + paso de expediente (sin textos ni denunciantes).
        expect(await prisma.auditLog.count({ where: { accion: "MATCH_DETECTADO" } })).toBe(1);
        const paso = await prisma.pasoProcesamiento.findFirst({ where: { reporteId: nuevo.id, etapa: "match_detectado" } });
        expect(paso).not.toBeNull();
        expect(JSON.stringify(paso)).not.toContain(a.id);
    });

    it("SC-002a: mismo usuarioId → cero eventos", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57312${TAG}`;
        await crearAgregado(id, plataforma.id);
        const a = await crearUsuario("PARENT");
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id });
        const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id });

        const resultado = await detectarYRegistrarMatch(nuevo.id);
        expect(resultado.registrado).toBe(false);
        expect(await prisma.eventoMatch.count()).toBe(0);
    });

    it("SC-002b: anónimos con distinta huella S-1 → evento; misma huella → cero", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57313${TAG}`;
        await crearAgregado(id, plataforma.id);
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, huella: "huella-A" });
        const deOtraFuente = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, huella: "huella-B" });
        expect((await detectarYRegistrarMatch(deOtraFuente.id)).registrado).toBe(true);

        const id2 = `+57314${TAG}`;
        await crearAgregado(id2, plataforma.id);
        await crearReporteAprobado({ identificador: id2, plataformaId: plataforma.id, huella: "huella-A" });
        const mismaHuella = await crearReporteAprobado({ identificador: id2, plataformaId: plataforma.id, huella: "huella-A" });
        expect((await detectarYRegistrarMatch(mismaHuella.id)).registrado).toBe(false);
        expect(await prisma.eventoMatch.count()).toBe(1);
    });

    it("mixto autenticado + anónimo con huella → evento (distintos por construcción)", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57315${TAG}`;
        await crearAgregado(id, plataforma.id);
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, huella: "huella-A" });
        const autenticado = await crearUsuario("PARENT");
        const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: autenticado.id });

        expect((await detectarYRegistrarMatch(nuevo.id)).registrado).toBe(true);
        expect((await prisma.eventoMatch.findUnique({ where: { reporteNuevoId: nuevo.id } }))!.conteoAcumulado).toBe(2);
    });

    it("SC-002c (conservador): previo anónimo SIN huella no prueba fuente distinta → cero", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57316${TAG}`;
        await crearAgregado(id, plataforma.id);
        // Histórico pre-S-1: anónimo sin FuenteReporte.
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id });
        const autenticado = await crearUsuario("PARENT");
        const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: autenticado.id });

        expect((await detectarYRegistrarMatch(nuevo.id)).registrado).toBe(false);
        expect(await prisma.eventoMatch.count()).toBe(0);
    });

    it("SC-001b: tercer reporte de otra fuente → segundo evento con conteo 3", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57317${TAG}`;
        await crearAgregado(id, plataforma.id);
        const a = await crearUsuario("PARENT");
        const b = await crearUsuario("PARENT");
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id });
        const segundo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: b.id });
        await detectarYRegistrarMatch(segundo.id);
        const tercero = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, huella: "huella-C" });
        await detectarYRegistrarMatch(tercero.id);

        expect(await prisma.eventoMatch.count()).toBe(2);
        expect((await prisma.eventoMatch.findUnique({ where: { reporteNuevoId: tercero.id } }))!.conteoAcumulado).toBe(3);
    });

    it("SC-003: reintento sobre el mismo reporte no duplica el evento", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57318${TAG}`;
        await crearAgregado(id, plataforma.id);
        const a = await crearUsuario("PARENT");
        const b = await crearUsuario("PARENT");
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id });
        const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: b.id });

        expect((await detectarYRegistrarMatch(nuevo.id)).registrado).toBe(true);
        const reintento = await detectarYRegistrarMatch(nuevo.id);
        expect(reintento.registrado).toBe(false);
        expect(reintento.yaExistia).toBe(true);
        expect(await prisma.eventoMatch.count()).toBe(1);
    });

    it("puerta D-08: SPAM, OTRO, REVISION_MANUAL o eliminado → cero eventos", async () => {
        const plataforma = await crearPlataforma();
        const a = await crearUsuario("PARENT");
        const b = await crearUsuario("PARENT");

        for (const [idx, caso] of [
            { categoria: "SPAM" },
            { categoria: "OTRO" },
            { estado: "REVISION_MANUAL" },
            { eliminado: true },
        ].entries()) {
            const id = `+57319${TAG}${idx}`;
            await crearAgregado(id, plataforma.id);
            await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id });
            const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: b.id, ...caso });
            expect((await detectarYRegistrarMatch(nuevo.id)).registrado).toBe(false);
        }
        expect(await prisma.eventoMatch.count()).toBe(0);
    });

    it("interCiudad=false cuando todas las fuentes reportan desde la misma ciudad", async () => {
        const plataforma = await crearPlataforma();
        const id = `+57320${TAG}`;
        await crearAgregado(id, plataforma.id);
        const a = await crearUsuario("PARENT");
        const b = await crearUsuario("PARENT");
        await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: a.id, ciudad: "Cali" });
        const nuevo = await crearReporteAprobado({ identificador: id, plataformaId: plataforma.id, usuarioId: b.id, ciudad: "Cali" });

        await detectarYRegistrarMatch(nuevo.id);
        expect((await prisma.eventoMatch.findUnique({ where: { reporteNuevoId: nuevo.id } }))!.interCiudad).toBe(false);
    });
});

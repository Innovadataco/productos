/**
 * SPEC-158 (T003, FR-002/FR-005, SC-003) — Tests de
 * ColegioResumenRepository.tableroColegio:
 * - UNA llamada: embudo, reloj, serie mensual y top por curso se invocan UNA vez
 *   cada uno (Promise.all, cero N+1).
 * - Formas: ritmoMensual 12 puntos con ceros, reloj24h 24 posiciones, barrasCurso
 *   con nombre ordenadas descendente (30 días, D2).
 * - A/B tenant: B nunca ve actividad de A en ningún bloque.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearPlataforma,
} from "@/lib/reporte-test-utils";
import { ColegioResumenRepository } from "./colegio-resumen";
import { AlertaColegioRepository } from "./alerta-colegio";

const DIA_MS = 24 * 60 * 60 * 1000;

let contador = 0;

async function sembrarReporte(plataformaId: string, tag: string) {
    contador += 1;
    return prisma.reporte.create({
        data: {
            identificador: `+57314${String(contador).padStart(7, "0")}`,
            plataformaId,
            texto: `Reporte ${tag}`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-158T-${tag}-${contador}`,
            estado: "CLASIFICADO",
            eliminado: false,
        },
    });
}

async function sembrarAlerta(
    colegioId: string,
    identificadorId: string,
    reporteId: string,
    opts: { creadoEn?: Date; estado?: string } = {}
) {
    return prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            identificadorEstudianteId: identificadorId,
            estado: opts.estado ?? "vista",
            creadoEn: opts.creadoEn ?? new Date(),
            prioridad: "media",
            vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
    });
}

async function sembrarIdentificador(colegioId: string, cursoId: string, nombre: string) {
    contador += 1;
    const estudiante = await crearEstudiante(cursoId, colegioId, { nombre });
    return crearIdentificadorEstudiante(estudiante.id, { valor: `+57315${String(contador).padStart(7, "0")}` });
}

describe("ColegioResumenRepository.tableroColegio", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("A/B tenant y formas: embudo sin solapes, reloj 24 posiciones, ritmo 12 puntos, barras con nombre", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoTop = await crearCurso(a.id, { nombre: "8-B" });
        const cursoSegundo = await crearCurso(a.id, { nombre: "10-A" });
        const iTop = await sembrarIdentificador(a.id, cursoTop.id, "Est Top");
        const iSegundo = await sembrarIdentificador(a.id, cursoSegundo.id, "Est Segundo");

        const ahora = new Date();
        // Actividad de A: 2 reportes distintos en 8-B (hoy, D2 vía 2 alertas en uno)
        // y 1 en 10-A hace 10 días; estados mixtos para el embudo.
        const r1 = await sembrarReporte(plataforma.id, "a1");
        await sembrarAlerta(a.id, iTop.id, r1.id, { estado: "nueva" });
        const r2 = await sembrarReporte(plataforma.id, "a2");
        await sembrarAlerta(a.id, iTop.id, r2.id, { estado: "gestionada" });
        const r3 = await sembrarReporte(plataforma.id, "a3");
        await sembrarAlerta(a.id, iSegundo.id, r3.id, {
            estado: "vista",
            creadoEn: new Date(ahora.getTime() - 10 * DIA_MS),
        });
        // Fuera de la ventana de 30 días: cuenta en embudo/reloj/ritmo, NO en barras.
        const rViejo = await sembrarReporte(plataforma.id, "viejo");
        await sembrarAlerta(a.id, iTop.id, rViejo.id, {
            estado: "gestionada",
            creadoEn: new Date(ahora.getTime() - 45 * DIA_MS),
        });

        // Actividad de B (no debe cruzar).
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const iB = await sembrarIdentificador(b.id, cursoB.id, "Est DeB");
        const rB = await sembrarReporte(plataforma.id, "deB");
        await sembrarAlerta(b.id, iB.id, rB.id, { estado: "nueva" });

        const repo = new ColegioResumenRepository();
        const tablero = await repo.tableroColegio(a.id);

        // Embudo: 4 reportes distintos de A, cada uno en su bucket más pendiente.
        expect(tablero.embudo).toEqual({ recibidos: 4, cerrados: 2, enRevision: 1, teEsperan: 1 });
        expect(tablero.embudo.cerrados + tablero.embudo.enRevision + tablero.embudo.teEsperan).toBe(tablero.embudo.recibidos);

        // Reloj: 24 posiciones; los 4 reportes de A caen en alguna hora.
        expect(tablero.reloj24h).toHaveLength(24);
        expect(tablero.reloj24h.reduce((suma, v) => suma + v, 0)).toBe(4);

        // Ritmo mensual: 12 puntos; los 4 reportes caen en los últimos 12 meses.
        expect(tablero.ritmoMensual).toHaveLength(12);
        expect(tablero.ritmoMensual.reduce((suma, p) => suma + p.reportes, 0)).toBe(4);

        // Barras por curso (30 días, D2, con nombre, descendente): 8-B (2) > 10-A (1);
        // el reporte de 45 días NO cuenta.
        expect(tablero.barrasCurso.map((c) => c.nombre)).toEqual(["8-B", "10-A"]);
        expect(tablero.barrasCurso[0]).toMatchObject({ cursoId: cursoTop.id, reportes30d: 2 });
        expect(tablero.barrasCurso[1]).toMatchObject({ cursoId: cursoSegundo.id, reportes30d: 1 });

        // Tenant cruzado: B solo ve lo suyo en TODOS los bloques.
        const tableroB = await repo.tableroColegio(b.id);
        expect(tableroB.embudo).toEqual({ recibidos: 1, cerrados: 0, enRevision: 0, teEsperan: 1 });
        expect(tableroB.reloj24h.reduce((suma, v) => suma + v, 0)).toBe(1);
        expect(tableroB.barrasCurso.map((c) => c.nombre)).toEqual(["1-A"]);
        expect(tableroB.ritmoMensual.reduce((suma, p) => suma + p.reportes, 0)).toBe(1);
    });

    it("UNA llamada: cada agregado del repo hijo se invoca una vez por carga (SC-003)", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const espiaEmbudo = vi.spyOn(AlertaColegioRepository.prototype, "embudoPorReporte");
        const espiaReloj = vi.spyOn(AlertaColegioRepository.prototype, "reloj24h");
        const espiaSerie = vi.spyOn(AlertaColegioRepository.prototype, "serieReportesPorPeriodo");
        const espiaTop = vi.spyOn(AlertaColegioRepository.prototype, "topCursosPorReportes");

        const tablero = await new ColegioResumenRepository().tableroColegio(a.id);

        expect(espiaEmbudo).toHaveBeenCalledTimes(1);
        expect(espiaReloj).toHaveBeenCalledTimes(1);
        expect(espiaSerie).toHaveBeenCalledTimes(1); // solo la serie mensual
        expect(espiaTop).toHaveBeenCalledTimes(1);

        // Colegio vacío: estados honestos (ceros, series dibujables, sin NaN).
        expect(tablero.embudo).toEqual({ recibidos: 0, cerrados: 0, enRevision: 0, teEsperan: 0 });
        expect(tablero.reloj24h).toHaveLength(24);
        expect(tablero.reloj24h.every((v) => v === 0)).toBe(true);
        expect(tablero.ritmoMensual).toHaveLength(12);
        expect(tablero.barrasCurso).toEqual([]);
    });
});

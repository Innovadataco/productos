/**
 * SPEC-158 (T001/T002, FR-003/FR-004, SC-001/SC-002) — Tests de los agregados del
 * tablero de control en AlertaColegioRepository:
 * - embudoPorReporte: UN bucket por reporte según su estado más pendiente
 *   (nueva > vista > gestionada), sin solapes: recibidos = cerrados + enRevision
 *   + teEsperan (fixture mixto de 5 reportes → 5/2/1/2).
 * - reloj24h: hora de Colombia (America/Bogota, UTC-5) — un reporte a las 02:00
 *   UTC pica en la hora 21; D2 (mismo reporte, 2 alertas a la misma hora cuenta
 *   UNA vez); 24 posiciones con ceros.
 * - A/B tenant: el colegio B nunca se cuela en los agregados de A.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearPlataforma,
} from "@/lib/reporte-test-utils";
import { AlertaColegioRepository } from "./alerta-colegio";

let contador = 0;

async function sembrarReporte(plataformaId: string, tag: string) {
    contador += 1;
    return prisma.reporte.create({
        data: {
            identificador: `+57312${String(contador).padStart(7, "0")}`,
            plataformaId,
            texto: `Reporte ${tag}`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-158-${tag}-${contador}`,
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
        },
    });
}

/** Dos identificadores del colegio (permiten 2 alertas del MISMO reporte). */
async function sembrarParIdentificadores(colegioId: string, cursoId: string) {
    const e1 = await crearEstudiante(cursoId, colegioId, { nombre: "Est Uno" });
    const e2 = await crearEstudiante(cursoId, colegioId, { nombre: "Est Dos" });
    const i1 = await crearIdentificadorEstudiante(e1.id, { valor: `+57313${String(Date.now()).slice(-7)}1` });
    const i2 = await crearIdentificadorEstudiante(e2.id, { valor: `+57313${String(Date.now()).slice(-7)}2` });
    return { i1, i2 };
}

describe("AlertaColegioRepository.embudoPorReporte", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("fixture mixto: cada reporte en UN bucket según su estado más pendiente, sin solapes (SC-001)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        const { i1, i2 } = await sembrarParIdentificadores(a.id, cursoA.id);

        // 2 reportes solo gestionadas → cerrados.
        const r1 = await sembrarReporte(plataforma.id, "g1");
        await sembrarAlerta(a.id, i1.id, r1.id, { estado: "gestionada" });
        const r2 = await sembrarReporte(plataforma.id, "g2");
        await sembrarAlerta(a.id, i1.id, r2.id, { estado: "gestionada" });
        // 1 reporte vista → en revisión.
        const r3 = await sembrarReporte(plataforma.id, "v1");
        await sembrarAlerta(a.id, i1.id, r3.id, { estado: "vista" });
        // 1 reporte nueva → te esperan a ti.
        const r4 = await sembrarReporte(plataforma.id, "n1");
        await sembrarAlerta(a.id, i1.id, r4.id, { estado: "nueva" });
        // 1 reporte nueva + gestionada → te esperan a ti (el estado más pendiente manda).
        const r5 = await sembrarReporte(plataforma.id, "ng");
        await sembrarAlerta(a.id, i1.id, r5.id, { estado: "gestionada" });
        await sembrarAlerta(a.id, i2.id, r5.id, { estado: "nueva" });

        const embudo = await new AlertaColegioRepository().embudoPorReporte(a.id);

        expect(embudo).toEqual({ recibidos: 5, cerrados: 2, enRevision: 1, teEsperan: 2 });
        // Sin solapes: los buckets exclusivos suman exactamente los recibidos.
        expect(embudo.cerrados + embudo.enRevision + embudo.teEsperan).toBe(embudo.recibidos);
    });

    it("A/B tenant y reportes eliminados: B no se cuela y los eliminados no cuentan", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const deA = await sembrarParIdentificadores(a.id, cursoA.id);
        const deB = await sembrarParIdentificadores(b.id, cursoB.id);

        const rA = await sembrarReporte(plataforma.id, "deA");
        await sembrarAlerta(a.id, deA.i1.id, rA.id, { estado: "nueva" });
        const rB = await sembrarReporte(plataforma.id, "deB");
        await sembrarAlerta(b.id, deB.i1.id, rB.id, { estado: "gestionada" });
        // Reporte eliminado con alerta nueva: no cuenta.
        const rEliminado = await sembrarReporte(plataforma.id, "elim");
        await sembrarAlerta(a.id, deA.i2.id, rEliminado.id, { estado: "nueva" });
        await prisma.reporte.update({ where: { id: rEliminado.id }, data: { eliminado: true } });

        const repo = new AlertaColegioRepository();
        const embudoA = await repo.embudoPorReporte(a.id);
        expect(embudoA).toEqual({ recibidos: 1, cerrados: 0, enRevision: 0, teEsperan: 1 });

        const embudoB = await repo.embudoPorReporte(b.id);
        expect(embudoB).toEqual({ recibidos: 1, cerrados: 1, enRevision: 0, teEsperan: 0 });

        // Colegio sin alertas: ceros honestos.
        const { colegio: vacio } = await crearColegioConAdmin();
        expect(await repo.embudoPorReporte(vacio.id)).toEqual({ recibidos: 0, cerrados: 0, enRevision: 0, teEsperan: 0 });
    });
});

describe("AlertaColegioRepository.reloj24h", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("hora Bogotá: un reporte a las 02:00 UTC pica en la hora 21; ceros rellenos (SC-002)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        const { i1, i2 } = await sembrarParIdentificadores(a.id, cursoA.id);

        // 02:00 UTC del 2 de agosto = 21:00 del 1 de agosto en Bogotá → hora 21.
        // D2: el MISMO reporte con 2 alertas a esa hora cuenta UNA vez.
        const rNoche = await sembrarReporte(plataforma.id, "noche");
        await sembrarAlerta(a.id, i1.id, rNoche.id, { creadoEn: new Date("2026-08-02T02:00:00Z") });
        await sembrarAlerta(a.id, i2.id, rNoche.id, { creadoEn: new Date("2026-08-02T02:30:00Z") });
        // 14:30 UTC = 09:30 Bogotá → hora 9.
        const rManana = await sembrarReporte(plataforma.id, "manana");
        await sembrarAlerta(a.id, i1.id, rManana.id, { creadoEn: new Date("2026-08-02T14:30:00Z") });

        const reloj = await new AlertaColegioRepository().reloj24h(a.id);

        expect(reloj).toHaveLength(24);
        expect(reloj[21]).toBe(1); // D2: 2 alertas, 1 reporte
        expect(reloj[9]).toBe(1);
        expect(reloj.reduce((suma, v) => suma + v, 0)).toBe(2);
        // Ceros rellenos: el resto de horas están en cero.
        expect(reloj.filter((_, hora) => hora !== 21 && hora !== 9).every((v) => v === 0)).toBe(true);
    });

    it("A/B tenant: la actividad de B no se cuela al reloj de A; colegio vacío → 24 ceros", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const deB = await sembrarParIdentificadores(b.id, cursoB.id);

        const rB = await sembrarReporte(plataforma.id, "deB");
        await sembrarAlerta(b.id, deB.i1.id, rB.id, { creadoEn: new Date("2026-08-02T04:00:00Z") }); // 23 h Bogotá

        const repo = new AlertaColegioRepository();
        const relojA = await repo.reloj24h(a.id);
        expect(relojA).toHaveLength(24);
        expect(relojA.every((v) => v === 0)).toBe(true);

        const relojB = await repo.reloj24h(b.id);
        expect(relojB[23]).toBe(1);
        expect(relojB.reduce((suma, v) => suma + v, 0)).toBe(1);
    });
});

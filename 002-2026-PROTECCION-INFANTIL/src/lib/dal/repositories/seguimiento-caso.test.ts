/**
 * SPEC-159 (T002, FR-001/FR-004): tests del repo de seguimiento del caso.
 * A/B con dos colegios: B nunca ve lo de A. El seguimiento es 1:1 LAZY
 * (obtenerOCrear dos veces ⇒ UNA fila); las notas salen asc con autor legible.
 * El detalle de la alerta NUNCA incluye el valor del identificador (I-28).
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
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import { AlertaColegioRepository } from "./alerta-colegio";
import { SeguimientoCasoRepository } from "./seguimiento-caso";

async function fixtureAlerta(identificadorValor: string) {
    const { admin, colegio } = await crearColegioConAdmin();
    const curso = await crearCurso(colegio.id, { nombre: "6A", grado: "Sexto" });
    const alumno = await crearEstudiante(curso.id, colegio.id, { nombre: "María", apellidos: "Gómez" });
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const identificador = await crearIdentificadorEstudiante(alumno.id, {
        valor: identificadorValor,
        plataformaId: plataforma!.id,
        etiquetaRelacion: "ESTUDIANTE",
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificadorValor,
            plataformaId: plataforma!.id,
            texto: "Texto confidencial del reporte",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            edadVictima: 12,
            estado: "CLASIFICADO",
            numeroSeguimiento: `RPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        },
    });
    const alerta = await new AlertaColegioRepository().crear({
        colegioId: colegio.id,
        reporteId: reporte.id,
        tipoSujeto: "ESTUDIANTE",
        identificadorEstudianteId: identificador.id,
    });
    return { admin, colegio, reporte, alerta };
}

describe("SeguimientoCasoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    });

    it("obtenerOCrearPorAlerta nace LAZY: dos llamadas ⇒ UNA fila (unique alertaId)", async () => {
        const { colegio, alerta } = await fixtureAlerta("+57300SEGUI1");
        const repo = new SeguimientoCasoRepository();

        expect(await repo.obtenerPorAlerta(colegio.id, alerta.id)).toBeNull();

        const primero = await repo.obtenerOCrearPorAlerta(colegio.id, alerta.id);
        const segundo = await repo.obtenerOCrearPorAlerta(colegio.id, alerta.id);
        expect(segundo.id).toBe(primero.id);
        expect(primero.estado).toBe("en_seguimiento");
        expect(await prisma.seguimientoCaso.count()).toBe(1);
    });

    it("agregarNota + obtenerPorAlerta: notas asc con autor legible", async () => {
        const { admin, colegio, alerta } = await fixtureAlerta("+57300SEGUI2");
        const repo = new SeguimientoCasoRepository();
        const seguimiento = await repo.obtenerOCrearPorAlerta(colegio.id, alerta.id);

        await repo.agregarNota({ seguimientoId: seguimiento.id, colegioId: colegio.id, texto: "Primera nota", autorId: admin.id });
        await repo.agregarNota({ seguimientoId: seguimiento.id, colegioId: colegio.id, texto: "Segunda nota", autorId: admin.id });

        const cargado = await repo.obtenerPorAlerta(colegio.id, alerta.id);
        expect(cargado?.notas.map((n) => n.texto)).toEqual(["Primera nota", "Segunda nota"]);
        expect(cargado?.notas[0]?.autor.email).toBe(admin.email);
    });

    it("A/B: el colegio B no ve ni crea seguimiento sobre la alerta de A", async () => {
        const { colegio: colegioA, alerta } = await fixtureAlerta("+57300SEGUI3");
        const { colegio: colegioB } = await crearColegioConAdmin();
        const repo = new SeguimientoCasoRepository();

        await repo.obtenerOCrearPorAlerta(colegioA.id, alerta.id);
        expect(await repo.obtenerPorAlerta(colegioB.id, alerta.id)).toBeNull();
        expect(await prisma.seguimientoCaso.count()).toBe(1);
    });
});

describe("AlertaColegioRepository.obtenerDetalleConCurso", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    });

    it("devuelve estudiante/curso/plataforma/tipo y NUNCA el valor del identificador (I-28)", async () => {
        const { colegio, alerta } = await fixtureAlerta("+57300SECRETO");
        const detalle = await new AlertaColegioRepository().obtenerDetalleConCurso(colegio.id, alerta.id);

        expect(detalle).not.toBeNull();
        expect(detalle!.identificadorEstudiante?.estudiante.nombre).toBe("María");
        expect(detalle!.identificadorEstudiante?.estudiante.apellidos).toBe("Gómez");
        expect(detalle!.identificadorEstudiante?.estudiante.curso.nombre).toBe("6A");
        expect(detalle!.identificadorEstudiante?.plataforma?.nombre).toBe("WhatsApp");
        expect(detalle!.identificadorEstudiante?.tipo).toBeDefined();

        const serializado = JSON.stringify(detalle);
        expect(serializado).not.toContain("+57300SECRETO");
        expect(serializado).not.toContain("Texto confidencial");
    });

    it("A/B: null si la alerta es de OTRO colegio", async () => {
        const { alerta } = await fixtureAlerta("+57300SEGUI4");
        const { colegio: colegioB } = await crearColegioConAdmin();
        expect(await new AlertaColegioRepository().obtenerDetalleConCurso(colegioB.id, alerta.id)).toBeNull();
    });
});

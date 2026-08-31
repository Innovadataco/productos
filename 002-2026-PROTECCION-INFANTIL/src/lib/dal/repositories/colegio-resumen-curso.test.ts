/**
 * SPEC-147 (T001-T003, FR-002/FR-006, SC-001) — Tests del escritorio del curso:
 * - A/B tenant: cursoDetalle solo ve el curso del colegio; curso ajeno → 404.
 * - Cobertura exacta del curso (fixture 10: 7 con identificador, 5 con acudiente).
 * - Métrica D2 por curso: COUNT(DISTINCT reporteId) con delta vs 30d anteriores.
 * - Include sin N+1: acudientes (orden asc) + identificadores ACTIVOS en UN findMany.
 * - Titular con su estado (COND-2 de SPEC-145: inactivo se muestra marcado).
 * - contarCobertura parametrizada por curso (firma aditiva, colegio intacto).
 * - Curso sin estudiantes: ceros sin NaN.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearPlataforma, crearProfesor } from "@/lib/reporte-test-utils";
import { ColegioResumenRepository } from "./colegio-resumen";
import { EstudianteRepository } from "./estudiante";
import { AlertaColegioRepository } from "./alerta-colegio";
import { CursoRepository } from "./curso";

const DIA_MS = 24 * 60 * 60 * 1000;

let contador = 0;

async function sembrarReporte(plataformaId: string, tag: string, opts: { eliminado?: boolean } = {}) {
    return prisma.reporte.create({
        data: {
            identificador: `+57312${String(contador).padStart(7, "0")}`,
            plataformaId,
            texto: `Reporte ${tag}`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-147-${tag}-${contador}`,
            estado: "CLASIFICADO",
            eliminado: opts.eliminado ?? false,
        },
    });
}

/** Estudiante activo; opcionalmente con identificador(es) y hasta 2 acudientes. */
async function sembrarEstudiante(
    colegioId: string,
    cursoId: string,
    apellidos: string,
    opts: {
        conIdentificador?: boolean;
        segundoIdentificador?: boolean;
        identificadorInactivoExtra?: boolean;
        acudientes?: 0 | 1 | 2;
    } = {}
) {
    contador += 1;
    const estudiante = await prisma.estudiante.create({
        data: { cursoId, colegioId, nombre: `Est ${contador}`, apellidos, estado: "activo" },
    });
    let identificador: { id: string } | null = null;
    if (opts.conIdentificador) {
        identificador = await prisma.identificadorEstudiante.create({
            data: {
                estudianteId: estudiante.id,
                colegioId,
                tipo: "telefono",
                valor: `+57313${String(contador).padStart(7, "0")}`,
                etiquetaRelacion: "ESTUDIANTE",
                estado: "activo",
            },
        });
        if (opts.segundoIdentificador) {
            await prisma.identificadorEstudiante.create({
                data: {
                    estudianteId: estudiante.id,
                    colegioId,
                    tipo: "nick",
                    valor: `nick-${contador}`,
                    etiquetaRelacion: "ESTUDIANTE",
                    estado: "activo",
                },
            });
        }
    }
    if (opts.identificadorInactivoExtra) {
        await prisma.identificadorEstudiante.create({
            data: {
                estudianteId: estudiante.id,
                colegioId,
                tipo: "nick",
                valor: `viejo-${contador}`,
                etiquetaRelacion: "ESTUDIANTE",
                estado: "inactivo",
            },
        });
    }
    for (let orden = 1; orden <= (opts.acudientes ?? 0); orden += 1) {
        await prisma.acudienteEstudiante.create({
            data: {
                estudianteId: estudiante.id,
                orden,
                nombre: `Acudiente ${orden} de ${apellidos}`,
                relacion: orden === 1 ? "madre" : "padre",
                telefono: orden === 1 ? "+573001112233" : null,
                email: orden === 2 ? "padre@example.com" : null,
            },
        });
    }
    return { estudiante, identificador };
}

async function sembrarAlerta(colegioId: string, identificadorId: string, reporteId: string, creadoEn?: Date) {
    return prisma.alertaColegio.create({
        data: {
            colegioId,
            reporteId,
            identificadorEstudianteId: identificadorId,
            estado: "vista",
            creadoEn: creadoEn ?? new Date(),
            prioridad: "media",
            vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
    });
}

describe("ColegioResumenRepository.cursoDetalle", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("A/B tenant: devuelve el DTO completo del curso propio y 404 para el curso ajeno", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const titular = await crearProfesor(a.id, { nombre: "María", apellidos: "López" });
        const cursoA = await crearCurso(a.id, { nombre: "8-B", grado: "8", profesorTitularId: titular.id });
        const cursoA2 = await crearCurso(a.id, { nombre: "9-A" });

        // Fixture del spec: 10 activos, 7 con identificador, 5 con acudiente.
        const conIdentificador: { identificador: { id: string } | null }[] = [];
        for (let i = 0; i < 10; i += 1) {
            const e = await sembrarEstudiante(a.id, cursoA.id, `Ap${String(i).padStart(2, "0")}`, {
                conIdentificador: i < 7,
                // El primero suma un 2º identificador activo (total identificadores = 8)
                // y un identificador INACTIVO que NO debe aparecer en el include.
                segundoIdentificador: i === 0,
                identificadorInactivoExtra: i === 0,
                acudientes: i === 0 ? 2 : i < 5 ? 1 : 0,
            });
            conIdentificador.push(e);
        }
        // Estudiante inactivo: no se lista ni cuenta en cobertura.
        await prisma.estudiante.create({
            data: { cursoId: cursoA.id, colegioId: a.id, nombre: "Inactivo", apellidos: "Zz", estado: "inactivo" },
        });

        // Actividad del curso: r1 hoy con DOS alertas (cuenta UNA, D2); r2 hace 5d;
        // r3 hace 40d (ventana previa); r4 hoy en OTRO curso del mismo colegio;
        // r5 hoy pero reporte eliminado.
        const ahora = new Date();
        const r1 = await sembrarReporte(plataforma.id, "hoy");
        await sembrarAlerta(a.id, conIdentificador[0]!.identificador!.id, r1.id);
        await sembrarAlerta(a.id, conIdentificador[1]!.identificador!.id, r1.id);
        const r2 = await sembrarReporte(plataforma.id, "5d");
        await sembrarAlerta(a.id, conIdentificador[2]!.identificador!.id, r2.id, new Date(ahora.getTime() - 5 * DIA_MS));
        const r3 = await sembrarReporte(plataforma.id, "40d");
        await sembrarAlerta(a.id, conIdentificador[3]!.identificador!.id, r3.id, new Date(ahora.getTime() - 40 * DIA_MS));
        const eOtroCurso = await sembrarEstudiante(a.id, cursoA2.id, "Otroc", { conIdentificador: true });
        const r4 = await sembrarReporte(plataforma.id, "otro-curso");
        await sembrarAlerta(a.id, eOtroCurso.identificador!.id, r4.id);
        const r5 = await sembrarReporte(plataforma.id, "eliminado", { eliminado: true });
        await sembrarAlerta(a.id, conIdentificador[4]!.identificador!.id, r5.id);

        // Actividad de B (no cruza a A).
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const deB = await sembrarEstudiante(b.id, cursoB.id, "Deb", { conIdentificador: true });
        const rB = await sembrarReporte(plataforma.id, "deB");
        await sembrarAlerta(b.id, deB.identificador!.id, rB.id);

        const repo = new ColegioResumenRepository();
        const detalle = await repo.cursoDetalle(a.id, cursoA.id);

        // Curso + titular con su estado.
        expect(detalle.curso.nombre).toBe("8-B");
        expect(detalle.curso.grado).toBe("8");
        expect(detalle.curso.estado).toBe("activo");
        expect(detalle.titular).toEqual({ nombre: "María", apellidos: "López", estado: "activo" });

        // Estudiantes: solo activos del curso, orden apellidos→nombre, con includes.
        expect(detalle.estudiantes).toHaveLength(10);
        expect(detalle.estudiantes[0]!.apellidos).toBe("Ap00");
        expect(detalle.estudiantes[9]!.apellidos).toBe("Ap09");
        const primero = detalle.estudiantes[0]!;
        expect(primero.acudientes.map((x) => x.orden)).toEqual([1, 2]);
        expect(primero.identificadores).toHaveLength(2); // el inactivo NO entra
        expect(primero.identificadores.every((x) => x.estado === "activo")).toBe(true);

        // Cobertura exacta del CURSO (70% / 50%) con huecos en personas.
        expect(detalle.cobertura.vigilancia).toBeCloseTo(0.7, 10);
        expect(detalle.cobertura.reaccion).toBeCloseTo(0.5, 10);
        expect(detalle.cobertura.sinRedes).toBe(3);
        expect(detalle.cobertura.sinContacto).toBe(5);

        // D2 + delta: 2 reportes distintos en 30d (r1×2 alertas cuenta 1 + r2);
        // ni el otro curso (r4), ni el eliminado (r5), ni B cuentan.
        expect(detalle.alertas30d).toBe(2);
        expect(detalle.delta30d).toBe(1); // 30d previos = 1 (r3 a los 40d)

        // Tarjeta Identificadores: 7 + 1 extra activo del primero.
        expect(detalle.identificadoresActivos).toBe(8);

        // 404 para curso ajeno (tenant-first E-1) y para id inexistente.
        await expect(repo.cursoDetalle(b.id, cursoA.id)).rejects.toMatchObject({
            message: "Curso no encontrado",
            statusCode: 404,
        });
        await expect(repo.cursoDetalle(a.id, cursoB.id)).rejects.toMatchObject({ statusCode: 404 });

        // B ve lo suyo y nada más.
        const detalleB = await repo.cursoDetalle(b.id, cursoB.id);
        expect(detalleB.alertas30d).toBe(1);
        expect(detalleB.estudiantes).toHaveLength(1);
        expect(detalleB.titular).toBeNull();
    });

    it("titular inactivo se devuelve con su estado (COND-2 de SPEC-145); sin titular → null", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const profesorInactivo = await crearProfesor(a.id, { nombre: "Ana", apellidos: "Ruiz", estado: "inactivo" });
        const conInactivo = await crearCurso(a.id, { nombre: "7-C", profesorTitularId: profesorInactivo.id });
        const sinTitular = await crearCurso(a.id, { nombre: "6-D" });

        const repo = new ColegioResumenRepository();
        const detalleInactivo = await repo.cursoDetalle(a.id, conInactivo.id);
        expect(detalleInactivo.titular).toEqual({ nombre: "Ana", apellidos: "Ruiz", estado: "inactivo" });

        const detalleSin = await repo.cursoDetalle(a.id, sinTitular.id);
        expect(detalleSin.titular).toBeNull();
    });

    it("curso sin estudiantes: ceros sin NaN", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const curso = await crearCurso(a.id, { nombre: "Vacío" });

        const detalle = await new ColegioResumenRepository().cursoDetalle(a.id, curso.id);
        expect(detalle.estudiantes).toEqual([]);
        expect(detalle.cobertura).toEqual({ vigilancia: 0, reaccion: 0, sinRedes: 0, sinContacto: 0 });
        expect(detalle.alertas30d).toBe(0);
        expect(detalle.delta30d).toBe(0);
        expect(detalle.identificadoresActivos).toBe(0);
    });

    it("UNA llamada: cada consulta del repo hijo se invoca una vez por carga (sin N+1)", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const curso = await crearCurso(a.id, { nombre: "8-B" });
        const espiaCursos = vi.spyOn(CursoRepository.prototype, "obtenerConTitularPorIds");
        const espiaDetalle = vi.spyOn(EstudianteRepository.prototype, "listarPorCursoConDetalle");
        const espiaCobertura = vi.spyOn(EstudianteRepository.prototype, "contarCobertura");
        const espiaConteos = vi.spyOn(AlertaColegioRepository.prototype, "contarReportesDistintosPorCurso");

        await new ColegioResumenRepository().cursoDetalle(a.id, curso.id);

        expect(espiaCursos).toHaveBeenCalledTimes(1);
        expect(espiaDetalle).toHaveBeenCalledTimes(1);
        expect(espiaCobertura).toHaveBeenCalledTimes(1);
        expect(espiaConteos).toHaveBeenCalledTimes(2); // [0-30d) y [30-60d)
    });
});

describe("EstudianteRepository.contarCobertura parametrizada por curso (aditivo)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("con cursoId acota al curso; sin él el conteo del colegio queda idéntico", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        const cursoB = await crearCurso(a.id, { nombre: "9-A" });

        // Curso A: 3 activos — 2 con identificador, 1 con acudiente.
        await sembrarEstudiante(a.id, cursoA.id, "Uno", { conIdentificador: true, acudientes: 1 });
        await sembrarEstudiante(a.id, cursoA.id, "Dos", { conIdentificador: true });
        await sembrarEstudiante(a.id, cursoA.id, "Tres", {});
        // Curso B: 1 activo sin nada + 1 inactivo (no cuenta en ningún nivel).
        await sembrarEstudiante(a.id, cursoB.id, "Cuatro", {});
        await prisma.estudiante.create({
            data: { cursoId: cursoB.id, colegioId: a.id, nombre: "Inactivo", apellidos: "Cinco", estado: "inactivo" },
        });

        const repo = new EstudianteRepository();
        const delColegio = await repo.contarCobertura(a.id);
        expect(delColegio).toEqual({ activos: 4, conIdentificadores: 2, conAcudientes: 1 });

        const delCurso = await repo.contarCobertura(a.id, cursoA.id);
        expect(delCurso).toEqual({ activos: 3, conIdentificadores: 2, conAcudientes: 1 });

        const delCursoB = await repo.contarCobertura(a.id, cursoB.id);
        expect(delCursoB).toEqual({ activos: 1, conIdentificadores: 0, conAcudientes: 0 });
    });
});

describe("AlertaColegioRepository.contarReportesDistintosPorCurso", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("respeta las ventanas [0-30d) y [30-60d), el curso y el tenant", async () => {
        const plataforma = await crearPlataforma();
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoA = await crearCurso(a.id, { nombre: "8-B" });
        const cursoA2 = await crearCurso(a.id, { nombre: "9-A" });

        const e1 = await sembrarEstudiante(a.id, cursoA.id, "Uno", { conIdentificador: true });
        const e2 = await sembrarEstudiante(a.id, cursoA.id, "Dos", { conIdentificador: true });
        const eOtro = await sembrarEstudiante(a.id, cursoA2.id, "Tres", { conIdentificador: true });

        const ahora = new Date();
        // Ventana actual: r1 con 2 alertas (cuenta 1, D2) + r2 → 2 distintos.
        const r1 = await sembrarReporte(plataforma.id, "v1");
        await sembrarAlerta(a.id, e1.identificador!.id, r1.id, new Date(ahora.getTime() - 2 * DIA_MS));
        await sembrarAlerta(a.id, e2.identificador!.id, r1.id, new Date(ahora.getTime() - 2 * DIA_MS));
        const r2 = await sembrarReporte(plataforma.id, "v2");
        await sembrarAlerta(a.id, e1.identificador!.id, r2.id, new Date(ahora.getTime() - 10 * DIA_MS));
        // Ventana previa [30-60d): 1 distinto. Fuera de 60d: no cuenta.
        const r3 = await sembrarReporte(plataforma.id, "v3");
        await sembrarAlerta(a.id, e1.identificador!.id, r3.id, new Date(ahora.getTime() - 40 * DIA_MS));
        const r4 = await sembrarReporte(plataforma.id, "v4");
        await sembrarAlerta(a.id, e1.identificador!.id, r4.id, new Date(ahora.getTime() - 70 * DIA_MS));
        // Otro curso del mismo colegio y otro colegio: no cuentan.
        const r5 = await sembrarReporte(plataforma.id, "v5");
        await sembrarAlerta(a.id, eOtro.identificador!.id, r5.id, new Date(ahora.getTime() - 1 * DIA_MS));
        const cursoB = await crearCurso(b.id, { nombre: "1-A" });
        const eB = await sembrarEstudiante(b.id, cursoB.id, "Seis", { conIdentificador: true });
        const rB = await sembrarReporte(plataforma.id, "vB");
        await sembrarAlerta(b.id, eB.identificador!.id, rB.id, new Date(ahora.getTime() - 1 * DIA_MS));

        const repo = new AlertaColegioRepository();
        const hace30d = new Date(ahora.getTime() - 30 * DIA_MS);
        const hace60d = new Date(ahora.getTime() - 60 * DIA_MS);

        expect(await repo.contarReportesDistintosPorCurso(a.id, cursoA.id, hace30d)).toBe(2);
        expect(await repo.contarReportesDistintosPorCurso(a.id, cursoA.id, hace60d, hace30d)).toBe(1);
        expect(await repo.contarReportesDistintosPorCurso(a.id, cursoA.id, hace60d)).toBe(3);
        expect(await repo.contarReportesDistintosPorCurso(a.id, cursoA2.id, hace30d)).toBe(1);
        expect(await repo.contarReportesDistintosPorCurso(b.id, cursoA.id, hace30d)).toBe(0);
    });
});

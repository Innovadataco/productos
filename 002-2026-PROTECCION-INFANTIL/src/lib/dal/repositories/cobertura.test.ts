/**
 * SPEC-169 (Fase G): tests de CoberturaRepository — porcentaje por tipo de sujeto,
 * denominador cero y solo identificadores activos.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
    crearProfesor,
    crearIdentificadorProfesor,
    crearAcudienteEstudiante,
    crearIdentificadorAcudiente,
    crearPlataforma,
} from "@/lib/reporte-test-utils";
import { CoberturaRepository } from "./cobertura";

describe("CoberturaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve 0 % para un colegio sin sujetos", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new CoberturaRepository();
        const cobertura = await repo.calcular(colegio.id);

        expect(cobertura.estudiantes).toMatchObject({ total: 0, conIdentificador: 0, porcentaje: 0 });
        expect(cobertura.profesores).toMatchObject({ total: 0, conIdentificador: 0, porcentaje: 0 });
        expect(cobertura.acudientes).toMatchObject({ total: 0, conIdentificador: 0, porcentaje: 0 });
        expect(cobertura.tieneCoberturaGlobal).toBe(false);
    });

    it("calcula cobertura de estudiantes con identificadores activos", async () => {
        const { colegio } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma();
        const curso = await crearCurso(colegio.id);
        const e1 = await crearEstudiante(curso.id, colegio.id);
        const e2 = await crearEstudiante(curso.id, colegio.id);
        await crearIdentificadorEstudiante(e1.id, { plataformaId: plataforma.id, estado: "activo" });
        await crearIdentificadorEstudiante(e2.id, { plataformaId: plataforma.id, estado: "inactivo" });

        const repo = new CoberturaRepository();
        const cobertura = await repo.calcular(colegio.id);

        expect(cobertura.estudiantes.total).toBe(2);
        expect(cobertura.estudiantes.conIdentificador).toBe(1);
        expect(cobertura.estudiantes.porcentaje).toBe(0.5);
        expect(cobertura.tieneCoberturaGlobal).toBe(true);
    });

    it("calcula cobertura de profesores y acudientes", async () => {
        const { colegio } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma();
        const profesor = await crearProfesor(colegio.id);
        await crearIdentificadorProfesor(profesor.id, colegio.id, { plataformaId: plataforma.id, estado: "activo" });

        const curso = await crearCurso(colegio.id);
        const estudiante = await crearEstudiante(curso.id, colegio.id);
        const acudiente = await crearAcudienteEstudiante(estudiante.id);
        await crearIdentificadorAcudiente(acudiente.id, colegio.id, { plataformaId: plataforma.id, estado: "activo" });

        const repo = new CoberturaRepository();
        const cobertura = await repo.calcular(colegio.id);

        expect(cobertura.profesores.total).toBe(1);
        expect(cobertura.profesores.conIdentificador).toBe(1);
        expect(cobertura.profesores.porcentaje).toBe(1);

        expect(cobertura.acudientes.total).toBe(1);
        expect(cobertura.acudientes.conIdentificador).toBe(1);
        expect(cobertura.acudientes.porcentaje).toBe(1);
    });

    it("no cruza datos de otro colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma();
        const cursoA = await crearCurso(a.id);
        const eA = await crearEstudiante(cursoA.id, a.id);
        await crearIdentificadorEstudiante(eA.id, { plataformaId: plataforma.id, estado: "activo" });

        const repo = new CoberturaRepository();
        const coberturaB = await repo.calcular(b.id);
        expect(coberturaB.estudiantes.total).toBe(0);
        expect(coberturaB.tieneCoberturaGlobal).toBe(false);
    });
});

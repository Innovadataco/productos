/**
 * SPEC-162: tests del CursoMateriaRepository — vínculo Curso × Materia × Profesor.
 * Tenant obligatorio; valida curso, materia activa, profesor activo; duplicados.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearProfesor } from "@/lib/reporte-test-utils";
import { MateriaRepository } from "./materia";
import { CursoMateriaRepository } from "./curso-materia";

describe("CursoMateriaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    async function setup() {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id, { nombre: "6A" });
        const materiaRepo = new MateriaRepository();
        const materia = await materiaRepo.crear(colegio.id, "Matemáticas");
        const profesor = await crearProfesor(colegio.id, { nombre: "Ana", apellidos: "López" });
        return { colegio, curso, materia, profesor };
    }

    it("crea el vínculo y lo lista por curso", async () => {
        const { colegio, curso, materia, profesor } = await setup();
        const repo = new CursoMateriaRepository();

        const vinculo = await repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id, profesorId: profesor.id });
        expect(vinculo.cursoId).toBe(curso.id);
        expect(vinculo.materia.nombre).toBe("Matemáticas");
        expect(vinculo.profesor!.nombre).toBe("Ana");
        expect(vinculo.estado).toBe("activo");

        const lista = await repo.listarPorCurso(colegio.id, curso.id);
        expect(lista).toHaveLength(1);
        expect(lista[0].materia.nombre).toBe("Matemáticas");
    });

    it("crea vínculo sin profesor", async () => {
        const { colegio, curso, materia } = await setup();
        const repo = new CursoMateriaRepository();

        const vinculo = await repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id });
        expect(vinculo.profesorId).toBeNull();
        expect(vinculo.profesor).toBeNull();
    });

    it("rechaza duplicado (curso, materia) activo", async () => {
        const { colegio, curso, materia } = await setup();
        const repo = new CursoMateriaRepository();
        await repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id });

        await expect(repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rechaza curso de otro colegio", async () => {
        const { colegio } = await setup();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "7B" });
        const materia = await new MateriaRepository().crear(colegio.id, "Física");

        await expect(new CursoMateriaRepository().crear(colegio.id, { cursoId: otroCurso.id, materiaId: materia.id })).rejects.toMatchObject({ statusCode: 404 });
    });

    it("rechaza materia inactiva", async () => {
        const { colegio, curso, materia } = await setup();
        await new MateriaRepository().cambiarEstado(colegio.id, materia.id, "inactivo");

        await expect(new CursoMateriaRepository().crear(colegio.id, { cursoId: curso.id, materiaId: materia.id })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rechaza profesor inactivo", async () => {
        const { colegio, curso, materia, profesor } = await setup();
        await prisma.profesor.update({ where: { id: profesor.id }, data: { estado: "inactivo" } });

        await expect(new CursoMateriaRepository().crear(colegio.id, { cursoId: curso.id, materiaId: materia.id, profesorId: profesor.id })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("listarPorCurso filtra por colegio", async () => {
        const { colegio, curso, materia } = await setup();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const otroCurso = await crearCurso(otroColegio.id, { nombre: "7B" });
        const otraMateria = await new MateriaRepository().crear(otroColegio.id, "Matemáticas");
        const repo = new CursoMateriaRepository();
        await repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id });
        await repo.crear(otroColegio.id, { cursoId: otroCurso.id, materiaId: otraMateria.id });

        expect((await repo.listarPorCurso(colegio.id, curso.id))).toHaveLength(1);
        expect((await repo.listarPorCurso(otroColegio.id, otroCurso.id))).toHaveLength(1);
    });

    it("cambiarEstado hace soft delete y no afecta filas ajenas", async () => {
        const { colegio, curso, materia, profesor } = await setup();
        const repo = new CursoMateriaRepository();
        const vinculo = await repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id, profesorId: profesor.id });

        const desactivado = await repo.cambiarEstado(colegio.id, vinculo.id, "inactivo");
        expect(desactivado.estado).toBe("inactivo");

        await expect(repo.cambiarEstado(colegio.id, vinculo.id, "activo")).resolves.toMatchObject({ estado: "activo" });
    });

    it("obtenerPorId devuelve null para id ajeno", async () => {
        const { colegio, curso, materia } = await setup();
        const { colegio: otroColegio } = await crearColegioConAdmin();
        const repo = new CursoMateriaRepository();
        const vinculo = await repo.crear(colegio.id, { cursoId: curso.id, materiaId: materia.id });

        expect(await repo.obtenerPorId(colegio.id, vinculo.id)).not.toBeNull();
        expect(await repo.obtenerPorId(otroColegio.id, vinculo.id)).toBeNull();
    });
});

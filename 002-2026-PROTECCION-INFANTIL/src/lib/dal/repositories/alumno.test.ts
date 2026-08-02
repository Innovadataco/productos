/**
 * SPEC-134 (E-1, O-4): tests del AlumnoRepository — tenant en lecturas Y escrituras.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso } from "@/lib/reporte-test-utils";
import { AlumnoRepository } from "./alumno";

async function sembrarDosColegiosConCursoYAlumno() {
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const cursoA = await crearCurso(a.id, { nombre: "Curso A" });
    const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
    const repo = new AlumnoRepository();
    const alumnoA = await repo.crear(a.id, { cursoId: cursoA.id, nombre: "Alumno A" });
    const alumnoB = await repo.crear(b.id, { cursoId: cursoB.id, nombre: "Alumno B" });
    return { a, b, cursoA, cursoB, alumnoA, alumnoB, repo };
}

describe("AlumnoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarPorCurso solo devuelve alumnos del curso cuando el tenant coincide", async () => {
        const { a, b, cursoA, cursoB, alumnoA, repo } = await sembrarDosColegiosConCursoYAlumno();

        const propios = await repo.listarPorCurso(a.id, cursoA.id);
        expect(propios.map((x) => x.id)).toEqual([alumnoA.id]);

        // Defensa en profundidad: el cursoId de B con el tenant de A no devuelve nada
        expect(await repo.listarPorCurso(a.id, cursoB.id), "curso ajeno + tenant propio = vacío").toEqual([]);
        expect((await repo.listarPorCurso(b.id, cursoB.id)).length, "B sí ve a su alumno").toBe(1);
    });

    it("crear bajo un curso de OTRO colegio lanza 404 y no persiste nada", async () => {
        const { a, cursoB, repo } = await sembrarDosColegiosConCursoYAlumno();

        await expect(repo.crear(a.id, { cursoId: cursoB.id, nombre: "Intruso" })).rejects.toMatchObject({ statusCode: 404 });
        const count = await prisma.alumno.count({ where: { colegioId: a.id, nombre: "Intruso" } });
        expect(count, "el alumno intruso no fue creado").toBe(0);
    });

    it("buscarPorNombreEnCurso y buscarDuplicadoEnCurso solo miran dentro del colegio", async () => {
        const { a, b, cursoA, cursoB, alumnoA, repo } = await sembrarDosColegiosConCursoYAlumno();
        await repo.crear(b.id, { cursoId: cursoB.id, nombre: "Alumno A" });

        expect((await repo.buscarPorNombreEnCurso(a.id, cursoA.id, "Alumno A"))!.id).toBe(alumnoA.id);
        const otroA = await repo.crear(a.id, { cursoId: cursoA.id, nombre: "Otro" });
        expect(await repo.buscarDuplicadoEnCurso(a.id, cursoA.id, "Alumno A", otroA.id)).not.toBeNull();
        expect(await repo.buscarDuplicadoEnCurso(a.id, cursoA.id, "Alumno A", alumnoA.id)).toBeNull();
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { a, alumnoB, repo } = await sembrarDosColegiosConCursoYAlumno();
        expect(await repo.obtenerPorId(a.id, alumnoB.id)).toBeNull();
    });

    it("O-4: actualizar por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { a, alumnoB, repo } = await sembrarDosColegiosConCursoYAlumno();

        await expect(repo.actualizar(a.id, alumnoB.id, { nombre: "Secuestrado" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.alumno.findUnique({ where: { id: alumnoB.id } });
        expect(intacto!.nombre, "la fila de B no fue tocada").toBe("Alumno B");
    });

    it("O-4: cambiarEstado por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { a, b, alumnoB, repo } = await sembrarDosColegiosConCursoYAlumno();

        await expect(repo.cambiarEstado(a.id, alumnoB.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.alumno.findUnique({ where: { id: alumnoB.id } });
        expect(intacto!.estado, "la fila de B no fue tocada").toBe("activo");

        const propio = await repo.cambiarEstado(b.id, alumnoB.id, "inactivo");
        expect(propio.estado).toBe("inactivo");
    });

    it("contarPorColegio y contarPorCursoIds cuentan solo el propio tenant", async () => {
        const { a, cursoA, cursoB, repo } = await sembrarDosColegiosConCursoYAlumno();

        expect(await repo.contarPorColegio(a.id)).toBe(1);
        const porCursoA = await repo.contarPorCursoIds(a.id, [cursoA.id, cursoB.id]);
        expect(porCursoA.get(cursoA.id)).toBe(1);
        expect(porCursoA.get(cursoB.id), "el curso de B no cuenta para A").toBeUndefined();
    });
});

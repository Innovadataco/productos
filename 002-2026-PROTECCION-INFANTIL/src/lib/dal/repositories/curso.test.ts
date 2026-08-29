/**
 * SPEC-134 (E-1, O-4): tests del CursoRepository — tenant en lecturas Y escrituras.
 * (a) actualizar/cambiarEstado por id de OTRO colegio = 404 y la fila ajena intacta;
 * (b) las lecturas filtran por tenant con dos colegios sembrados.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso } from "@/lib/reporte-test-utils";
import { CursoRepository } from "./curso";

describe("CursoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarActivos devuelve solo los cursos activos del propio colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        await crearCurso(a.id, { nombre: "Activo A" });
        await crearCurso(a.id, { nombre: "Inactivo A", estado: "inactivo" });
        await crearCurso(b.id, { nombre: "Activo B" });
        const repo = new CursoRepository();

        const cursosA = await repo.listarActivos(a.id);
        expect(cursosA.map((c) => c.nombre)).toEqual(["Activo A"]);

        const cursosB = await repo.listarActivos(b.id);
        expect(cursosB.map((c) => c.nombre)).toEqual(["Activo B"]);
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
        const repo = new CursoRepository();

        expect(await repo.obtenerPorId(b.id, cursoB.id)).not.toBeNull();
        expect(await repo.obtenerPorId(a.id, cursoB.id), "el id ajeno no es visible").toBeNull();
    });

    it("buscarPorDatos y buscarDuplicado solo miran dentro del colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const datos = { nombre: "Sexto A", grado: "6", anioLectivo: "2026" };
        const cursoA = await crearCurso(a.id, datos);
        await crearCurso(b.id, datos);
        const repo = new CursoRepository();

        expect((await repo.buscarPorDatos(a.id, datos))!.id).toBe(cursoA.id);
        // En A existe duplicado excluyendo otro id; en uno nuevo no hay duplicado
        const otroA = await crearCurso(a.id, { nombre: "Otro", grado: "7", anioLectivo: "2026" });
        expect(await repo.buscarDuplicado(a.id, datos, otroA.id), "hay duplicado real en A").not.toBeNull();
        expect(await repo.buscarDuplicado(a.id, datos, cursoA.id), "excluyéndose a sí mismo no hay duplicado").toBeNull();
    });

    it("crear persiste el curso del colegio con estado activo", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new CursoRepository();

        const creado = await repo.crear(a.id, { nombre: "Nuevo", grado: "5", anioLectivo: "2026" });
        expect(creado.estado).toBe("activo");
        expect(creado.colegioId).toBe(a.id);
        expect(await repo.contarPorColegio(a.id)).toBe(1);
    });

    it("actualizar por id del propio colegio persiste el cambio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const curso = await crearCurso(a.id, { nombre: "Antes" });
        const repo = new CursoRepository();

        const actualizado = await repo.actualizar(a.id, curso.id, { nombre: "Después" });
        expect(actualizado.nombre).toBe("Después");
    });

    it("O-4: actualizar por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
        const repo = new CursoRepository();

        await expect(repo.actualizar(a.id, cursoB.id, { nombre: "Secuestrado" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.curso.findUnique({ where: { id: cursoB.id } });
        expect(intacto!.nombre, "la fila de B no fue tocada").toBe("Curso B");
    });

    it("O-4: cambiarEstado por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
        const repo = new CursoRepository();

        await expect(repo.cambiarEstado(a.id, cursoB.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.curso.findUnique({ where: { id: cursoB.id } });
        expect(intacto!.estado, "la fila de B no fue tocada").toBe("activo");

        // Y en el propio colegio funciona
        const propio = await repo.cambiarEstado(b.id, cursoB.id, "inactivo");
        expect(propio.estado).toBe("inactivo");
    });

    it("listarParaEstadisticas devuelve los cursos del colegio con el mínimo de campos", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        await crearCurso(a.id, { nombre: "A1", grado: "1", anioLectivo: "2026" });
        await crearCurso(a.id, { nombre: "A2", grado: "2", anioLectivo: "2026", estado: "inactivo" });
        await crearCurso(b.id, { nombre: "B1" });
        const repo = new CursoRepository();

        const rows = await repo.listarParaEstadisticas(a.id);
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.nombre)).toEqual(["A1", "A2"]);
    });
});

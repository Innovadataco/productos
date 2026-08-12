/**
 * SPEC-162: tests del MateriaRepository — catálogo colegio-scoped.
 * Tenant en lecturas y escrituras; duplicados case-insensitive; soft delete.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { MateriaRepository } from "./materia";

describe("MateriaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarActivas y listarTodas filtran por colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new MateriaRepository();

        await repo.crear(a.id, "Matemáticas");
        await repo.crear(a.id, "Inglés");
        const inactivaA = await repo.crear(a.id, "Física");
        await repo.cambiarEstado(a.id, inactivaA.id, "inactivo");
        await repo.crear(b.id, "Matemáticas");

        expect((await repo.listarActivas(a.id)).map((m) => m.nombre)).toEqual(["Inglés", "Matemáticas"]);
        expect((await repo.listarTodas(a.id)).map((m) => m.nombre)).toEqual(["Física", "Inglés", "Matemáticas"]);
        expect((await repo.listarActivas(b.id))).toHaveLength(1);
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        const materiaB = await repo.crear(b.id, "Historia");

        expect(await repo.obtenerPorId(b.id, materiaB.id)).not.toBeNull();
        expect(await repo.obtenerPorId(a.id, materiaB.id), "el id ajeno no es visible").toBeNull();
    });

    it("crear persiste la materia del colegio con estado activo", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new MateriaRepository();

        const creada = await repo.crear(a.id, "  Biología  ");
        expect(creada.nombre).toBe("Biología");
        expect(creada.estado).toBe("activo");
        expect(creada.colegioId).toBe(a.id);
        expect(await prisma.materia.count({ where: { colegioId: a.id } })).toBe(1);
    });

    it("crear rechaza duplicado case-insensitive y normalizado", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        await repo.crear(a.id, "Química");

        await expect(repo.crear(a.id, "química")).rejects.toMatchObject({ statusCode: 409 });
        await expect(repo.crear(a.id, "  QUÍMICA  ")).rejects.toMatchObject({ statusCode: 409 });

        // Otro colegio sí puede usar el mismo nombre
        const { colegio: b } = await crearColegioConAdmin();
        const enB = await repo.crear(b.id, "Química");
        expect(enB.nombre).toBe("Química");
    });

    it("crear rechaza nombre vacío", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        await expect(repo.crear(a.id, "   ")).rejects.toMatchObject({ statusCode: 400 });
    });

    it("actualizar por id del propio colegio persiste el cambio", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        const materia = await repo.crear(a.id, "Antigua");

        const actualizada = await repo.actualizar(a.id, materia.id, "Nueva");
        expect(actualizada.nombre).toBe("Nueva");
    });

    it("actualizar rechaza duplicado con otro id", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        const original = await repo.crear(a.id, "Arte");
        await repo.crear(a.id, "Música");

        await expect(repo.actualizar(a.id, original.id, "música")).rejects.toMatchObject({ statusCode: 409 });
    });

    it("O-4: actualizar por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        const materiaB = await repo.crear(b.id, "Filosofía");

        await expect(repo.actualizar(a.id, materiaB.id, "Secuestrada")).rejects.toMatchObject({ statusCode: 404 });
        const intacta = await prisma.materia.findUnique({ where: { id: materiaB.id } });
        expect(intacta!.nombre, "la fila de B no fue tocada").toBe("Filosofía");
    });

    it("cambiarEstado funciona en el propio colegio y lanza 404 en el ajeno", async () => {
        const { colegio: a } = await crearColegioConAdmin();
        const { colegio: b } = await crearColegioConAdmin();
        const repo = new MateriaRepository();
        const materiaB = await repo.crear(b.id, "Ética");

        await expect(repo.cambiarEstado(a.id, materiaB.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const intacta = await prisma.materia.findUnique({ where: { id: materiaB.id } });
        expect(intacta!.estado).toBe("activo");

        const propia = await repo.cambiarEstado(b.id, materiaB.id, "inactivo");
        expect(propia.estado).toBe("inactivo");

        const reactivada = await repo.cambiarEstado(b.id, materiaB.id, "activo");
        expect(reactivada.estado).toBe("activo");
    });
});

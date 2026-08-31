/**
 * SPEC-148 (T001, FR-003/FR-004): tests del BusquedaColegioRepository.
 * A/B con dos colegios: lo de B NUNCA se asoma por la búsqueda de A.
 * Solo activos, mínimo 2 caracteres, top N por grupo + restantes, prefijo
 * primero; timing < 200 ms con 500 estudiantes (brief §9).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearEstudiante, crearProfesor } from "@/lib/reporte-test-utils";
import { BusquedaColegioRepository, BUSQUEDA_LIMITE_GRUPO } from "./busqueda-colegio";

async function sembrarColegioConDatos() {
    const { colegio: a } = await crearColegioConAdmin();
    const cursoA = await crearCurso(a.id, { nombre: "Séptimo A" });
    const profesorA = await crearProfesor(a.id, { nombre: "Ana", apellidos: "Torres" });
    const estudianteA = await crearEstudiante(cursoA.id, a.id, { nombre: "Ana", apellidos: "Ruiz" });
    return { a, cursoA, profesorA, estudianteA };
}

describe("BusquedaColegioRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("devuelve resultados agrupados con contexto (curso del estudiante, titular del curso)", async () => {
        const { a, cursoA, profesorA, estudianteA } = await sembrarColegioConDatos();
        await prisma.curso.update({ where: { id: cursoA.id }, data: { profesorTitularId: profesorA.id } });

        const repo = new BusquedaColegioRepository();
        const r = await repo.buscar(a.id, "ana");

        expect(r.estudiantes).toEqual([{ id: estudianteA.id, nombre: "Ana", apellidos: "Ruiz", curso: "Séptimo A" }]);
        expect(r.profesores).toEqual([{ id: profesorA.id, nombre: "Ana", apellidos: "Torres" }]);

        const rCurso = await repo.buscar(a.id, "séptimo");
        expect(rCurso.cursos).toEqual([{ id: cursoA.id, nombre: "Séptimo A", titular: "Ana Torres" }]);
    });

    it("A/B: la búsqueda del colegio A nunca devuelve nada del colegio B", async () => {
        const { a } = await sembrarColegioConDatos();
        const { colegio: b } = await crearColegioConAdmin();
        const cursoB = await crearCurso(b.id, { nombre: "Séptimo B" });
        await crearEstudiante(cursoB.id, b.id, { nombre: "Ana", apellidos: "Del Otro Colegio" });
        await crearProfesor(b.id, { nombre: "Ana", apellidos: "Ajena" });

        const repo = new BusquedaColegioRepository();
        const rA = await repo.buscar(a.id, "ana");
        expect(rA.estudiantes.every((e) => e.apellidos !== "Del Otro Colegio")).toBe(true);
        expect(rA.profesores.every((p) => p.apellidos !== "Ajena")).toBe(true);
        expect(rA.estudiantes).toHaveLength(1);
        expect(rA.profesores).toHaveLength(1);

        const rB = await repo.buscar(b.id, "ana");
        expect(rB.estudiantes).toHaveLength(1);
        expect(rB.estudiantes[0]?.apellidos).toBe("Del Otro Colegio");
    });

    it("solo activos: estudiante, curso y profesor inactivos quedan fuera", async () => {
        const { a, profesorA, estudianteA } = await sembrarColegioConDatos();
        await prisma.estudiante.update({ where: { id: estudianteA.id }, data: { estado: "inactivo" } });
        await prisma.profesor.update({ where: { id: profesorA.id }, data: { estado: "inactivo" } });
        await crearCurso(a.id, { nombre: "Anuario", estado: "inactivo" });

        const r = await new BusquedaColegioRepository().buscar(a.id, "ana");
        expect(r.estudiantes).toEqual([]);
        expect(r.profesores).toEqual([]);
        expect(r.cursos).toEqual([]);
    });

    it("menos de 2 caracteres devuelve vacío inmediato (sin barrer la BD)", async () => {
        const { a } = await sembrarColegioConDatos();
        const repo = new BusquedaColegioRepository();

        for (const q of ["", " ", "a"]) {
            const r = await repo.buscar(a.id, q);
            expect(r.estudiantes).toEqual([]);
            expect(r.cursos).toEqual([]);
            expect(r.profesores).toEqual([]);
            expect(r.restantes).toEqual({ estudiantes: 0, cursos: 0, profesores: 0 });
        }
    });

    it("top N por grupo con conteo de restantes y prefijo primero", async () => {
        const { a, cursoA } = await sembrarColegioConDatos();
        // 7 más que CONTIENEN "ana" en los apellidos + 1 que EMPIEZA por "Ana" ya sembrada.
        for (let i = 1; i <= 7; i++) {
            await crearEstudiante(cursoA.id, a.id, { nombre: `Zoe${i}`, apellidos: `Santana${i}` });
        }
        // La que empieza por "Ana" en apellidos debe salir antes que las "Santana".
        const prefijo = await crearEstudiante(cursoA.id, a.id, { nombre: "Luis", apellidos: "Anaya" });

        const r = await new BusquedaColegioRepository().buscar(a.id, "ana");
        expect(r.estudiantes.length).toBe(BUSQUEDA_LIMITE_GRUPO);
        // 9 activos coinciden (Ana Ruiz + Luis Anaya + 7 Santana) → 4 restantes.
        expect(r.restantes.estudiantes).toBe(9 - BUSQUEDA_LIMITE_GRUPO);
        const ids = r.estudiantes.map((e) => e.id);
        expect(ids).toContain(prefijo.id);
        // Prefijo primero: "Ana Ruiz" y "Luis Anaya" encabezan el grupo (entre
        // ellos manda el orden alfabético del repo: Anaya antes que Ruiz).
        expect(r.estudiantes[0]?.apellidos).toBe("Anaya");
        expect(r.estudiantes[1]?.nombre).toBe("Ana");
        expect(r.estudiantes.slice(2).every((e) => e.apellidos.startsWith("Santana"))).toBe(true);
    });

    it("timing: 'ana' con 500 estudiantes responde en < 200 ms (brief §9)", async () => {
        const { a, cursoA } = await sembrarColegioConDatos();
        await prisma.estudiante.createMany({
            data: Array.from({ length: 500 }, (_, i) => ({
                cursoId: cursoA.id,
                colegioId: a.id,
                nombre: i % 25 === 0 ? `Ana${i}` : `Nombre${i}`,
                apellidos: i % 25 === 0 ? `Semilla${i}` : `Apellido${i}`,
                documentoTipo: "TI",
                documentoNumero: `BUS-${i}`,
                estado: "activo",
            })),
        });

        const repo = new BusquedaColegioRepository();
        const inicio = performance.now();
        const r = await repo.buscar(a.id, "ana");
        const duracion = performance.now() - inicio;

        expect(duracion).toBeLessThan(200);
        expect(r.estudiantes.length).toBeGreaterThan(0);
        expect(r.restantes.estudiantes).toBeGreaterThan(0);
    });
});

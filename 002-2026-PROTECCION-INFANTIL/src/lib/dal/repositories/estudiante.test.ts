/**
 * SPEC-134 (E-1, O-4): tests del EstudianteRepository — tenant en lecturas Y escrituras.
 * SPEC-144: el alta exige nombre + apellidos; el duplicado es por nombre + apellidos;
 * los acudientes (D1) se crean en la misma escritura atómica, nunca por id suelto.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso } from "@/lib/reporte-test-utils";
import { EstudianteRepository } from "./estudiante";

async function sembrarDosColegiosConCursoYEstudiante() {
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const cursoA = await crearCurso(a.id, { nombre: "Curso A" });
    const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
    const repo = new EstudianteRepository();
    const estudianteA = await repo.crear(a.id, { cursoId: cursoA.id, nombre: "Alumno A", apellidos: "Pérez", documentoTipo: "TI", documentoNumero: "EST-A" });
    const estudianteB = await repo.crear(b.id, { cursoId: cursoB.id, nombre: "Alumno B", apellidos: "Gómez", documentoTipo: "TI", documentoNumero: "EST-B" });
    return { a, b, cursoA, cursoB, estudianteA, estudianteB, repo };
}

describe("EstudianteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarPorCurso solo devuelve estudiantes del curso cuando el tenant coincide", async () => {
        const { a, b, cursoA, cursoB, estudianteA, repo } = await sembrarDosColegiosConCursoYEstudiante();

        const propios = await repo.listarPorCurso(a.id, cursoA.id);
        expect(propios.map((x) => x.id)).toEqual([estudianteA.id]);

        // Defensa en profundidad: el cursoId de B con el tenant de A no devuelve nada
        expect(await repo.listarPorCurso(a.id, cursoB.id), "curso ajeno + tenant propio = vacío").toEqual([]);
        expect((await repo.listarPorCurso(b.id, cursoB.id)).length, "B sí ve a su estudiante").toBe(1);
    });

    it("crear bajo un curso de OTRO colegio lanza 404 y no persiste nada", async () => {
        const { a, cursoB, repo } = await sembrarDosColegiosConCursoYEstudiante();

        await expect(repo.crear(a.id, { cursoId: cursoB.id, nombre: "Intruso", apellidos: "X", documentoTipo: "TI", documentoNumero: "EST-INTRUSO" })).rejects.toMatchObject({ statusCode: 404 });
        const count = await prisma.estudiante.count({ where: { colegioId: a.id, nombre: "Intruso" } });
        expect(count, "el estudiante intruso no fue creado").toBe(0);
    });

    it("crear persiste apellidos, documento y acudientes en UNA escritura (SPEC-144, D1)", async () => {
        const { a, cursoA, repo } = await sembrarDosColegiosConCursoYEstudiante();

        const creado = await repo.crear(a.id, {
            cursoId: cursoA.id,
            nombre: "Ana",
            apellidos: "Pérez Torres",
            documentoTipo: "TI",
            documentoNumero: "1020304050",
            acudientes: [
                { orden: 1, nombre: "Marta Torres", relacion: "madre", telefono: "+573001112233", email: "marta@example.com" },
                { orden: 2, nombre: "Juan Pérez", relacion: "padre" },
            ],
        });

        expect(creado.apellidos).toBe("Pérez Torres");
        expect(creado.documentoTipo).toBe("TI");
        expect(creado.acudientes).toHaveLength(2);
        // El acudiente se alcanza SOLO a través del estudiante (D1), nunca por id suelto.
        const acudientes = await prisma.acudienteEstudiante.findMany({
            where: { estudiante: { id: creado.id, colegioId: a.id } },
            orderBy: { orden: "asc" },
        });
        expect(acudientes.map((x) => [x.orden, x.nombre, x.relacion])).toEqual([
            [1, "Marta Torres", "madre"],
            [2, "Juan Pérez", "padre"],
        ]);
        // @@unique([estudianteId, orden]): un tercer acudiente con orden repetido revienta.
        await expect(
            prisma.acudienteEstudiante.create({
                data: { estudianteId: creado.id, orden: 1, nombre: "Otro", relacion: "tía" },
            })
        ).rejects.toThrow();
    });

    it("buscarPorNombreEnCurso y buscarDuplicadoEnCurso solo miran dentro del colegio (nombre + apellidos)", async () => {
        const { a, b, cursoA, cursoB, estudianteA, repo } = await sembrarDosColegiosConCursoYEstudiante();
        await repo.crear(b.id, { cursoId: cursoB.id, nombre: "Alumno A", apellidos: "Pérez", documentoTipo: "TI", documentoNumero: "EST-A-B" });

        expect((await repo.buscarPorNombreEnCurso(a.id, cursoA.id, "Alumno A", "Pérez"))!.id).toBe(estudianteA.id);
        // Mismo nombre con apellidos distintos NO es duplicado (SPEC-144).
        expect(await repo.buscarPorNombreEnCurso(a.id, cursoA.id, "Alumno A", "Otro")).toBeNull();
        const otroA = await repo.crear(a.id, { cursoId: cursoA.id, nombre: "Otro", apellidos: "Z", documentoTipo: "TI", documentoNumero: "EST-OTRO" });
        expect(await repo.buscarDuplicadoEnCurso(a.id, cursoA.id, "Alumno A", "Pérez", otroA.id)).not.toBeNull();
        expect(await repo.buscarDuplicadoEnCurso(a.id, cursoA.id, "Alumno A", "Pérez", estudianteA.id)).toBeNull();
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { a, estudianteB, repo } = await sembrarDosColegiosConCursoYEstudiante();
        expect(await repo.obtenerPorId(a.id, estudianteB.id)).toBeNull();
    });

    it("O-4: actualizar por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { a, estudianteB, repo } = await sembrarDosColegiosConCursoYEstudiante();

        await expect(repo.actualizar(a.id, estudianteB.id, { nombre: "Secuestrado" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.estudiante.findUnique({ where: { id: estudianteB.id } });
        expect(intacto!.nombre, "la fila de B no fue tocada").toBe("Alumno B");
    });

    it("O-4: cambiarEstado por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { a, b, estudianteB, repo } = await sembrarDosColegiosConCursoYEstudiante();

        await expect(repo.cambiarEstado(a.id, estudianteB.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.estudiante.findUnique({ where: { id: estudianteB.id } });
        expect(intacto!.estado, "la fila de B no fue tocada").toBe("activo");

        const propio = await repo.cambiarEstado(b.id, estudianteB.id, "inactivo");
        expect(propio.estado).toBe("inactivo");
    });

    it("contarPorColegio y contarPorCursoIds cuentan solo el propio tenant", async () => {
        const { a, cursoA, cursoB, repo } = await sembrarDosColegiosConCursoYEstudiante();

        expect(await repo.contarPorColegio(a.id)).toBe(1);
        const porCursoA = await repo.contarPorCursoIds(a.id, [cursoA.id, cursoB.id]);
        expect(porCursoA.get(cursoA.id)).toBe(1);
        expect(porCursoA.get(cursoB.id), "el curso de B no cuenta para A").toBeUndefined();
    });
});

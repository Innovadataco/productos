/**
 * SPEC-134 (E-1, O-4): tests del IdentificadorEstudianteRepository — el tenant viaja
 * por la relación alumno.colegioId en lecturas y escrituras. Incluye la excepción
 * cross-tenant documentada (buscarActivosPorValor alimenta las alertas de TODOS).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearPlataforma } from "@/lib/reporte-test-utils";
import { IdentificadorEstudianteRepository } from "./identificador-estudiante";

async function sembrar() {
    const plataforma = await crearPlataforma();
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const cursoA = await crearCurso(a.id, { nombre: "Curso A" });
    const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
    const estudianteA = await prisma.estudiante.create({ data: { cursoId: cursoA.id, colegioId: a.id, nombre: "Alumno A" } });
    const estudianteB = await prisma.estudiante.create({ data: { cursoId: cursoB.id, colegioId: b.id, nombre: "Alumno B" } });
    const repo = new IdentificadorEstudianteRepository();
    const datosA = { estudianteId: estudianteA.id, tipo: "telefono", valor: "+573001110001", plataformaId: plataforma.id, etiquetaRelacion: "ESTUDIANTE" as const };
    const idA = await repo.crear(a.id, datosA);
    const idB = await repo.crear(b.id, { ...datosA, estudianteId: estudianteB.id, valor: "+573002220002" });
    return { a, b, cursoA, cursoB, estudianteA, estudianteB, idA, idB, repo, plataforma };
}

describe("IdentificadorEstudianteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarPorEstudiante solo devuelve identificadores cuando el tenant coincide", async () => {
        const { a, b, estudianteA, estudianteB, idA, idB, repo } = await sembrar();

        const propios = await repo.listarPorEstudiante(a.id, estudianteA.id);
        expect(propios.map((x) => x.id)).toEqual([idA.id]);
        expect(propios[0].plataforma, "incluye la plataforma").not.toBeNull();

        expect(await repo.listarPorEstudiante(a.id, estudianteB.id), "alumno ajeno + tenant propio = vacío").toEqual([]);
        expect((await repo.listarPorEstudiante(b.id, estudianteB.id)).map((x) => x.id)).toEqual([idB.id]);
    });

    it("crear bajo un alumno de OTRO colegio lanza 404 y no persiste nada", async () => {
        const { a, estudianteB, repo } = await sembrar();

        await expect(
            repo.crear(a.id, { estudianteId: estudianteB.id, tipo: "email", valor: "intruso@test.local", plataformaId: null, etiquetaRelacion: "PADRE" })
        ).rejects.toMatchObject({ statusCode: 404 });
        const count = await prisma.identificadorEstudiante.count({ where: { valor: "intruso@test.local" } });
        expect(count, "el identificador intruso no fue creado").toBe(0);
    });

    it("buscarDuplicado solo mira dentro del tenant (mismo valor en B no choca con A)", async () => {
        const { a, estudianteA, idA, repo, plataforma } = await sembrar();

        expect(
            await repo.buscarDuplicado(a.id, { estudianteId: estudianteA.id, tipo: "telefono", valor: "+573001110001", plataformaId: plataforma.id })
        ).not.toBeNull();
        expect(
            await repo.buscarDuplicado(a.id, { estudianteId: estudianteA.id, tipo: "telefono", valor: "+573001110001", plataformaId: plataforma.id }, idA.id),
            "excluyéndose a sí mismo no hay duplicado"
        ).toBeNull();
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { a, idB, repo } = await sembrar();
        expect(await repo.obtenerPorId(a.id, idB.id)).toBeNull();
    });

    it("O-4: actualizar por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { a, idB, repo } = await sembrar();

        await expect(repo.actualizar(a.id, idB.id, { valor: "+573009990000" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.identificadorEstudiante.findUnique({ where: { id: idB.id } });
        expect(intacto!.valor, "la fila de B no fue tocada").toBe("+573002220002");
    });

    it("O-4: cambiarEstado por id de OTRO colegio lanza 404 y la fila ajena queda intacta", async () => {
        const { a, b, idB, repo } = await sembrar();

        await expect(repo.cambiarEstado(a.id, idB.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.identificadorEstudiante.findUnique({ where: { id: idB.id } });
        expect(intacto!.estado, "la fila de B no fue tocada").toBe("activo");

        const propio = await repo.cambiarEstado(b.id, idB.id, "inactivo");
        expect(propio.estado).toBe("inactivo");
    });

    it("reactivar re-etiqueta dentro del tenant y rechaza el ajeno", async () => {
        const { a, b, idB, repo } = await sembrar();

        await expect(repo.reactivar(a.id, idB.id, "MADRE")).rejects.toMatchObject({ statusCode: 404 });
        await repo.reactivar(b.id, idB.id, "MADRE");
        const actualizado = await prisma.identificadorEstudiante.findUnique({ where: { id: idB.id } });
        expect(actualizado!.etiquetaRelacion).toBe("MADRE");
        expect(actualizado!.estado).toBe("activo");
    });

    it("EXCEPCIÓN documentada: buscarActivosPorValor recorre TODOS los colegios", async () => {
        const { a, b, estudianteA, repo } = await sembrar();
        // Mismo valor en dos colegios (la alerta debe llegar a ambos)
        await repo.crear(a.id, { estudianteId: estudianteA.id, tipo: "telefono", valor: "+57300COMUN1", plataformaId: null, etiquetaRelacion: "ESTUDIANTE" });
        const { colegio: c } = await crearColegioConAdmin();
        const cursoC = await crearCurso(c.id, { nombre: "Curso C" });
        const estudianteC = await prisma.estudiante.create({ data: { cursoId: cursoC.id, colegioId: c.id, nombre: "Alumno C" } });
        await repo.crear(c.id, { estudianteId: estudianteC.id, tipo: "telefono", valor: "+57300comun1", plataformaId: null, etiquetaRelacion: "PADRE" });

        const encontrados = await repo.buscarActivosPorValor("+57300COMUN1");
        const colegios = encontrados.map((x) => x.estudiante.colegioId).sort();
        expect(encontrados.length, "case-insensitive y cross-tenant a propósito").toBe(2);
        expect(colegios).toEqual([a.id, c.id].sort());
        expect(b.id, "B no tiene ese valor").toBeTruthy();
    });

    it("contarPorColegio y contarPorCursoIds cuentan solo el propio tenant", async () => {
        const { a, cursoA, cursoB, repo } = await sembrar();

        expect(await repo.contarPorColegio(a.id)).toBe(1);
        const porCurso = await repo.contarPorCursoIds(a.id, [cursoA.id, cursoB.id]);
        expect(porCurso.get(cursoA.id)).toBe(1);
        expect(porCurso.get(cursoB.id), "el curso de B no cuenta para A").toBeUndefined();
    });
});

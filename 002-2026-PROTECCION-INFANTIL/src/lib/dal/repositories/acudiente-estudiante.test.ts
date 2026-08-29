/**
 * SPEC-163 (E-1, O-4): tests del AcudienteEstudianteRepository — tenant vía la
 * relación estudiante.colegioId; máximo 2 activos; inactivación en cascada de
 * identificadores; conteos por colegio/curso/estudiante.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearEstudiante, crearAcudienteEstudiante, crearIdentificadorAcudiente } from "@/lib/reporte-test-utils";
import { AcudienteEstudianteRepository } from "./acudiente-estudiante";

async function sembrar() {
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const cursoA = await crearCurso(a.id, { nombre: "Curso A" });
    const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
    const estudianteA = await crearEstudiante(cursoA.id, a.id, { nombre: "Alumno A" });
    const estudianteB = await crearEstudiante(cursoB.id, b.id, { nombre: "Alumno B" });
    const repo = new AcudienteEstudianteRepository();
    return { a, b, cursoA, cursoB, estudianteA, estudianteB, repo };
}

describe("AcudienteEstudianteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarActivosPorEstudiante devuelve acudientes activos ordenados con identificadores activos", async () => {
        const { a, estudianteA, repo } = await sembrar();
        const acudiente = await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "Marta", relacion: "madre" });
        await crearIdentificadorAcudiente(acudiente.id, a.id, { valor: "madre@example.com" });
        await crearIdentificadorAcudiente(acudiente.id, a.id, { valor: "inactivo@example.com", estado: "inactivo" });

        const propios = await repo.listarActivosPorEstudiante(a.id, estudianteA.id);
        expect(propios).toHaveLength(1);
        expect(propios[0].nombre).toBe("Marta");
        expect(propios[0].identificadores).toHaveLength(1);
        expect(propios[0].identificadores[0].valor).toBe("madre@example.com");
    });

    it("listarActivosPorEstudiante devuelve vacío para estudiante ajeno", async () => {
        const { a, estudianteB, repo } = await sembrar();
        expect(await repo.listarActivosPorEstudiante(a.id, estudianteB.id)).toEqual([]);
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { a, b, estudianteB, repo } = await sembrar();
        const ajeno = await crearAcudienteEstudiante(estudianteB.id);
        expect(await repo.obtenerPorId(a.id, ajeno.id)).toBeNull();
        expect(await repo.obtenerPorId(b.id, ajeno.id)).not.toBeNull();
    });

    it("crear persiste el acudiente activo", async () => {
        const { a, estudianteA, repo } = await sembrar();
        const creado = await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "Juan", relacion: "padre", telefono: "+573001112233" });
        expect(creado.nombre).toBe("Juan");
        expect(creado.estado).toBe("activo");
        expect(creado.identificadores).toHaveLength(0);
    });

    it("crear rechaza un tercer acudiente activo", async () => {
        const { a, estudianteA, repo } = await sembrar();
        await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A1", relacion: "madre" });
        await repo.crear(a.id, estudianteA.id, { orden: 2, nombre: "A2", relacion: "padre" });
        await expect(repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A3", relacion: "tío" })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("crear rechaza orden ocupado activo", async () => {
        const { a, estudianteA, repo } = await sembrar();
        await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A1", relacion: "madre" });
        await expect(repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A2", relacion: "padre" })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("crear bajo un estudiante de OTRO colegio lanza 404", async () => {
        const { a, estudianteB, repo } = await sembrar();
        await expect(repo.crear(a.id, estudianteB.id, { orden: 1, nombre: "Intruso", relacion: "tío" })).rejects.toMatchObject({ statusCode: 404 });
    });

    it("actualizar persiste el cambio en el propio colegio y lanza 404 en el ajeno", async () => {
        const { a, b, estudianteA, estudianteB, repo } = await sembrar();
        const propio = await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A", relacion: "madre" });
        const ajeno = await crearAcudienteEstudiante(estudianteB.id);

        const actualizado = await repo.actualizar(a.id, propio.id, { nombre: "A actualizada" });
        expect(actualizado.nombre).toBe("A actualizada");

        await expect(repo.actualizar(a.id, ajeno.id, { nombre: "Hackeado" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.acudienteEstudiante.findUnique({ where: { id: ajeno.id } });
        expect(intacto!.nombre).not.toBe("Hackeado");
    });

    it("cambiarEstado a inactivo apaga en cascada los identificadores activos", async () => {
        const { a, estudianteA, repo } = await sembrar();
        const acudiente = await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "Marta", relacion: "madre" });
        const identificador = await crearIdentificadorAcudiente(acudiente.id, a.id, { valor: "3001112233" });

        const inactivo = await repo.cambiarEstado(a.id, acudiente.id, "inactivo");
        expect(inactivo.estado).toBe("inactivo");
        expect(inactivo.identificadores).toHaveLength(0);

        const apagado = await prisma.identificadorAcudiente.findUnique({ where: { id: identificador.id } });
        expect(apagado!.estado).toBe("inactivo");
    });

    it("cambiarEstado a activo respeta el máximo de 2 y el orden libre", async () => {
        const { a, estudianteA, repo } = await sembrar();
        const primero = await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A1", relacion: "madre" });
        const segundo = await repo.crear(a.id, estudianteA.id, { orden: 2, nombre: "A2", relacion: "padre" });
        await repo.cambiarEstado(a.id, segundo.id, "inactivo");

        // Reactivar el orden 2 es válido.
        const reactivado = await repo.cambiarEstado(a.id, segundo.id, "activo");
        expect(reactivado.estado).toBe("activo");

        // Reactivar de nuevo es válido porque hay un slot libre.
        await repo.cambiarEstado(a.id, segundo.id, "inactivo");
        const reactivadoDeNuevo = await repo.cambiarEstado(a.id, segundo.id, "activo");
        expect(reactivadoDeNuevo.estado).toBe("activo");

        // Inactivar el orden 1 y reactivar el 2 (ya activo) es un conflicto,
        // aunque el orden 1 haya quedado libre.
        await repo.cambiarEstado(a.id, primero.id, "inactivo");
        await expect(repo.cambiarEstado(a.id, segundo.id, "activo")).rejects.toMatchObject({ statusCode: 409 });
    });

    it("cambiarEstado en acudiente ajeno lanza 404", async () => {
        const { a, estudianteB, repo } = await sembrar();
        const ajeno = await crearAcudienteEstudiante(estudianteB.id);
        await expect(repo.cambiarEstado(a.id, ajeno.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("contarActivosPorColegio y contarActivosPorCursoIds respetan el tenant y solo activos", async () => {
        const { a, b, cursoA, cursoB, estudianteA, estudianteB, repo } = await sembrar();
        await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A1", relacion: "madre" });
        await crearAcudienteEstudiante(estudianteB.id, { orden: 1, nombre: "B1", relacion: "padre" });
        const inactivoA = await repo.crear(a.id, estudianteA.id, { orden: 2, nombre: "A2", relacion: "padre" });
        await repo.cambiarEstado(a.id, inactivoA.id, "inactivo");

        expect(await repo.contarActivosPorColegio(a.id)).toBe(1);
        const porCurso = await repo.contarActivosPorCursoIds(a.id, [cursoA.id, cursoB.id]);
        expect(porCurso.get(cursoA.id)).toBe(1);
        expect(porCurso.get(cursoB.id)).toBeUndefined();

        expect(await repo.contarActivosPorColegio(b.id)).toBe(1);
    });

    it("contarActivosPorEstudiante solo cuenta activos del propio colegio", async () => {
        const { a, estudianteA, repo } = await sembrar();
        await repo.crear(a.id, estudianteA.id, { orden: 1, nombre: "A1", relacion: "madre" });
        const a2 = await repo.crear(a.id, estudianteA.id, { orden: 2, nombre: "A2", relacion: "padre" });
        await repo.cambiarEstado(a.id, a2.id, "inactivo");

        expect(await repo.contarActivosPorEstudiante(a.id, estudianteA.id)).toBe(1);
    });
});

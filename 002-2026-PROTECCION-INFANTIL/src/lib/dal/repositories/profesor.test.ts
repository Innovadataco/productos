/**
 * SPEC-145 (E-1): tests del ProfesorRepository — tenant en lecturas Y escrituras.
 * A/B con dos colegios: lo de B nunca se asoma por las firmas de A.
 * Baja = soft delete: la fila EXISTE tras cambiarEstado a "inactivo".
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { ProfesorRepository } from "./profesor";

async function sembrarDosColegiosConProfesor() {
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const repo = new ProfesorRepository();
    // SPEC-320 (§2.2): identidad del profesor obligatoria.
    const identidad = { tipoDocumento: "CC", anioNacimiento: 1985, sexo: "OTRO", telefono: "+573001112233" };
    const profesorA = await repo.crear(a.id, { nombre: "María", apellidos: "López", email: "maria@a.edu.co", numeroDocumento: "A-1001", ...identidad });
    const profesorB = await repo.crear(b.id, { nombre: "Carlos", apellidos: "Gómez", email: "carlos@b.edu.co", numeroDocumento: "B-1001", ...identidad });
    return { a, b, profesorA, profesorB, repo };
}

describe("ProfesorRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crear persiste activo con el tenant del colegio", async () => {
        const { a, profesorA } = await sembrarDosColegiosConProfesor();

        expect(profesorA.colegioId).toBe(a.id);
        expect(profesorA.estado).toBe("activo");
        expect(profesorA.email).toBe("maria@a.edu.co");
        // SPEC-320 (§2.2): telefono ya no es nullable — se persiste el valor obligatorio.
        expect(profesorA.telefono).toBe("+573001112233");
        expect(profesorA.tipoDocumento).toBe("CC");
        expect(profesorA.numeroDocumento).toBe("A-1001");
    });

    it("listarPaginados solo devuelve profesores del propio colegio (A/B)", async () => {
        const { a, b, profesorA, profesorB, repo } = await sembrarDosColegiosConProfesor();

        const [itemsA, totalA] = await repo.listarPaginados(a.id, { estado: "activo", skip: 0, take: 25 });
        expect(itemsA.map((x) => x.id)).toEqual([profesorA.id]);
        expect(totalA).toBe(1);

        const [itemsB, totalB] = await repo.listarPaginados(b.id, { estado: "activo", skip: 0, take: 25 });
        expect(itemsB.map((x) => x.id)).toEqual([profesorB.id]);
        expect(totalB).toBe(1);
    });

    it("listarPaginados por default oculta inactivos y 'todos' los incluye", async () => {
        const { a, profesorA, repo } = await sembrarDosColegiosConProfesor();
        await repo.cambiarEstado(a.id, profesorA.id, "inactivo");

        const [activos, totalActivos] = await repo.listarPaginados(a.id, { estado: "activo", skip: 0, take: 25 });
        expect(activos).toEqual([]);
        expect(totalActivos).toBe(0);

        const [todos, totalTodos] = await repo.listarPaginados(a.id, { estado: "todos", skip: 0, take: 25 });
        expect(todos.map((x) => x.id)).toEqual([profesorA.id]);
        expect(totalTodos).toBe(1);
    });

    it("obtenerPorId devuelve null si el profesor es de OTRO colegio (A/B)", async () => {
        const { a, b, profesorA, profesorB, repo } = await sembrarDosColegiosConProfesor();

        expect((await repo.obtenerPorId(a.id, profesorA.id))?.id).toBe(profesorA.id);
        expect(await repo.obtenerPorId(a.id, profesorB.id), "profesor de B visto desde A = null").toBeNull();
        expect(await repo.obtenerPorId(b.id, profesorA.id), "profesor de A visto desde B = null").toBeNull();
    });

    it("buscarPorNombreApellidosEnColegio solo detecta duplicados activos del propio colegio", async () => {
        const { a, b, repo } = await sembrarDosColegiosConProfesor();

        expect(await repo.buscarPorNombreApellidosEnColegio(a.id, "María", "López")).not.toBeNull();
        // Mismo nombre + apellidos en OTRO colegio NO es duplicado de A.
        expect(await repo.buscarPorNombreApellidosEnColegio(a.id, "Carlos", "Gómez")).toBeNull();
        expect(await repo.buscarPorNombreApellidosEnColegio(b.id, "Carlos", "Gómez")).not.toBeNull();

        // Un inactivo con el mismo nombre no cuenta como duplicado.
        const inactivo = await repo.crear(a.id, { nombre: "Ana", apellidos: "Pérez", tipoDocumento: "CC", numeroDocumento: "A-2002", anioNacimiento: 1990, sexo: "F", email: "ana@a.edu.co", telefono: "+573004445566" });
        await repo.cambiarEstado(a.id, inactivo.id, "inactivo");
        expect(await repo.buscarPorNombreApellidosEnColegio(a.id, "Ana", "Pérez")).toBeNull();
    });

    it("actualizar bajo tenant ajeno lanza 404 y no toca la fila (A/B)", async () => {
        const { a, b, profesorA, repo } = await sembrarDosColegiosConProfesor();

        await expect(repo.actualizar(b.id, profesorA.id, { nombre: "Hackeada" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.profesor.findUniqueOrThrow({ where: { id: profesorA.id } });
        expect(intacto.nombre).toBe("María");

        const actualizado = await repo.actualizar(a.id, profesorA.id, { telefono: "+573001112233" });
        expect(actualizado.telefono).toBe("+573001112233");
        expect(actualizado.nombre).toBe("María");
    });

    it("cambiarEstado es baja suave: la fila EXISTE tras 'inactivo' (nunca borrado físico)", async () => {
        const { a, b, profesorA, repo } = await sembrarDosColegiosConProfesor();

        await expect(repo.cambiarEstado(b.id, profesorA.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });

        const dadoDeBaja = await repo.cambiarEstado(a.id, profesorA.id, "inactivo");
        expect(dadoDeBaja.estado).toBe("inactivo");
        const fila = await prisma.profesor.findUnique({ where: { id: profesorA.id } });
        expect(fila, "la fila sigue en BD tras la baja").not.toBeNull();
        expect(fila?.estado).toBe("inactivo");
    });
});

/**
 * SPEC-164 (E-1, O-4): tests del IdentificadorProfesorRepository — tenant por
 * colegioId denormalizado; duplicados; profesor inactivo; búsqueda cross-tenant
 * para Fase C.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearProfesor, crearPlataforma, crearIdentificadorProfesor } from "@/lib/reporte-test-utils";
import { IdentificadorProfesorRepository } from "./identificador-profesor";

async function sembrar() {
    const plataforma = await crearPlataforma();
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const profesorA = await crearProfesor(a.id, { nombre: "Profesor A" });
    const profesorB = await crearProfesor(b.id, { nombre: "Profesor B" });
    const repo = new IdentificadorProfesorRepository();
    return { a, b, profesorA, profesorB, repo, plataforma };
}

describe("IdentificadorProfesorRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarPorProfesor solo devuelve activos del profesor cuando el tenant coincide", async () => {
        const { a, profesorA, repo } = await sembrar();
        await crearIdentificadorProfesor(profesorA.id, a.id, { valor: "a1@example.com" });
        await crearIdentificadorProfesor(profesorA.id, a.id, { valor: "a2@example.com", estado: "inactivo" });

        const propios = await repo.listarPorProfesor(a.id, profesorA.id);
        expect(propios).toHaveLength(1);
        expect(propios[0].valor).toBe("a1@example.com");
    });

    it("crear bajo un profesor de OTRO colegio lanza 404", async () => {
        const { a, profesorB, repo } = await sembrar();
        await expect(
            repo.crear(a.id, { profesorId: profesorB.id, tipo: "email", valor: "intruso@test.local", plataformaId: null })
        ).rejects.toMatchObject({ statusCode: 404 });
        const count = await prisma.identificadorProfesor.count({ where: { valor: "intruso@test.local" } });
        expect(count).toBe(0);
    });

    it("crear rechaza identificador sobre profesor inactivo", async () => {
        const { a, profesorA, repo } = await sembrar();
        await prisma.profesor.updateMany({ where: { id: profesorA.id }, data: { estado: "inactivo" } });
        await expect(
            repo.crear(a.id, { profesorId: profesorA.id, tipo: "email", valor: "a@example.com", plataformaId: null })
        ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("buscarDuplicado detecta duplicado y excluirId se excluye a sí mismo", async () => {
        const { a, profesorA, repo, plataforma } = await sembrar();
        const creado = await repo.crear(a.id, { profesorId: profesorA.id, tipo: "email", valor: "a@example.com", plataformaId: plataforma.id });

        const duplicado = await repo.buscarDuplicado(a.id, {
            profesorId: profesorA.id,
            tipo: "email",
            valor: "a@example.com",
            plataformaId: plataforma.id,
        });
        expect(duplicado).not.toBeNull();

        const sinDuplicado = await repo.buscarDuplicado(
            a.id,
            { profesorId: profesorA.id, tipo: "email", valor: "a@example.com", plataformaId: plataforma.id },
            creado.id
        );
        expect(sinDuplicado).toBeNull();
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { a, b, profesorB, repo } = await sembrar();
        const ajeno = await crearIdentificadorProfesor(profesorB.id, b.id, { valor: "b@example.com" });
        expect(await repo.obtenerPorId(a.id, ajeno.id)).toBeNull();
        expect(await repo.obtenerPorId(b.id, ajeno.id)).not.toBeNull();
    });

    it("actualizar por id del propio colegio persiste y rechaza el ajeno", async () => {
        const { a, b, profesorA, profesorB, repo } = await sembrar();
        const propio = await repo.crear(a.id, { profesorId: profesorA.id, tipo: "email", valor: "a@example.com", plataformaId: null });
        const ajeno = await crearIdentificadorProfesor(profesorB.id, b.id, { valor: "b@example.com" });

        const actualizado = await repo.actualizar(a.id, propio.id, { valor: "a2@example.com" });
        expect(actualizado.valor).toBe("a2@example.com");

        await expect(repo.actualizar(a.id, ajeno.id, { valor: "hackeado" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.identificadorProfesor.findUnique({ where: { id: ajeno.id } });
        expect(intacto!.valor).toBe("b@example.com");
    });

    it("cambiarEstado funciona en el propio colegio y lanza 404 en el ajeno", async () => {
        const { a, b, profesorA, profesorB, repo } = await sembrar();
        const ajeno = await crearIdentificadorProfesor(profesorB.id, b.id, { valor: "b@example.com" });
        const propio = await repo.crear(a.id, { profesorId: profesorA.id, tipo: "email", valor: "a@example.com", plataformaId: null });

        await expect(repo.cambiarEstado(a.id, ajeno.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const inactivo = await repo.cambiarEstado(a.id, propio.id, "inactivo");
        expect(inactivo.estado).toBe("inactivo");

        const reactivado = await repo.cambiarEstado(a.id, propio.id, "activo");
        expect(reactivado.estado).toBe("activo");
    });

    it("EXCEPCIÓN documentada: buscarActivosPorValor recorre TODOS los colegios", async () => {
        const { a, b, profesorA, profesorB, repo } = await sembrar();
        await repo.crear(a.id, { profesorId: profesorA.id, tipo: "telefono", valor: "+57300COMUN1", plataformaId: null });
        await repo.crear(b.id, { profesorId: profesorB.id, tipo: "telefono", valor: "+57300comun1", plataformaId: null });

        const encontrados = await repo.buscarActivosPorValor("+57300COMUN1");
        const colegios = encontrados.map((x) => x.profesor.colegioId).sort();
        expect(encontrados.length).toBe(2);
        expect(colegios).toEqual([a.id, b.id].sort());
    });
});

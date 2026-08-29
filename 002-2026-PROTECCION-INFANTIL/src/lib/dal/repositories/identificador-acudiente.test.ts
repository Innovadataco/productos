/**
 * SPEC-163 (E-1, O-4): tests del IdentificadorAcudienteRepository — tenant por
 * colegioId denormalizado; duplicados; búsqueda cross-tenant para Fase C.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin, crearCurso, crearEstudiante, crearAcudienteEstudiante, crearPlataforma, crearIdentificadorAcudiente } from "@/lib/reporte-test-utils";
import { IdentificadorAcudienteRepository } from "./identificador-acudiente";

async function sembrar() {
    const plataforma = await crearPlataforma();
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    const cursoA = await crearCurso(a.id, { nombre: "Curso A" });
    const cursoB = await crearCurso(b.id, { nombre: "Curso B" });
    const estudianteA = await crearEstudiante(cursoA.id, a.id, { nombre: "Alumno A" });
    const estudianteB = await crearEstudiante(cursoB.id, b.id, { nombre: "Alumno B" });
    const acudienteA = await crearAcudienteEstudiante(estudianteA.id);
    const acudienteB = await crearAcudienteEstudiante(estudianteB.id);
    const repo = new IdentificadorAcudienteRepository();
    return { a, b, cursoA, cursoB, estudianteA, estudianteB, acudienteA, acudienteB, repo, plataforma };
}

describe("IdentificadorAcudienteRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarPorAcudiente solo devuelve activos del acudiente cuando el tenant coincide", async () => {
        const { a, acudienteA, repo, plataforma } = await sembrar();
        await crearIdentificadorAcudiente(acudienteA.id, a.id, { valor: "a1@example.com" });
        await crearIdentificadorAcudiente(acudienteA.id, a.id, { valor: "a2@example.com", estado: "inactivo" });

        const propios = await repo.listarPorAcudiente(a.id, acudienteA.id);
        expect(propios).toHaveLength(1);
        expect(propios[0].valor).toBe("a1@example.com");
    });

    it("crear bajo un acudiente de OTRO colegio lanza 404", async () => {
        const { a, acudienteB, repo } = await sembrar();
        await expect(
            repo.crear(a.id, { acudienteId: acudienteB.id, tipo: "email", valor: "intruso@test.local", plataformaId: null })
        ).rejects.toMatchObject({ statusCode: 404 });
        const count = await prisma.identificadorAcudiente.count({ where: { valor: "intruso@test.local" } });
        expect(count).toBe(0);
    });

    it("buscarDuplicado detecta duplicado y excluirId se excluye a sí mismo", async () => {
        const { a, acudienteA, repo, plataforma } = await sembrar();
        const creado = await repo.crear(a.id, { acudienteId: acudienteA.id, tipo: "email", valor: "a@example.com", plataformaId: plataforma.id });

        const duplicado = await repo.buscarDuplicado(a.id, {
            acudienteId: acudienteA.id,
            tipo: "email",
            valor: "a@example.com",
            plataformaId: plataforma.id,
        });
        expect(duplicado).not.toBeNull();

        const sinDuplicado = await repo.buscarDuplicado(
            a.id,
            { acudienteId: acudienteA.id, tipo: "email", valor: "a@example.com", plataformaId: plataforma.id },
            creado.id
        );
        expect(sinDuplicado).toBeNull();
    });

    it("obtenerPorId devuelve null para el id de OTRO colegio", async () => {
        const { a, b, acudienteB, repo } = await sembrar();
        const ajeno = await crearIdentificadorAcudiente(acudienteB.id, b.id, { valor: "b@example.com" });
        expect(await repo.obtenerPorId(a.id, ajeno.id)).toBeNull();
        expect(await repo.obtenerPorId(b.id, ajeno.id)).not.toBeNull();
    });

    it("actualizar por id del propio colegio persiste y rechaza el ajeno", async () => {
        const { a, b, acudienteA, acudienteB, repo } = await sembrar();
        const propio = await repo.crear(a.id, { acudienteId: acudienteA.id, tipo: "email", valor: "a@example.com", plataformaId: null });
        const ajeno = await crearIdentificadorAcudiente(acudienteB.id, b.id, { valor: "b@example.com" });

        const actualizado = await repo.actualizar(a.id, propio.id, { valor: "a2@example.com" });
        expect(actualizado.valor).toBe("a2@example.com");

        await expect(repo.actualizar(a.id, ajeno.id, { valor: "hackeado" })).rejects.toMatchObject({ statusCode: 404 });
        const intacto = await prisma.identificadorAcudiente.findUnique({ where: { id: ajeno.id } });
        expect(intacto!.valor).toBe("b@example.com");
    });

    it("cambiarEstado funciona en el propio colegio y lanza 404 en el ajeno", async () => {
        const { a, b, acudienteA, acudienteB, repo } = await sembrar();
        const ajeno = await crearIdentificadorAcudiente(acudienteB.id, b.id, { valor: "b@example.com" });
        const propio = await repo.crear(a.id, { acudienteId: acudienteA.id, tipo: "email", valor: "a@example.com", plataformaId: null });

        await expect(repo.cambiarEstado(a.id, ajeno.id, "inactivo")).rejects.toMatchObject({ statusCode: 404 });
        const inactivo = await repo.cambiarEstado(a.id, propio.id, "inactivo");
        expect(inactivo.estado).toBe("inactivo");

        const reactivado = await repo.cambiarEstado(a.id, propio.id, "activo");
        expect(reactivado.estado).toBe("activo");
    });

    it("EXCEPCIÓN documentada: buscarActivosPorValor recorre TODOS los colegios", async () => {
        const { a, b, acudienteA, acudienteB, repo } = await sembrar();
        await repo.crear(a.id, { acudienteId: acudienteA.id, tipo: "telefono", valor: "+57300COMUN1", plataformaId: null });
        await repo.crear(b.id, { acudienteId: acudienteB.id, tipo: "telefono", valor: "+57300comun1", plataformaId: null });

        const encontrados = await repo.buscarActivosPorValor("+57300COMUN1");
        const colegios = encontrados.map((x) => x.acudiente.estudiante.colegioId).sort();
        expect(encontrados.length).toBe(2);
        expect(colegios).toEqual([a.id, b.id].sort());
    });
});

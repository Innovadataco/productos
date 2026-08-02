/**
 * E-8: tests del CiudadRepository — catálogo geográfico (activos, filtros y la
 * búsqueda por nombreNormalizado con prefijo primero). Seeds únicos por corrida
 * (ciudad/departamento no las limpia resetDatabase; se purgan localmente).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPaisCiudad } from "@/lib/reporte-test-utils";
import { normalizarNombreGeografico } from "@/lib/normalizar";
import { CiudadRepository } from "./ciudad";

const TAG = Math.random().toString(36).slice(2, 8);

async function sembrarGeografia() {
    const { pais } = await crearPaisCiudad();
    const departamento = await prisma.departamento.create({
        data: { nombre: `Cund-${TAG}`, paisId: pais.id, esActivo: true },
    });
    const bogota = await prisma.ciudad.findFirst({ where: { paisId: pais.id } });
    const otra = await prisma.ciudad.create({
        data: {
            nombre: `Chia-${TAG}`,
            paisId: pais.id,
            departamentoId: departamento.id,
            esActivo: true,
            nombreNormalizado: normalizarNombreGeografico(`Chia-${TAG}`),
            poblacion: 100000,
        },
    });
    const inactiva = await prisma.ciudad.create({
        data: {
            nombre: `Inactiva-${TAG}`,
            paisId: pais.id,
            esActivo: false,
            nombreNormalizado: `inactiva-${TAG}`,
        },
    });
    return { pais, departamento, bogota, otra, inactiva };
}

describe("CiudadRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.ciudad.deleteMany();
        await prisma.departamento.deleteMany();
    });

    it("listarActivasPorPais devuelve solo activas del país, alfabéticas, con filtro de departamento", async () => {
        const { pais, departamento, otra, inactiva } = await sembrarGeografia();
        const repo = new CiudadRepository();

        const todas = await repo.listarActivasPorPais(pais.id);
        expect(todas.some((c) => c.id === inactiva.id), "las inactivas no se listan").toBe(false);
        expect(todas.some((c) => c.id === otra.id)).toBe(true);
        expect(todas.map((c) => c.nombre)).toEqual([...todas.map((c) => c.nombre)].sort());

        const delDepto = await repo.listarActivasPorPais(pais.id, departamento.id);
        expect(delDepto.map((c) => c.id)).toEqual([otra.id]);
    });

    it("buscarPorNombreNormalizado encuentra por nombre normalizado con prefijo primero y límite", async () => {
        const { pais, departamento, bogota, otra } = await sembrarGeografia();
        await prisma.ciudad.update({
            where: { id: bogota!.id },
            data: { nombreNormalizado: normalizarNombreGeografico(bogota!.nombre), poblacion: 8000000 },
        });
        const repo = new CiudadRepository();

        const qNorm = normalizarNombreGeografico(`chia-${TAG}`);
        const resultados = await repo.buscarPorNombreNormalizado({ paisId: pais.id, qNorm, limit: 20 });
        expect(resultados.map((c) => c.id)).toEqual([otra.id]);
        expect(resultados[0].departamento).toBe(departamento.nombre);

        const conDepto = await repo.buscarPorNombreNormalizado({ paisId: pais.id, qNorm, departamentoId: departamento.id, limit: 20 });
        expect(conDepto).toHaveLength(1);

        const sinDepto = await repo.buscarPorNombreNormalizado({ paisId: pais.id, qNorm, departamentoId: "no-existe", limit: 20 });
        expect(sinDepto).toHaveLength(0);

        const limite = await repo.buscarPorNombreNormalizado({ paisId: pais.id, qNorm: "a", limit: 1 });
        expect(limite).toHaveLength(1);
    });
});

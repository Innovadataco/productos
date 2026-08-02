/**
 * E-8: tests de DepartamentoRepository y PaisRepository (catálogo geográfico).
 * La BD de test es compartida y pais/departamento/ciudad NO las limpia
 * resetDatabase: los seeds usan nombres/códigos únicos por corrida y el setup
 * purga esas tablas localmente (respetando FKs).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPaisCiudad } from "@/lib/reporte-test-utils";
import { DepartamentoRepository } from "./departamento";
import { PaisRepository } from "./pais";

const TAG = Math.random().toString(36).slice(2, 8);

describe("DepartamentoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.ciudad.deleteMany();
        await prisma.departamento.deleteMany();
    });

    it("listarActivosPorPais devuelve solo activos del país, alfabéticos", async () => {
        const { pais } = await crearPaisCiudad();
        await prisma.departamento.create({ data: { nombre: `Valle-${TAG}`, paisId: pais.id, esActivo: true } });
        await prisma.departamento.create({ data: { nombre: `Antioquia-${TAG}`, paisId: pais.id, esActivo: true } });
        await prisma.departamento.create({ data: { nombre: `Inactivo-${TAG}`, paisId: pais.id, esActivo: false } });
        const repo = new DepartamentoRepository();

        const lista = await repo.listarActivosPorPais(pais.id);
        expect(lista.map((d) => d.nombre)).toEqual([`Antioquia-${TAG}`, `Valle-${TAG}`]);
        expect(lista.some((d) => d.nombre === `Inactivo-${TAG}`), "los inactivos no se listan").toBe(false);
    });
});

describe("PaisRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
        await prisma.ciudad.deleteMany();
        await prisma.departamento.deleteMany();
        await prisma.pais.deleteMany();
    });

    it("listarActivos devuelve solo activos, alfabéticos, con código y nombre", async () => {
        const { pais } = await crearPaisCiudad();
        await prisma.pais.create({ data: { codigo: `A${TAG[0].toUpperCase()}`, nombre: `Aaa-${TAG}`, esActivo: true } });
        await prisma.pais.create({ data: { codigo: `Z${TAG[1].toUpperCase()}`, nombre: `Zzz-${TAG}`, esActivo: false } });
        const repo = new PaisRepository();

        const lista = await repo.listarActivos();
        const nombres = lista.map((p) => p.nombre);
        expect(nombres).toContain(pais.nombre);
        expect(nombres).toContain(`Aaa-${TAG}`);
        expect(nombres).not.toContain(`Zzz-${TAG}`);
        expect(nombres).toEqual([...nombres].sort());
        expect(lista.every((p) => typeof p.id === "string" && typeof p.codigo === "string")).toBe(true);
    });
});

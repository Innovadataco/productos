import { describe, it, expect } from "vitest";
import { calcularDesactivaciones, type FilaCiudad } from "./dedup-ciudades";

function fila(parcial: Partial<FilaCiudad> & { id: string }): FilaCiudad {
    return {
        nombre: parcial.id,
        nombreNormalizado: parcial.id,
        departamentoId: "depto-1",
        poblacion: null,
        creadoEn: new Date("2026-01-01T00:00:00Z"),
        ...parcial,
    };
}

describe("calcularDesactivaciones (dedup-ciudades)", () => {
    it("catálogo sin duplicados no desactiva nada", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "Bogotá", nombre: "Bogotá", nombreNormalizado: "bogota", poblacion: 7_400_000 }),
            fila({ id: "Medellín", nombre: "Medellín", nombreNormalizado: "medellin", poblacion: 2_500_000 }),
        ]);
        expect(resultado).toEqual([]);
    });

    it("conserva la de mayor población y desactiva la otra (tildes/variantes)", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "barbosa-chica", nombre: "Barbosa", nombreNormalizado: "barbosa", poblacion: 50_000 }),
            fila({ id: "barbosa-gn", nombre: "Barbosa", nombreNormalizado: "barbosa", poblacion: 62_000 }),
        ]);
        expect(resultado).toHaveLength(1);
        expect(resultado[0].id).toBe("barbosa-chica");
    });

    it("población null nunca gana sobre una con población", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "con-poblacion", nombre: "X", nombreNormalizado: "x", poblacion: 1 }),
            fila({ id: "sin-poblacion", nombre: "X", nombreNormalizado: "x", poblacion: null }),
        ]);
        expect(resultado.map((d) => d.id)).toEqual(["sin-poblacion"]);
    });

    it("empate de población → conserva la de creadoEn más antiguo", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "vieja", nombre: "Y", nombreNormalizado: "y", poblacion: 100, creadoEn: new Date("2026-07-27T00:00:00Z") }),
            fila({ id: "nueva", nombre: "Y", nombreNormalizado: "y", poblacion: 100, creadoEn: new Date("2026-08-01T00:00:00Z") }),
        ]);
        expect(resultado.map((d) => d.id)).toEqual(["nueva"]);
    });

    it("mismo nombre en departamentos distintos NO son duplicados", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "arauca-1", nombre: "Arauca", nombreNormalizado: "arauca", departamentoId: "depto-a" }),
            fila({ id: "arauca-2", nombre: "Arauca", nombreNormalizado: "arauca", departamentoId: "depto-b" }),
        ]);
        expect(resultado).toEqual([]);
    });

    it("«Bogotá  D.C.» (doble espacio) cede ante «Bogotá» aunque tenga más población", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "bogota", nombre: "Bogotá", nombreNormalizado: "bogota", poblacion: 7_400_000 }),
            fila({ id: "bogota-dc", nombre: "Bogotá  D.C.", nombreNormalizado: "bogota d.c.", poblacion: 9_000_000 }),
        ]);
        expect(resultado.map((d) => d.id)).toEqual(["bogota-dc"]);
    });

    it("el caso Bogotá exige la canónica en el MISMO departamento", () => {
        const resultado = calcularDesactivaciones([
            fila({ id: "bogota-dc", nombre: "Bogotá  D.C.", nombreNormalizado: "bogota d.c.", departamentoId: "depto-x" }),
            fila({ id: "bogota", nombre: "Bogotá", nombreNormalizado: "bogota", departamentoId: "depto-y" }),
        ]);
        // Sin «Bogotá» en el mismo departamento no aplica el caso explícito…
        // pero SÍ aplican las claves colapsadas: «bogota d.c.» ≠ «bogota», sin dup.
        expect(resultado).toEqual([]);
    });
});

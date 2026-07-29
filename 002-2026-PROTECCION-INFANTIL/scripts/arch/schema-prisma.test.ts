/**
 * SPEC-126 (T009): oráculos del parser del schema. Sin BD.
 * Oráculo verificado 2026-07-29: 47 modelos; huérfanos = excepciones declaradas.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { aristasER, modelosHuerfanos, parsearSchemaPrisma } from "./lib/schema-prisma";
import { RUTA_EXCEPCIONES, RUTA_SCHEMA } from "./lib/paths";

const modelos = parsearSchemaPrisma(RUTA_SCHEMA);
const excepciones = JSON.parse(fs.readFileSync(RUTA_EXCEPCIONES, "utf-8")) as { huerfanosPermitidos: string[] };

describe("parser schema.prisma (SPEC-126)", () => {
    it("oráculo: 47 modelos", () => {
        expect(modelos.length).toBe(47);
    });

    it("oráculo: huérfanos = lista de excepciones declarada (ni uno más, ni uno menos)", () => {
        expect(modelosHuerfanos(modelos)).toEqual([...excepciones.huerfanosPermitidos].sort());
    });

    it("Tenant NO es huérfano (lo referencian Usuario, Reporte, Colegio)", () => {
        expect(modelosHuerfanos(modelos)).not.toContain("Tenant");
    });

    it("las aristas ER se derivan de las FK y son estables", () => {
        const aristas = aristasER(modelos);
        expect(aristas.length).toBeGreaterThan(30);
        const claves = aristas.map((a) => `${a.padre}->${a.hijo}.${a.campoFk}`);
        expect(new Set(claves).size).toBe(claves.length); // sin duplicados
        expect(claves).toEqual([...claves].sort()); // orden estable
    });

    it("IdentificadorReportado conserva los 5 campos rotulados I-29", () => {
        const modelo = modelos.find((m) => m.nombre === "IdentificadorReportado");
        expect(modelo).toBeDefined();
        const campos = new Set(modelo!.campos.map((c) => c.nombre));
        for (const campo of ["score", "scoreAnonimo", "scoreAutenticado", "scoreAjustado", "nivelRiesgo"]) {
            expect(campos.has(campo), `falta ${campo} en IdentificadorReportado`).toBe(true);
        }
    });
});

/**
 * SPEC-126 (T009): oráculos del parser del schema. Sin BD.
 * Oráculo verificado 2026-07-29: 47 modelos; huérfanos = excepciones declaradas.
 * Actualizado 2026-08-01: 48 modelos — SPEC-132 añadió CargaRosterSesion (cambio
 * intencional: prevalece el conteo real, regla de oráculos de SPEC-126).
 * Actualizado 2026-08-02: 50 modelos — SPEC-139/142 (002-PI-056) añadieron
 * EventoMatch y PatronInstitucional (misma regla).
 * Actualizado 2026-08-03: 51 modelos — SPEC-144 (002-PI-058) añadió
 * AcudienteEstudiante (tabla hija D1; rename Alumno→Estudiante es @@map, no suma).
 * Actualizado 2026-08-03: 52 modelos — SPEC-145 (002-PI-058) añadió Profesor
 * (mínimo §7.2; Curso.profesorTitularId es columna, no suma).
 * Actualizado 2026-08-09: 54 modelos — SPEC-149 añadió PreferenciaAlertaColegio
 * y RegistroAvisoColegio (avisos por email del colegio; misma regla).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { aristasER, modelosHuerfanos, parsearSchemaPrisma } from "./lib/schema-prisma";
import { RUTA_EXCEPCIONES, RUTA_SCHEMA } from "./lib/paths";

const modelos = parsearSchemaPrisma(RUTA_SCHEMA);
const excepciones = JSON.parse(fs.readFileSync(RUTA_EXCEPCIONES, "utf-8")) as { huerfanosPermitidos: string[] };

describe("parser schema.prisma (SPEC-126)", () => {
    it("oráculo: 54 modelos (52 + PreferenciaAlertaColegio y RegistroAvisoColegio de SPEC-149)", () => {
        expect(modelos.length).toBe(54);
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

/**
 * SPEC-335: clasificación por fila de la carga de profesores.
 * Decisión CEO: el duplicado se REPORTA (nunca en silencio).
 */
import { describe, it, expect } from "vitest";
import { validarFilasProfesores } from "./validator";
import type { FilaCargaProfesor } from "./parser";

const TIPOS = new Set(["CC", "CE"]);

function fila(over: Partial<FilaCargaProfesor> = {}): FilaCargaProfesor {
    return {
        fila: 2,
        nombre: "Ana",
        apellidos: "Rueda",
        tipoDocumento: "CC",
        numeroDocumento: "1001",
        anioNacimiento: "1985",
        sexo: "F",
        email: "ana@colegio.test",
        telefono: "3001234567",
        ...over,
    };
}

describe("validarFilasProfesores (SPEC-335)", () => {
    it("fila válida y nueva → crear", () => {
        const r = validarFilasProfesores([fila()], TIPOS, new Set());
        expect(r.resumen).toEqual({ crear: 1, omitidos: 0, errores: 0 });
        expect(r.aCrear).toHaveLength(1);
        expect(r.aCrear[0]?.anioNacimiento).toBe(1985);
    });

    it("identidad ya existente en el colegio → omitido REPORTADO con motivo", () => {
        const r = validarFilasProfesores([fila()], TIPOS, new Set(["CC|1001"]));
        expect(r.resumen).toEqual({ crear: 0, omitidos: 1, errores: 0 });
        expect(r.clasificadas[0]?.estado).toBe("omitido");
        expect(r.clasificadas[0]?.motivo).toBe("ya existe por documento");
        expect(r.aCrear).toHaveLength(0);
    });

    it("misma identidad dos veces en el archivo → crea una y reporta la otra", () => {
        const r = validarFilasProfesores([fila(), fila({ fila: 3, nombre: "Ana II" })], TIPOS, new Set());
        expect(r.resumen).toEqual({ crear: 1, omitidos: 1, errores: 0 });
        expect(r.clasificadas[1]?.motivo).toBe("repetido en el archivo");
        expect(r.aCrear).toHaveLength(1);
    });

    it("tipo de documento fuera del catálogo (o inactivo) → error", () => {
        const r = validarFilasProfesores([fila({ tipoDocumento: "XX" })], TIPOS, new Set());
        expect(r.clasificadas[0]?.estado).toBe("error");
        expect(r.clasificadas[0]?.motivo).toContain("Tipo de documento");
    });

    it("sexo fuera de M|F|OTRO → error", () => {
        const r = validarFilasProfesores([fila({ sexo: "X" })], TIPOS, new Set());
        expect(r.clasificadas[0]?.motivo).toContain("Sexo inválido");
    });

    it("email inválido → error", () => {
        const r = validarFilasProfesores([fila({ email: "no-es-email" })], TIPOS, new Set());
        expect(r.clasificadas[0]?.motivo).toContain("Email inválido");
    });

    it("año de nacimiento inválido → error", () => {
        const r = validarFilasProfesores([fila({ anioNacimiento: "1500" })], TIPOS, new Set());
        expect(r.clasificadas[0]?.motivo).toContain("Año de nacimiento");
    });

    it("faltan obligatorios → error que los nombra", () => {
        const r = validarFilasProfesores([fila({ telefono: "", email: "" })], TIPOS, new Set());
        expect(r.clasificadas[0]?.motivo).toContain("email");
        expect(r.clasificadas[0]?.motivo).toContain("telefono");
    });

    it("idempotencia: resubir un archivo ya cargado → 0 a crear, todo omitido", () => {
        const filas = [fila(), fila({ fila: 3, numeroDocumento: "1002" })];
        const yaEnBd = new Set(["CC|1001", "CC|1002"]);
        const r = validarFilasProfesores(filas, TIPOS, yaEnBd);
        expect(r.resumen).toEqual({ crear: 0, omitidos: 2, errores: 0 });
        expect(r.aCrear).toHaveLength(0);
    });

    it("normaliza mayúsculas/espacios al comparar identidad", () => {
        const r = validarFilasProfesores([fila({ tipoDocumento: " cc ", numeroDocumento: " 1001 " })], TIPOS, new Set(["CC|1001"]));
        expect(r.clasificadas[0]?.motivo).toBe("ya existe por documento");
    });
});

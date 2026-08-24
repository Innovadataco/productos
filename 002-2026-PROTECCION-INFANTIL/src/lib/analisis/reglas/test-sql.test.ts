/**
 * SPEC-224 (002-PI-125, FR-007/FR-014): tests de los helpers puros del test
 * SQL del panel de reglas. Sin BD.
 */
import { describe, it, expect } from "vitest";
import {
    acotarTimeoutMs,
    acotarMaxFilas,
    envolverConLimit,
    huellaQuery,
    extraerColumnas,
    esErrorTimeoutPg,
    mensajeErrorPg,
    extraerVariablesPlantilla,
    variablesSinColumna,
} from "./test-sql";

describe("acotarTimeoutMs / acotarMaxFilas", () => {
    it("aplica defaults ante null/undefined/NaN", () => {
        expect(acotarTimeoutMs(null)).toBe(5000);
        expect(acotarTimeoutMs(undefined)).toBe(5000);
        expect(acotarTimeoutMs(NaN)).toBe(5000);
        expect(acotarMaxFilas(null)).toBe(50);
    });
    it("acota a los rangos 1000..30000 y 1..200", () => {
        expect(acotarTimeoutMs(10)).toBe(1000);
        expect(acotarTimeoutMs(999999)).toBe(30000);
        expect(acotarTimeoutMs(5000.9)).toBe(5000);
        expect(acotarMaxFilas(0)).toBe(1);
        expect(acotarMaxFilas(1000)).toBe(200);
    });
});

describe("envolverConLimit", () => {
    it("envuelve como subconsulta cuando no hay LIMIT", () => {
        expect(envolverConLimit("SELECT id FROM t", 50)).toBe(
            "SELECT * FROM (SELECT id FROM t) AS test_limit LIMIT 50"
        );
    });
    it("respeta un LIMIT exterior menor o igual al máximo", () => {
        expect(envolverConLimit("SELECT id FROM t LIMIT 10", 50)).toBe("SELECT id FROM t LIMIT 10");
        expect(envolverConLimit("SELECT id FROM t LIMIT 50;", 50)).toBe("SELECT id FROM t LIMIT 50");
    });
    it("envuelve cuando el LIMIT declarado supera el máximo", () => {
        expect(envolverConLimit("SELECT id FROM t LIMIT 500", 50)).toBe(
            "SELECT * FROM (SELECT id FROM t LIMIT 500) AS test_limit LIMIT 50"
        );
    });
    it("quita el punto y coma final al envolver", () => {
        expect(envolverConLimit("SELECT 1;", 50)).toBe("SELECT * FROM (SELECT 1) AS test_limit LIMIT 50");
    });
    it("no confunde un LIMIT dentro de un literal con el exterior", () => {
        const sql = "SELECT 'LIMIT 999' AS x FROM t";
        expect(envolverConLimit(sql, 50)).toBe(
            "SELECT * FROM (SELECT 'LIMIT 999' AS x FROM t) AS test_limit LIMIT 50"
        );
    });
    it("admite CTE al envolver", () => {
        const sql = "WITH a AS (SELECT 1) SELECT * FROM a";
        expect(envolverConLimit(sql, 50)).toBe(
            "SELECT * FROM (WITH a AS (SELECT 1) SELECT * FROM a) AS test_limit LIMIT 50"
        );
    });
});

describe("huellaQuery", () => {
    it("es determinista, 16 chars hex, y cambia con el query", () => {
        const h1 = huellaQuery("SELECT 1");
        expect(h1).toMatch(/^[0-9a-f]{16}$/);
        expect(huellaQuery("SELECT 1")).toBe(h1);
        expect(huellaQuery("SELECT 2")).not.toBe(h1);
    });
});

describe("extraerColumnas", () => {
    it("devuelve las claves de la primera fila; vacío sin filas", () => {
        expect(extraerColumnas([{ a: 1, b: "x" }])).toEqual(["a", "b"]);
        expect(extraerColumnas([])).toEqual([]);
    });
});

describe("mensajeErrorPg", () => {
    it("traduce el timeout (57014) a mensaje legible", () => {
        const err = Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" });
        expect(esErrorTimeoutPg(err)).toBe(true);
        expect(mensajeErrorPg(err, 5000)).toBe("La consulta excedió el tiempo máximo de prueba (5000 ms)");
    });
    it("trunca a la primera línea y 300 chars, sin stack", () => {
        const err = new Error('relation "no_existe" does not exist\nLINE 1: SELECT * FROM no_existe\n'.repeat(20));
        const msg = mensajeErrorPg(err, 5000);
        expect(msg.startsWith("La consulta falló:")).toBe(true);
        expect(msg.includes("LINE 1")).toBe(false);
        expect(msg.length).toBeLessThanOrEqual("La consulta falló: ".length + 300);
    });
});

describe("variables de plantilla", () => {
    it("extrae variables únicas en orden de aparición", () => {
        expect(extraerVariablesPlantilla("Llama a {{colegio}} · vence {{ fechaFin }} · {{colegio}}")).toEqual([
            "colegio",
            "fechaFin",
        ]);
        expect(extraerVariablesPlantilla("sin variables")).toEqual([]);
    });
    it("marca las variables sin columna correspondiente", () => {
        expect(variablesSinColumna("Llama a {{colegio}} · vence {{fechaFin}}", ["fechaFin", "id"])).toEqual([
            "colegio",
        ]);
    });
});

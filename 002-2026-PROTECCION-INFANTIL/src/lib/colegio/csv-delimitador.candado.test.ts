/**
 * SPEC-911 · CANDADO que muere con el defecto: los dos parsers de carga masiva
 * (profesores y alumnos) auto-detectan el delimitador. Excel en español guarda los
 * CSV con `;`; un parser que divide SOLO por coma mete todo el encabezado en una
 * columna → "faltan TODAS las columnas obligatorias".
 *
 * Muere con el defecto: sin la auto-detección, parsear un CSV `;`-delimitado devuelve
 * UNA sola columna (la aserción de 8 columnas cae). Control positivo: el mismo
 * contenido `,`-delimitado da las columnas correctas con AMBOS parsers. Se verifica
 * además que una coma INTERNA entre comillas no parte la celda ni confunde el sniff.
 */
import { describe, it, expect } from "vitest";
import { detectarDelimitadorCsv } from "./csv-delimitador";
import { parseCsv } from "./carga-profesores/parser";
import { parseCsvManual } from "./carga/parser";

const COLS = "nombre;apellidos;tipo_documento;numero_documento;anio_nacimiento;sexo;email;telefono";
// Fila con una coma INTERNA en `apellidos`, entre comillas (celda legítima).
const CSV_PUNTOYCOMA = `${COLS}\nAndrés;"Mora, Ramírez";CC;80114552;1985;M;a@b.co;+573152201144`;
// El mismo contenido con coma como delimitador (solo cambian los separadores `;`→`,`;
// la coma interna de "Mora, Ramírez" queda intacta porque el replace solo toca `;`).
const CSV_COMA = CSV_PUNTOYCOMA.replace(/;/g, ",");

describe("SPEC-911 · detectarDelimitadorCsv (sniff de la 1ª línea)", () => {
    it("detecta `;` cuando es el mayoritario del encabezado", () => {
        expect(detectarDelimitadorCsv(COLS + "\nx;y;z")).toBe(";");
    });
    it("detecta `,` cuando es el mayoritario", () => {
        expect(detectarDelimitadorCsv("nombre,apellidos,email\na,b,c")).toBe(",");
    });
    it("default coma si empatan o no hay delimitador", () => {
        expect(detectarDelimitadorCsv("a,b;c")).toBe(","); // empate 1-1
        expect(detectarDelimitadorCsv("solounacolumna")).toBe(",");
    });
    it("una coma entre comillas no tienta al sniff hacia coma", () => {
        // 2 `;` fuera de comillas, 0 comas fuera de comillas → `;`.
        expect(detectarDelimitadorCsv('nombre;"Mora, Ramírez";email')).toBe(";");
    });
});

describe("SPEC-911 · ambos parsers auto-detectan el delimitador `;`", () => {
    it("parser de profesores: `;`-delimitado → 8 columnas, coma interna preservada", () => {
        const filas = parseCsv(CSV_PUNTOYCOMA);
        expect(filas[0]).toHaveLength(8); // sin el fix: 1 columna → cae acá
        expect(filas[0]).toContain("tipo_documento");
        expect(filas[1]).toHaveLength(8);
        expect(filas[1][1]).toBe("Mora, Ramírez"); // la coma interna NO parte la celda
    });

    it("parser de alumnos: `;`-delimitado → 8 columnas, coma interna preservada", () => {
        const filas = parseCsvManual(CSV_PUNTOYCOMA);
        expect(filas[0]).toHaveLength(8);
        expect(filas[1]).toHaveLength(8);
        expect(filas[1][1]).toBe("Mora, Ramírez");
    });

    it("control positivo: `,`-delimitado da las columnas correctas en ambos parsers", () => {
        expect(parseCsv(CSV_COMA)[0]).toHaveLength(8);
        expect(parseCsvManual(CSV_COMA)[0]).toHaveLength(8);
        // En el archivo con coma, la celda citada conserva su coma interna.
        expect(parseCsv(CSV_COMA)[1][1]).toBe("Mora, Ramírez");
    });
});

import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseArchivoCarga, COLUMNAS_REQUERIDAS } from "./parser";

function csvToBuffer(csv: string): ArrayBuffer {
    return new TextEncoder().encode(csv).buffer as ArrayBuffer;
}

function buildXlsxBuffer(rows: unknown[][]): ArrayBuffer {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    return (buf instanceof ArrayBuffer ? buf : new Uint8Array(buf).buffer) as ArrayBuffer;
}

const CSV_VALIDO = [
    COLUMNAS_REQUERIDAS.join(","),
    "6A,Sexto,2026,María Gómez,telefono,+573001234567,ALUMNO,WhatsApp",
    "6A,Sexto,2026,Carlos Ruiz,email,carlos@example.com,PADRE,",
].join("\n");

describe("parser", () => {
    it("parsea CSV válido a filas", () => {
        const resultado = parseArchivoCarga(csvToBuffer(CSV_VALIDO), "csv");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(2);
        expect(resultado.filas[0].curso.nombre).toBe("6A");
        expect(resultado.filas[0].alumno.nombre).toBe("María Gómez");
        expect(resultado.filas[0].identificador.valor).toBe("+573001234567");
        expect(resultado.filas[0].identificador.etiquetaRelacion).toBe("ALUMNO");
        expect(resultado.filas[0].identificador.plataformaId).toBe("WhatsApp");
    });

    it("parsea XLSX válido a filas", () => {
        const rows = [
            COLUMNAS_REQUERIDAS,
            ["6A", "Sexto", "2026", "Ana López", "telefono", "+573009876543", "MADRE", ""],
        ];
        const resultado = parseArchivoCarga(buildXlsxBuffer(rows), "xlsx");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(1);
        expect(resultado.filas[0].alumno.nombre).toBe("Ana López");
        expect(resultado.filas[0].identificador.plataformaId).toBeNull();
    });

    it("detecta encabezados faltantes", () => {
        const csv = ["nombre_curso,nombre_alumno", "6A,María"].join("\n");
        const resultado = parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores.length).toBeGreaterThan(0);
        expect(resultado.errores.some((e) => e.mensaje.includes("grado"))).toBe(true);
    });

    it("acepta encabezados con mayúsculas y espacios", () => {
        const headers = COLUMNAS_REQUERIDAS.map((h) => h.replace(/_/g, " ").toUpperCase());
        const csv = [headers.join(","), "6A,Sexto,2026,María Gómez,telefono,+573001234567,ALUMNO,"].join("\n");
        const resultado = parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(1);
    });

    it("ignora filas vacías", () => {
        const csv = [COLUMNAS_REQUERIDAS.join(","), "6A,Sexto,2026,María,telefono,123,ALUMNO,", ",,,,,,,"].join("\n");
        const resultado = parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.filas).toHaveLength(1);
    });

    it("reporta archivo solo con encabezados", () => {
        const csv = COLUMNAS_REQUERIDAS.join(",");
        const resultado = parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores[0].mensaje).toContain("encabezados");
    });

    it("reporta archivo vacío", () => {
        const resultado = parseArchivoCarga(new ArrayBuffer(0), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores[0].mensaje).toContain("vacío");
    });

    it("reporta error de lectura de archivo binario inválido", () => {
        const buffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;
        const resultado = parseArchivoCarga(buffer, "xlsx");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores.length).toBeGreaterThan(0);
    });
});

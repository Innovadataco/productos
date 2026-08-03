import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseArchivoCarga, COLUMNAS_REQUERIDAS, COLUMNA_OPCIONAL_APELLIDOS } from "./parser";

function csvToBuffer(csv: string): ArrayBuffer {
    return new TextEncoder().encode(csv).buffer as ArrayBuffer;
}

/**
 * Fixture XLSX construido con exceljs (SPEC-132 O-3: el test NO importa xlsx).
 * Mismas filas que generaba el fixture original con SheetJS.
 */
async function buildXlsxBuffer(rows: unknown[][]): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Hoja1");
    for (const row of rows) {
        worksheet.addRow(row as ExcelJS.CellValue[]);
    }
    const buf = await workbook.xlsx.writeBuffer();
    return buf as ArrayBuffer;
}

// SPEC-144 (D4): la plantilla nueva inserta `apellidos_alumno` tras `nombre_alumno`.
const COLUMNAS_CON_APELLIDOS = [
    ...COLUMNAS_REQUERIDAS.slice(0, 4),
    COLUMNA_OPCIONAL_APELLIDOS,
    ...COLUMNAS_REQUERIDAS.slice(4),
];

const CSV_VALIDO = [
    COLUMNAS_CON_APELLIDOS.join(","),
    "6A,Sexto,2026,María,Gómez Pérez,telefono,+573001234567,ESTUDIANTE,WhatsApp",
    "6A,Sexto,2026,Carlos,Ruiz,email,carlos@example.com,PADRE,",
].join("\n");

describe("parser", () => {
    it("parsea CSV válido a filas", async () => {
        const resultado = await parseArchivoCarga(csvToBuffer(CSV_VALIDO), "csv");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(2);
        expect(resultado.filas[0].curso.nombre).toBe("6A");
        expect(resultado.filas[0].alumno.nombre).toBe("María");
        expect(resultado.filas[0].alumno.apellidos).toBe("Gómez Pérez");
        expect(resultado.filas[1].alumno.apellidos).toBe("Ruiz");
        expect(resultado.filas[0].identificador.valor).toBe("+573001234567");
        expect(resultado.filas[0].identificador.etiquetaRelacion).toBe("ESTUDIANTE");
        expect(resultado.filas[0].identificador.plataformaId).toBe("WhatsApp");
    });

    it("normaliza la etiqueta legada ALUMNO a ESTUDIANTE y deja apellidos vacío sin la columna (D4)", async () => {
        const csv = [
            COLUMNAS_REQUERIDAS.join(","),
            "6A,Sexto,2026,María Gómez,telefono,+573001234567,ALUMNO,WhatsApp",
        ].join("\n");
        const resultado = await parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(1);
        expect(resultado.filas[0].alumno.apellidos).toBe("");
        expect(resultado.filas[0].identificador.etiquetaRelacion).toBe("ESTUDIANTE");
    });

    it("parsea XLSX válido a filas", async () => {
        const rows = [
            COLUMNAS_REQUERIDAS,
            ["6A", "Sexto", "2026", "Ana López", "telefono", "+573009876543", "MADRE", ""],
        ];
        const resultado = await parseArchivoCarga(await buildXlsxBuffer(rows), "xlsx");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(1);
        expect(resultado.filas[0].alumno.nombre).toBe("Ana López");
        expect(resultado.filas[0].identificador.plataformaId).toBeNull();
    });

    it("detecta encabezados faltantes", async () => {
        const csv = ["nombre_curso,nombre_alumno", "6A,María"].join("\n");
        const resultado = await parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores.length).toBeGreaterThan(0);
        expect(resultado.errores.some((e) => e.mensaje.includes("grado"))).toBe(true);
    });

    it("acepta encabezados con mayúsculas y espacios", async () => {
        const headers = COLUMNAS_REQUERIDAS.map((h) => h.replace(/_/g, " ").toUpperCase());
        const csv = [headers.join(","), "6A,Sexto,2026,María Gómez,telefono,+573001234567,ALUMNO,"].join("\n");
        const resultado = await parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.errores).toHaveLength(0);
        expect(resultado.filas).toHaveLength(1);
    });

    it("ignora filas vacías", async () => {
        const csv = [COLUMNAS_REQUERIDAS.join(","), "6A,Sexto,2026,María,telefono,123,ALUMNO,", ",,,,,,,"].join("\n");
        const resultado = await parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.filas).toHaveLength(1);
    });

    it("reporta archivo solo con encabezados", async () => {
        const csv = COLUMNAS_REQUERIDAS.join(",");
        const resultado = await parseArchivoCarga(csvToBuffer(csv), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores[0].mensaje).toContain("encabezados");
    });

    it("reporta archivo vacío", async () => {
        const resultado = await parseArchivoCarga(new ArrayBuffer(0), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores[0].mensaje).toContain("vacío");
    });

    it("reporta error de lectura de archivo binario inválido", async () => {
        const buffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer as ArrayBuffer;
        const resultado = await parseArchivoCarga(buffer, "xlsx");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores.length).toBeGreaterThan(0);
    });

    it("rechaza un archivo sobre el límite de tamaño (SPEC-132 S-3)", async () => {
        const grande = new ArrayBuffer(6 * 1024 * 1024);
        const resultado = await parseArchivoCarga(grande, "xlsx");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores[0].mensaje).toContain("tamaño máximo");
    });

    it("rechaza un archivo con más filas que el límite (SPEC-132 S-3)", async () => {
        const lineas = [COLUMNAS_REQUERIDAS.join(",")];
        for (let i = 0; i < 2001; i++) {
            lineas.push(`6A,Sexto,2026,Alumno ${i},telefono,${3000000000 + i},ALUMNO,`);
        }
        const resultado = await parseArchivoCarga(csvToBuffer(lineas.join("\n")), "csv");
        expect(resultado.filas).toHaveLength(0);
        expect(resultado.errores[0].mensaje).toContain("máximo");
    });
});

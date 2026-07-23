import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  normalizarFechaExcel,
  normalizarHoraExcel,
  leerRegistrosXlsx,
  leerRegistrosCsv,
  generarPlantillaPreventivoCorrectivo,
} from "./excel";
import { validarTiposDeDato, COLUMNAS_PREVENTIVO_CORRECTIVO } from "./validacion";

const CABECERAS = COLUMNAS_PREVENTIVO_CORRECTIVO.map((c) => c.nombre);

function filaValida(): Record<string, unknown> {
  return {
    vigiladoId: "900853057",
    placa: "ABC123",
    fecha: "2026-07-20",
    hora: "08:30",
    nit: "900555444",
    razonSocial: "TALLER DEMO",
    tipoIdentificacion: "1",
    numeroIdentificacion: "1010",
    nombresResponsable: "INGENIERO DEMO",
    detalleActividades: "Cambio de aceite",
  };
}

async function xlsxBuffer(filas: Array<Record<string, unknown>>, cabeceras = CABECERAS): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("mantenimiento");
  ws.columns = cabeceras.map((h) => ({ header: h, key: h, width: 15 }));
  for (const f of filas) ws.addRow(f);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("normalización de fechas (formatos del legacy, luxon)", () => {
  it("Date, serial de Excel, dd/MM/yyyy, MM-dd-yyyy e ISO → AAAA-MM-DD sin corrimiento", () => {
    expect(normalizarFechaExcel(new Date(2026, 6, 20))).toBe("2026-07-20");
    expect(normalizarFechaExcel(46213)).toBe("2026-07-10"); // serial Excel (25569 = 1970-01-01)
    expect(normalizarFechaExcel("20/07/2026")).toBe("2026-07-20");
    expect(normalizarFechaExcel("07-20-2026")).toBe("2026-07-20");
    expect(normalizarFechaExcel("2026-07-20")).toBe("2026-07-20");
    expect(normalizarFechaExcel("")).toBeNull();
  });
});

describe("normalización de horas (formatos del legacy, luxon)", () => {
  it("fracción de día, H:mm, h:mm a y HH:mm:ss → HH:mm", () => {
    expect(normalizarHoraExcel(0.5)).toBe("12:00");
    expect(normalizarHoraExcel(0.354166667)).toBe("08:30");
    expect(normalizarHoraExcel("8:30")).toBe("08:30");
    expect(normalizarHoraExcel("8:30 AM")).toBe("08:30");
    expect(normalizarHoraExcel("2:05 PM")).toBe("14:05");
    expect(normalizarHoraExcel("08:30:15")).toBe("08:30");
    expect(normalizarHoraExcel("")).toBeNull();
  });
});

describe("lectura XLSX (pipeline compartido)", () => {
  it("archivo válido → registros con __fila__ y cero errores", async () => {
    const buf = await xlsxBuffer([filaValida(), filaValida()]);
    const r = await leerRegistrosXlsx(buf);
    expect(r.totalFilas).toBe(2);
    expect(r.errores).toEqual([]);
    expect(r.registros).toHaveLength(2);
    expect(r.registros[0].__fila__).toBe(2);
  });

  it("columna requerida ausente → error 400 'no contiene las columnas requeridas'", async () => {
    const buf = await xlsxBuffer([filaValida()], CABECERAS.filter((c) => c !== "nit"));
    await expect(leerRegistrosXlsx(buf)).rejects.toMatchObject({ status: 400 });
  });

  it("campo requerido vacío → 'Fila N: ...' y la fila NO entra en registros", async () => {
    const conVacio = { ...filaValida(), nit: "" };
    const r = await leerRegistrosXlsx(await xlsxBuffer([conVacio, filaValida()]));
    expect(r.totalFilas).toBe(2);
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]).toMatch(/^Fila 2: nit/);
    expect(r.registros).toHaveLength(1);
  });

  it("filas completamente vacías se ignoran; encabezados case-insensitive", async () => {
    const cabecerasMayus = CABECERAS.map((c) => c.toUpperCase());
    const fila = Object.fromEntries(
      Object.entries(filaValida()).map(([k, v]) => [k.toUpperCase(), v]),
    );
    const r = await leerRegistrosXlsx(await xlsxBuffer([fila], cabecerasMayus));
    expect(r.errores).toEqual([]);
    expect(r.registros).toHaveLength(1);
  });
});

describe("lectura CSV (formato nuevo D-019e — misma librería, mismo pipeline)", () => {
  it("CSV con coma → registros válidos, fecha y hora normalizadas", async () => {
    const csv = [
      CABECERAS.join(","),
      "900853057,DEF456,20/07/2026,8:30,900555444,TALLER DEMO,1,1010,MECANICO DEMO,Cambio de frenos",
    ].join("\n");
    const r = await leerRegistrosCsv(Buffer.from(csv, "utf8"));
    expect(r.errores).toEqual([]);
    expect(r.registros).toHaveLength(1);
    expect(r.registros[0]["fecha"]).toBe("2026-07-20");
    expect(r.registros[0]["hora"]).toBe("08:30");
  });

  it("CSV con punto y coma (tolerancia) → mismo resultado", async () => {
    const csv = [
      CABECERAS.join(";"),
      "900853057;DEF456;2026-07-20;08:30;900555444;TALLER DEMO;1;1010;MECANICO DEMO;Frenos",
    ].join("\n");
    const r = await leerRegistrosCsv(Buffer.from(csv, "utf8"));
    expect(r.errores).toEqual([]);
    expect(r.registros).toHaveLength(1);
  });

  it("CSV sin una columna requerida → 400", async () => {
    const csv = ["vigiladoId,placa", "900853057,ABC123"].join("\n");
    await expect(leerRegistrosCsv(Buffer.from(csv, "utf8"))).rejects.toMatchObject({ status: 400 });
  });
});

describe("validación por fila (todo-o-nada §10.10 + regex del gate)", () => {
  it("hora inválida, placa inválida y tipoIdentificacion fuera de 1..12 → 'Fila N: ...'", () => {
    const errores = validarTiposDeDato([
      Object.assign({ ...filaValida(), hora: "24:00" }, { __fila__: 2 }),
      Object.assign({ ...filaValida(), placa: "AB123" }, { __fila__: 3 }),
      Object.assign({ ...filaValida(), tipoIdentificacion: "13" }, { __fila__: 4 }),
      Object.assign({ ...filaValida(), nit: "no-num" }, { __fila__: 5 }),
    ]);
    expect(errores).toHaveLength(4);
    expect(errores[0]).toMatch(/^Fila 2: la columna hora/);
    expect(errores[1]).toMatch(/^Fila 3: la columna placa/);
    expect(errores[2]).toMatch(/^Fila 4: la columna tipoIdentificacion/);
    expect(errores[3]).toMatch(/^Fila 5: la columna nit/);
  });

  it("filas válidas → cero errores", () => {
    expect(validarTiposDeDato([filaValida()])).toEqual([]);
  });
});

describe("plantilla oficial (manual §10.10)", () => {
  it("hoja mantenimiento con las 10 columnas + hoja tipos_identificacion con 12 códigos", async () => {
    const buf = await generarPlantillaPreventivoCorrectivo();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
    const hoja = wb.getWorksheet("mantenimiento");
    const tipos = wb.getWorksheet("tipos_identificacion");
    expect(hoja).toBeTruthy();
    expect(tipos).toBeTruthy();
    const headers = (hoja!.getRow(1).values as unknown[]).filter(Boolean);
    expect(headers).toEqual(CABECERAS);
    expect(tipos!.rowCount).toBe(13); // encabezado + 12
  });
});

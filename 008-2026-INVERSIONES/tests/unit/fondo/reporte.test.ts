// El reporte de `actualizar-fondo` (antes dentro del script) en src/fondo/reporte.ts: las mismas líneas y la
// misma salida (0 bien · 3 fondo con fallo, dato atrasado o ningún fondo). Solo conteos, códigos, ids internos y
// fechas: nunca el código de negocio, el nombre ni valores. Datos inventados.
import { describe, expect, it } from "vitest";
import type { ResultadoFondo } from "@/fondo/actualizar";
import type { ResultadoExportacionFondo } from "@/fondo/exportar";
import { reporteExportacionFondo, reporteFondo, reporteImportacionFondo } from "@/fondo/reporte";

const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const base: ResultadoFondo = { fondos: 1, valoresNuevos: 3, valoresRevisados: 1, fallidos: [], ultimos: [{ instrumentoId: "fondo-a", ultimaFecha: dia("2024-03-12"), atrasado: false }] };

describe("reporteFondo", () => {
  it("todo bien: conteos y el último dato de cada fondo, salida 0", () => {
    expect(reporteFondo(base)).toEqual({
      lineas: ["✅ 1 fondo(s) · valores nuevos: 3 · revisados: 1", "   · fondo fondo-a · último dato: 2024-03-12"],
      codigoSalida: 0,
    });
  });

  it("sin fondos registrados: SIN_FONDOS y salida 3", () => {
    expect(reporteFondo({ ...base, fondos: 0, valoresNuevos: 0, valoresRevisados: 0, ultimos: [] })).toEqual({
      lineas: ["⚠️  SIN_FONDOS: no hay fondos (FIC) activos registrados. Regístrelo con --registrar."],
      codigoSalida: 3,
    });
  });

  it("dato atrasado o sin datos: ATRASADO y salida 3", () => {
    const r = reporteFondo({ ...base, ultimos: [{ instrumentoId: "fondo-a", ultimaFecha: null, atrasado: true }] });
    expect(r).toEqual({
      lineas: ["✅ 1 fondo(s) · valores nuevos: 3 · revisados: 1", "   · fondo fondo-a · último dato: sin datos · ATRASADO (más de 7 días)"],
      codigoSalida: 3,
    });
  });

  it("un fondo con fallo: su código, el detalle y los conteos, salida 3", () => {
    const r = reporteFondo({
      ...base,
      fallidos: [
        { instrumentoId: "fondo-b", codigo: "GUARDADO_ERROR", detalle: "PrismaClientKnownRequestError P2002", guardados: 1, conError: 2, descartados: 0 },
        { instrumentoId: "fondo-c", codigo: "SFC_HTTP_500", guardados: 0, conError: 0, descartados: 0 },
      ],
    });
    expect(r.lineas.slice(2)).toEqual([
      "⚠️  fondo fondo-b · GUARDADO_ERROR · PrismaClientKnownRequestError P2002 · guardados: 1 · con error: 2 · descartados: 0",
      "⚠️  fondo fondo-c · SFC_HTTP_500 · guardados: 0 · con error: 0 · descartados: 0",
    ]);
    expect(r.codigoSalida).toBe(3);
  });
});

describe("reporteImportacionFondo · importar-valores-fondo", () => {
  it("una línea del CSV y, después, exactamente el reporte de actualizar-fondo", () => {
    const r = reporteImportacionFondo({ filas: 4, fondosCsv: 1, sinFondo: [], guardado: base });
    expect(r).toEqual({ lineas: ["📄 CSV de valores del fondo · filas: 4 · fondos: 1", ...reporteFondo(base).lineas], codigoSalida: 0 });
  });

  it("un fondo del CSV sin registrar: su línea y FONDO_NO_REGISTRADO, salida 3", () => {
    const r = reporteImportacionFondo({ filas: 6, fondosCsv: 2, sinFondo: [{ linea: 5, codigo: "FONDO_NO_REGISTRADO" }], guardado: base });
    expect(r.lineas.slice(-2)).toEqual([
      "⚠️  1 fondo(s) del CSV sin guardar (no hay un fondo FIC activo con ese código: regístrelo con registrar-fondo):",
      "   · línea 5 · FONDO_NO_REGISTRADO",
    ]);
    expect(r.codigoSalida).toBe(3);
  });

  it("ningún fondo del CSV registrado: sin el SIN_FONDOS de actualizar-fondo (que diría --registrar), salida 3", () => {
    const r = reporteImportacionFondo({ filas: 2, fondosCsv: 1, sinFondo: [{ linea: 2, codigo: "FONDO_NO_REGISTRADO" }], guardado: { fondos: 0, valoresNuevos: 0, valoresRevisados: 0, fallidos: [], ultimos: [] } });
    expect(r.lineas.join("\n")).not.toContain("SIN_FONDOS");
    expect(r.codigoSalida).toBe(3);
  });
});

describe("reporteExportacionFondo · fondo:exportar (a stderr)", () => {
  const exp: ResultadoExportacionFondo = {
    csv: "x", fondos: 2, conValores: 1, filas: 3, descartados: 0, codigoCsv: null,
    fallidos: [{ linea: 3, codigo: "SFC_HTTP_500" }],
    porLinea: [{ linea: 2, valores: 3, ultimaFecha: dia("2024-03-13"), descartados: 0 }],
  };

  it("conteos, el último día de cada fondo por su línea y los que quedaron fuera, salida 3", () => {
    expect(reporteExportacionFondo(exp)).toEqual({
      lineas: [
        "✅ 2 fondo(s) pedidos a la SFC · con valores: 1 · filas en el CSV: 3 · descartados (valor de unidad inválido): 0",
        "   · línea 2 de la lista · valores: 3 · último día: 2024-03-13",
        "⚠️  1 fondo(s) sin valores en el CSV:",
        "   · línea 3 de la lista · SFC_HTTP_500",
      ],
      codigoSalida: 3,
    });
  });

  it("todo bien: salida 0; con descartados, la línea los cuenta y sale 3", () => {
    expect(reporteExportacionFondo({ ...exp, fondos: 1, fallidos: [] }).codigoSalida).toBe(0);
    const r = reporteExportacionFondo({ ...exp, fondos: 1, fallidos: [], descartados: 2, porLinea: [{ linea: 2, valores: 3, ultimaFecha: dia("2024-03-13"), descartados: 2 }] });
    expect(r.lineas[1]).toBe("   · línea 2 de la lista · valores: 3 · último día: 2024-03-13 · descartados: 2 (SFC_VALOR_INVALIDO)");
    expect(r.codigoSalida).toBe(3);
  });

  it("sin CSV: el código y por qué, salida 1", () => {
    const r = reporteExportacionFondo({ ...exp, csv: null, codigoCsv: "SIN_FILAS", conValores: 0, filas: 0, fallidos: [], porLinea: [{ linea: 2, valores: 0, ultimaFecha: null, descartados: 0 }] });
    expect(r.lineas).toContain("   · línea 2 de la lista · valores: 0 · último día: sin valores");
    expect(r.lineas.at(-1)).toBe("❌ SIN_FILAS · no se escribió el CSV (la SFC no trajo valores en el rango).");
    expect(r.codigoSalida).toBe(1);
  });
});


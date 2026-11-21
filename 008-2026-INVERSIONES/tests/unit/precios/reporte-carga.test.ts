// Reportes de `precios:importar` y `precios:exportar`: los mismos conteos y códigos que `precios:actualizar`,
// más los del CSV; solo números de línea, conteos, códigos e ids internos, nunca nemotécnicos ni precios.
// Salen con 3 si hay algo que atender. Datos inventados.
import { describe, expect, it } from "vitest";
import type { ResultadoActualizacion } from "@/precios/guardar";
import { SALIDA_CON_AVISOS, reporteActualizacion, reporteErroresCsv, reporteImportacion } from "@/precios/reporte";

const LIMPIO: ResultadoActualizacion = {
  especies: 2, cierresNuevos: 5, cierresRevisados: 0, cierresReverificados: 1, cierresRetirados: 0, verificados: 1,
  omitidasPorHorario: 0, omitidasNoHabil: 1, omitidasSinNegociacion: 0, omitidasSinCalendario: 0, fallidas: [],
};

describe("reporteImportacion", () => {
  it("una línea del CSV y después exactamente el reporte de precios:actualizar; sin avisos sale 0", () => {
    const r = reporteImportacion({ filas: 7, especiesCsv: 2, sinEspecie: [], guardado: LIMPIO });
    expect(r.lineas).toEqual(["📄 CSV de cierres · filas: 7 · especies: 2", ...reporteActualizacion(LIMPIO).lineas]);
    expect(r.codigoSalida).toBe(0);
  });

  it("especies sin acción activa con lotes: aviso con su primera línea (sin el nemotécnico) y sale 3", () => {
    const r = reporteImportacion({ filas: 3, especiesCsv: 3, sinEspecie: [{ linea: 2, codigo: "ESPECIE_NO_REGISTRADA" }, { linea: 4, codigo: "ESPECIE_NO_REGISTRADA" }], guardado: { ...LIMPIO, especies: 1 } });
    expect(r.lineas.slice(-3)).toEqual([
      "⚠️  2 especie(s) del CSV sin guardar (no hay una acción activa con lotes y ese nemotécnico):",
      "   · línea 2 · ESPECIE_NO_REGISTRADA",
      "   · línea 4 · ESPECIE_NO_REGISTRADA",
    ]);
    expect(r.codigoSalida).toBe(SALIDA_CON_AVISOS);
  });

  it("un fallo del guardado (o SIMBOLO_DISTINTO) sale como en precios:actualizar, con 3", () => {
    const fallidas = [{ instrumentoId: "id-ficticio", codigo: "SIMBOLO_DISTINTO", barrasGuardadas: 0, barrasFallidas: 0 }];
    const r = reporteImportacion({ filas: 1, especiesCsv: 1, sinEspecie: [], guardado: { ...LIMPIO, fallidas } });
    expect(r.lineas).toContain("   · especie id-ficticio · SIMBOLO_DISTINTO · barras guardadas: 0 · fallidas: 0");
    expect(r.codigoSalida).toBe(SALIDA_CON_AVISOS);
  });
});

describe("reporteErroresCsv", () => {
  it("cuántos errores, los listados con línea y código, y cuántos más quedaron sin listar", () => {
    expect(reporteErroresCsv({ errores: [{ linea: 3, codigo: "CIERRE_FORMATO" }, { linea: 9, codigo: "FILA_REPETIDA" }], totalErrores: 25 })).toEqual([
      "❌ CSV_INVALIDO · 25 error(es); no se guardó nada:",
      "   · línea 3 · CIERRE_FORMATO",
      "   · línea 9 · FILA_REPETIDA",
      "   … y 23 más",
    ]);
  });

  it("sin errores de más, sin la línea final", () => {
    expect(reporteErroresCsv({ errores: [{ linea: 1, codigo: "ENCABEZADO" }], totalErrores: 1 })).toEqual(["❌ CSV_INVALIDO · 1 error(es); no se guardó nada:", "   · línea 1 · ENCABEZADO"]);
  });
});

// El reporte de `actualizar-fondo` (antes dentro del script) en src/fondo/reporte.ts: las mismas líneas y la
// misma salida (0 bien · 3 fondo con fallo, dato atrasado o ningún fondo). Solo conteos, códigos, ids internos y
// fechas: nunca el código de negocio, el nombre ni valores. Datos inventados.
import { describe, expect, it } from "vitest";
import type { ResultadoFondo } from "@/fondo/actualizar";
import { reporteFondo } from "@/fondo/reporte";

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

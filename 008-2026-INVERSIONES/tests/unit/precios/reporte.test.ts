// Reporte de `npm run precios:actualizar` (SPEC-13): conteos por razón de omisión y código de salida.
// Nunca imprime precios ni nemotécnicos (el resultado no los trae). Datos inventados.
import { describe, expect, it } from "vitest";
import type { ResultadoActualizacion } from "@/precios/actualizar";
import { reporteActualizacion } from "@/precios/reporte";

const base: ResultadoActualizacion = {
  especies: 2, cierresNuevos: 3, cierresRevisados: 1, cierresRetirados: 4, verificados: 0,
  omitidasPorHorario: 1, omitidasNoHabil: 5, omitidasSinNegociacion: 6, omitidasSinCalendario: 0, fallidas: [],
};

describe("reporteActualizacion", () => {
  it("resume los cambios y cada razón de omisión; sin fallos ni años sin calendario sale con 0", () => {
    expect(reporteActualizacion(base)).toEqual({
      lineas: [
        "✅ 2 especie(s) · cierres nuevos: 3 · revisados: 1 · retirados (día no hábil o sin negociación): 4 · verificados en el rango: 0",
        "   omitidas · aún no definitivas (hora, hoy no hábil o fecha futura): 1 · día no hábil: 5 · sin negociación: 6 · sin calendario: 0",
      ],
      codigoSalida: 0,
    });
  });

  it("si calendario_bvc no cubre un año, avisa y sale con 3 (no se guardó nada de esos días)", () => {
    const r = reporteActualizacion({ ...base, omitidasSinCalendario: 2 });
    expect(r.lineas.at(-1)).toBe("⚠️  2 barra(s) sin guardar porque calendario_bvc no cubre su año: hay que sembrar ese año.");
    expect(r.codigoSalida).toBe(3);
  });

  it("lista las especies con fallo por id, código y detalle, y sale con 3", () => {
    const r = reporteActualizacion({ ...base, fallidas: [{ instrumentoId: "esp-1", codigo: "GUARDADO_ERROR", detalle: "TypeError", barrasGuardadas: 1, barrasFallidas: 2 }, { instrumentoId: "esp-2", codigo: "YAHOO_HTTP_503", barrasGuardadas: 0, barrasFallidas: 0 }] });
    expect(r.lineas.slice(2)).toEqual([
      "⚠️  2 especie(s) con fallo (Yahoo o guardado):",
      "   · especie esp-1 · GUARDADO_ERROR · TypeError · barras guardadas: 1 · fallidas: 2",
      "   · especie esp-2 · YAHOO_HTTP_503 · barras guardadas: 0 · fallidas: 0",
    ]);
    expect(r.codigoSalida).toBe(3);
  });
});

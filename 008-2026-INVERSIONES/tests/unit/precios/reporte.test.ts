// Reportes de `npm run precios:actualizar` y `precios:depurar` (SPEC-13): conteos y código de salida.
// Nunca imprime precios ni nemotécnicos (el resultado no los trae). Datos inventados.
import { describe, expect, it } from "vitest";
import type { ResultadoActualizacion } from "@/precios/actualizar";
import type { ResultadoDepuracion } from "@/precios/depurar";
import { reporteActualizacion, reporteDepuracion } from "@/precios/reporte";

const base: ResultadoActualizacion = {
  especies: 2, cierresNuevos: 3, cierresRevisados: 1, cierresReverificados: 2, cierresRetirados: 4, verificados: 0,
  omitidasPorHorario: 1, omitidasNoHabil: 5, omitidasSinNegociacion: 6, omitidasSinCalendario: 0, fallidas: [],
};

describe("reporteActualizacion", () => {
  it("resume los cambios (también los re-verificados) y cada razón de omisión; sin fallos ni años sin calendario sale con 0", () => {
    expect(reporteActualizacion(base)).toEqual({
      lineas: [
        "✅ 2 especie(s) · cierres nuevos: 3 · revisados: 1 · re-verificados (mismo cierre, cambió la certificación del día): 2 · retirados (día no hábil o sin negociación): 4 · verificados en el rango: 0",
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

describe("reporteDepuracion", () => {
  const ensayo: ResultadoDepuracion = {
    base: "inversiones_x", aplicado: false, especies: 2, vigentesRevisados: 40, aRetirarNoHabil: 3, aRetirarSinNegociacion: 4, retirados: 0, cambiadosPorOtro: 0,
    sinCalendario: 0, aunNoDefinitivos: 0, diagnostico: { barras: 38, sinNegociacionConCierreDistinto: 0, habilesConVolumenNull: 5 }, fallidas: [],
  };

  it("ensayo: conteos, diagnóstico y el siguiente paso; sale con 0", () => {
    expect(reporteDepuracion(ensayo)).toEqual({
      lineas: [
        "Base: inversiones_x · modo: ENSAYO (no escribe) · 2 especie(s) · cierres vigentes de Yahoo revisados: 40",
        "   sobran · día no hábil: 3 · sin negociación: 4 · retirados ahora: 0 · cambiados por otra corrida (no se pisaron): 0",
        "   sin tocar · año sin calendario: 0 · aún no definitivos: 0",
        "   diagnóstico de Yahoo · barras: 38 · volumen 0 con cierre distinto del anterior: 0 · días hábiles con volumen null: 5",
        "Siguiente: con el arreglo desplegado donde corran las cargas, repita con --aplicar --base inversiones_x y después otra vez (debe dar 0 retirados).",
      ],
      codigoSalida: 0,
    });
  });

  it("aplicado: pide repetir para confirmar 0", () => {
    const r = reporteDepuracion({ ...ensayo, aplicado: true, retirados: 7 });
    expect(r.lineas[0]).toContain("modo: APLICAR (retira)");
    expect(r.lineas.at(-1)).toBe("Siguiente: corra el mismo comando otra vez (debe dar 0 retirados).");
    expect(r.codigoSalida).toBe(0);
  });

  it("avisa y sale con 3 si Yahoo falló, falta calendario o el volumen 0 trae otro cierre", () => {
    const r = reporteDepuracion({
      ...ensayo, sinCalendario: 2, diagnostico: { ...ensayo.diagnostico, sinNegociacionConCierreDistinto: 1 },
      fallidas: [{ instrumentoId: "esp-9", codigo: "YAHOO_RED" }, { instrumentoId: "esp-8", codigo: "GUARDADO_ERROR", detalle: "TypeError" }],
    });
    expect(r.lineas).toEqual(expect.arrayContaining([
      "⚠️  2 especie(s) con fallo (si es de Yahoo, solo se tocaron sus días no hábiles; si es GUARDADO_ERROR, nada de esa especie):",
      "   · especie esp-9 · YAHOO_RED",
      "   · especie esp-8 · GUARDADO_ERROR · TypeError",
      "⚠️  2 cierre(s) sin tocar porque calendario_bvc no cubre su año: hay que sembrar ese año.",
      "⚠️  1 barra(s) con volumen 0 y un cierre distinto del anterior: contradicen «volumen 0 = sin negociación». Revíselo antes de --aplicar.",
    ]));
    expect(r.codigoSalida).toBe(3);
  });
});

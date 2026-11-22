// simularOperacion de punta a punta: valida, estima la comisión con la historia, calcula los efectos y las reglas
// afectadas. Errores del usuario como datos; estado mal formado como RangeError. Datos inventados.
import { describe, expect, it } from "vitest";
import { simularOperacion } from "@/operar/simulador/simular";
import type { EstadoSimulado } from "@/operar/simulador/tipos";
import { A, B, CONTEXTO, D, ESTADO, SIN_HISTORIA, comoTexto, congelar, exito, idDe, operacion, posicion, regla } from "./apoyo/estado.ficticio";

const PLAN: EstadoSimulado = {
  ...ESTADO,
  reglas: [
    regla({ id: "monto", condicion: "MONTO_ORDEN_BAJO", nivel: D("461337.41") }),
    regla({ id: "vende-a", instrumentoId: idDe(A), condicion: "CIERRE_SOBRE", nivel: D("4600.13"), accion: "VENDER", cantidad: 41n }),
    regla({ id: "compra-b", instrumentoId: idDe(B), accion: "COMPRAR", cantidad: 37n }),
  ],
};

describe("simularOperacion", () => {
  it("una compra: valor, comisión estimada con su base, caja, pesos y reglas afectadas", () => {
    const s = exito(simularOperacion(PLAN, operacion(A, "COMPRAR", 37n, "4613.2712"), CONTEXTO));
    expect(s.valorOrden.eq(D("170691.0344"))).toBe(true);
    // 170691,0344 / 16 = 10668,18965 → 10668,1897 (mitad hacia arriba)
    expect(s.comision).toEqual({ estado: "ESTIMADA", lado: "COMPRA", valor: D("10668.1897"), ordenesBase: 2 });
    expect(s.cajaAntes.eq(D("37911.47"))).toBe(true);
    expect(s.cajaDespues.eq(D("37911.47").sub(D("170691.0344")).sub(D("10668.1897")))).toBe(true);
    expect(s.avisos.map((a) => a.codigo)).toEqual(["COMPRA_SUPERA_CAJA"]);
    expect(s.reglasAfectadas.map((r) => [r.regla.id, r.afectaciones.map((a) => a.tipo)])).toEqual([
      ["monto", ["MONTO_ORDEN_BAJO"]],
      ["vende-a", ["PRECIO_DEL_LADO_DEL_NIVEL", "OTRA_ACCION"]],
    ]);
    expect(s.especies.map((e) => [e.nemotecnico, e.antes.cantidad, e.despues.cantidad])).toEqual([
      [A, 1237n, 1274n],
      [B, 379n, 379n],
    ]);
  });

  it("una venta usa la tasa de las ventas", () => {
    const s = exito(simularOperacion(PLAN, operacion(B, "VENDER", 41n, "11.37"), CONTEXTO));
    // 466,17 / 32 = 14,5678125 → 14,5678
    expect(s.comision).toEqual({ estado: "ESTIMADA", lado: "VENTA", valor: D("14.5678"), ordenesBase: 1 });
    expect(s.cajaDespues.eq(D("38363.0722"))).toBe(true);
    expect(s.reglasAfectadas.map((r) => r.regla.id)).toEqual(["monto", "compra-b"]);
  });

  it("sin historia: no estima la comisión y la caja se mueve solo por el valor", () => {
    const s = exito(simularOperacion(PLAN, operacion(B, "VENDER", 41n, "11.37"), SIN_HISTORIA));
    expect(s.comision).toEqual({ estado: "SIN_HISTORIA" });
    expect(s.cajaDespues.eq(D("38377.64"))).toBe(true);
  });

  it("los errores del usuario vuelven todos juntos y no calculan nada", () => {
    expect(simularOperacion(PLAN, operacion(B, "VENDER", 380n, "0"), CONTEXTO)).toEqual({
      ok: false,
      errores: [{ codigo: "PRECIO_NO_POSITIVO" }, { codigo: "VENTA_SUPERA_TENENCIA", tiene: 379n, pide: 380n }],
    });
    expect(simularOperacion(PLAN, operacion("FICTICIA-Z", "COMPRAR", 37n, "11.71"), CONTEXTO)).toEqual({ ok: false, errores: [{ codigo: "ESPECIE_DESCONOCIDA" }] });
  });

  it("un estado o un contexto mal formados lanzan RangeError aunque la operación sea válida", () => {
    const op = operacion(A, "COMPRAR", 37n, "11.71");
    expect(() => simularOperacion({ ...PLAN, posiciones: [posicion(A, -3n, "11.71")] }, op, CONTEXTO)).toThrow(RangeError);
    expect(() => simularOperacion(PLAN, op, { ...CONTEXTO, hoy: new Date(Number.NaN) })).toThrow(RangeError);
    expect(() => simularOperacion(PLAN, null as unknown as typeof op, CONTEXTO)).toThrow(RangeError);
  });

  it("es determinista y no cambia sus entradas", () => {
    const estado = congelar({ ...PLAN, posiciones: PLAN.posiciones.map((p) => ({ ...p })), reglas: PLAN.reglas.map((r) => ({ ...r })) });
    const op = congelar(operacion(A, "VENDER", 41n, "4613.27"));
    const contexto = congelar({ ...CONTEXTO, ordenes: [...CONTEXTO.ordenes] });
    const antes = comoTexto([estado, op, contexto]);
    const una = simularOperacion(estado, op, contexto);
    const otra = simularOperacion(estado, op, contexto);
    expect(comoTexto(una)).toBe(comoTexto(otra));
    expect(comoTexto([estado, op, contexto])).toBe(antes);
  });
});

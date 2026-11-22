// Efectos de la orden sobre el portafolio: cantidades, valores al último cierre, pesos (la misma cuenta del
// tablero), caja y avisos. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularEfectos } from "@/operar/simulador/efectos";
import { calcularTablero, type EntradaEspecie } from "@/tablero/calculo";
import type { ComisionEstimada, EstadoSimulado } from "@/operar/simulador/tipos";
import { A, B, C, D, ESTADO, dia, operacion, posicion } from "./apoyo/estado.ficticio";

const SIN: ComisionEstimada = { estado: "SIN_HISTORIA" };
const CON = (valor: string): ComisionEstimada => ({ estado: "ESTIMADA", valor: D(valor), tasa: D("0.0625"), ordenesBase: 2 });
const fila = (e: ReturnType<typeof calcularEfectos>, nemo: string) => e.especies.find((x) => x.nemotecnico === nemo);

describe("cantidades, valores y pesos", () => {
  it("una compra sube la cantidad de la especie, la valora al cierre y mueve los pesos", () => {
    const e = calcularEfectos(ESTADO, operacion(B, "COMPRAR", 41n, "11.37"), D("466.17"), SIN);
    const b = fila(e, B)!;
    expect([b.cantidadAntes, b.cantidadDespues]).toEqual([379n, 420n]);
    expect(b.valorAntes!.eq(D("4438.09"))).toBe(true);
    expect(b.valorDespues!.eq(D("4918.2"))).toBe(true);
    expect(e.valorAccionesAntes.eq(D("5711053.08"))).toBe(true);
    expect(e.valorAccionesDespues.eq(D("5711533.19"))).toBe(true);
    expect(b.pesoAntesPct!.eq(D("4438.09").div(D("5711053.08")).mul(100))).toBe(true);
    expect(b.pesoDespuesPct!.eq(D("4918.2").div(D("5711533.19")).mul(100))).toBe(true);
    expect(fila(e, A)!.cantidadDespues).toBe(1237n);
  });

  it("«antes» cuadra exacto con el peso del tablero", () => {
    const e = calcularEfectos(ESTADO, operacion(A, "VENDER", 37n, "4613.27"), D("170690.99"), SIN);
    const entradas: EntradaEspecie[] = ESTADO.posiciones.map((p) => ({
      instrumentoId: p.instrumentoId, nemotecnico: p.nemotecnico, cantidad: p.cantidad, costoVivo: D("0"),
      cierre: p.cierre === null ? null : { precio: p.cierre, fecha: dia("2027-03-16"), verificado: false },
      realizada: D("0"), dividendos: D("0"), comisiones: D("0"), lotesVivos: 1, serie: [],
    }));
    const tablero = calcularTablero(entradas);
    expect(tablero.valorAcciones.eq(e.valorAccionesAntes)).toBe(true);
    for (const f of tablero.filas) expect(fila(e, f.nemotecnico)!.pesoAntesPct!.eq(f.pesoPct!), f.nemotecnico).toBe(true);
  });

  it("vender todo deja la fila en 0 acciones, valor 0 y peso 0", () => {
    const e = calcularEfectos(ESTADO, operacion(B, "VENDER", 379n, "11.71"), D("4438.09"), SIN);
    const b = fila(e, B)!;
    expect(b.cantidadDespues).toBe(0n);
    expect(b.valorDespues!.isZero() && b.pesoDespuesPct!.isZero()).toBe(true);
  });

  it("vender todo de la única especie: el valor de las acciones queda en 0 y los pesos de después en null", () => {
    const solo: EstadoSimulado = { ...ESTADO, posiciones: [posicion(A, 1237n, "4613.27")] };
    const e = calcularEfectos(solo, operacion(A, "VENDER", 1237n, "4613.27"), D("5706614.99"), SIN);
    expect(e.valorAccionesDespues.isZero()).toBe(true);
    expect(fila(e, A)!.pesoDespuesPct).toBeNull();
    expect(fila(e, A)!.pesoAntesPct!.eq(100)).toBe(true);
  });

  it("comprar una especie que estaba en 0: de peso 0 a su peso; las que siguen en 0 no se listan", () => {
    const e = calcularEfectos(ESTADO, operacion(C, "COMPRAR", 7n, "823.19"), D("5762.33"), SIN);
    const c = fila(e, C)!;
    expect([c.cantidadAntes, c.cantidadDespues]).toEqual([0n, 7n]);
    expect(c.valorAntes!.isZero() && c.pesoAntesPct!.isZero()).toBe(true);
    expect(c.valorDespues!.eq(D("5762.33"))).toBe(true);
    const sinC = calcularEfectos(ESTADO, operacion(A, "COMPRAR", 7n, "4613.27"), D("32292.89"), SIN);
    expect(sinC.especies.map((x) => x.nemotecnico)).toEqual([A, B]);
  });

  it("las filas salen en el orden del estado", () => {
    const e = calcularEfectos(ESTADO, operacion(C, "COMPRAR", 7n, "823.19"), D("5762.33"), SIN);
    expect(e.especies.map((x) => x.nemotecnico)).toEqual([A, B, C]);
  });
});

describe("especies sin cierre", () => {
  const conHueco: EstadoSimulado = { ...ESTADO, posiciones: [posicion(A, 1237n, "4613.27"), posicion(B, 379n, null)] };

  it("una especie sin cierre queda fuera del total y sin peso, con su aviso", () => {
    const e = calcularEfectos(conHueco, operacion(A, "COMPRAR", 3n, "4613.27"), D("13839.81"), SIN);
    expect(fila(e, B)!.valorAntes).toBeNull();
    expect(fila(e, B)!.pesoDespuesPct).toBeNull();
    expect(fila(e, A)!.pesoDespuesPct!.eq(100)).toBe(true);
    expect(e.avisos).toEqual([{ codigo: "ESPECIES_SIN_CIERRE", especies: [{ instrumentoId: "id-ficticia-b", nemotecnico: B }] }]);
  });

  it("la operada sin cierre: su valor de después es null y sale en el aviso", () => {
    const e = calcularEfectos(conHueco, operacion(B, "COMPRAR", 3n, "11.71"), D("35.13"), SIN);
    expect(fila(e, B)!.valorDespues).toBeNull();
    expect(e.avisos.map((a) => a.codigo)).toEqual(["ESPECIES_SIN_CIERRE"]);
  });

  it("todas sin cierre: valor de las acciones 0 y pesos null", () => {
    const vacio: EstadoSimulado = { ...ESTADO, posiciones: [posicion(B, 379n, null)] };
    const e = calcularEfectos(vacio, operacion(B, "VENDER", 3n, "11.71"), D("35.13"), SIN);
    expect(e.valorAccionesAntes.isZero() && e.valorAccionesDespues.isZero()).toBe(true);
    expect([fila(e, B)!.pesoAntesPct, fila(e, B)!.pesoDespuesPct]).toEqual([null, null]);
  });

  it("sin especies sin cierre no hay aviso", () => {
    expect(calcularEfectos(ESTADO, operacion(A, "VENDER", 3n, "4613.27"), D("13839.81"), SIN).avisos).toEqual([]);
  });
});

describe("caja", () => {
  it("compra: caja − valor − comisión; venta: caja + valor − comisión", () => {
    expect(calcularEfectos(ESTADO, operacion(B, "COMPRAR", 41n, "11.37"), D("466.17"), CON("29.1356")).cajaDespues.eq(D("37416.1644"))).toBe(true);
    expect(calcularEfectos(ESTADO, operacion(B, "VENDER", 41n, "11.37"), D("466.17"), CON("14.5678")).cajaDespues.eq(D("38363.0722"))).toBe(true);
  });

  it("sin historia, la caja se mueve solo por el valor de la orden", () => {
    expect(calcularEfectos(ESTADO, operacion(B, "COMPRAR", 41n, "11.37"), D("466.17"), SIN).cajaDespues.eq(D("37445.3"))).toBe(true);
  });

  it("comprar por más de la caja: aviso (no error) con la caja, lo necesario y si incluye la comisión", () => {
    const e = calcularEfectos(ESTADO, operacion(A, "COMPRAR", 9n, "4613.27"), D("41519.43"), CON("2594.9644"));
    expect(e.cajaDespues.eq(D("-6202.9244"))).toBe(true);
    expect(e.avisos).toHaveLength(1);
    const aviso = e.avisos[0]!;
    expect(aviso.codigo === "COMPRA_SUPERA_CAJA" && aviso.caja.eq(D("37911.47")) && aviso.necesario.eq(D("44114.3944")) && aviso.conComision).toBe(true);
    const sin = calcularEfectos(ESTADO, operacion(A, "COMPRAR", 9n, "4613.27"), D("41519.43"), SIN).avisos[0]!;
    expect(sin.codigo === "COMPRA_SUPERA_CAJA" && sin.necesario.eq(D("41519.43")) && !sin.conComision).toBe(true);
  });

  it("la comisión sola puede pasar la caja: también avisa", () => {
    const e = calcularEfectos(ESTADO, operacion(A, "COMPRAR", 1n, "37900.13"), D("37900.13"), CON("11.37"));
    expect(e.avisos.map((a) => a.codigo)).toEqual(["COMPRA_SUPERA_CAJA"]);
  });

  it("lo necesario igual a la caja no avisa; con caja 0 o negativa sí; la venta nunca", () => {
    expect(calcularEfectos(ESTADO, operacion(A, "COMPRAR", 1n, "37900.1"), D("37900.1"), CON("11.37")).avisos).toEqual([]);
    expect(calcularEfectos({ ...ESTADO, caja: D("0") }, operacion(B, "COMPRAR", 1n, "11.71"), D("11.71"), SIN).avisos.map((a) => a.codigo)).toEqual(["COMPRA_SUPERA_CAJA"]);
    const negativa = calcularEfectos({ ...ESTADO, caja: D("-41.37") }, operacion(B, "VENDER", 1n, "11.71"), D("11.71"), SIN);
    expect(negativa.avisos).toEqual([]);
    expect(negativa.cajaDespues.eq(D("-29.66"))).toBe(true);
  });

  it("no cambia el estado de entrada", () => {
    const caja = new Prisma.Decimal("37911.47");
    const estado: EstadoSimulado = { ...ESTADO, caja };
    calcularEfectos(estado, operacion(B, "COMPRAR", 41n, "11.37"), D("466.17"), CON("29.1356"));
    expect(estado.caja.eq(D("37911.47")) && estado.posiciones[1]!.cantidad === 379n).toBe(true);
  });
});

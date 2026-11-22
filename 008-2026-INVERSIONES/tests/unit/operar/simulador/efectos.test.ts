// Efectos de la orden sobre el portafolio: cantidades, valoración al último cierre (o «sin cierre»), pesos (la misma
// cuenta del tablero), caja y avisos. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calcularEfectos } from "@/operar/simulador/efectos";
import { calcularTablero, type EntradaEspecie } from "@/tablero/calculo";
import type { ComisionEstimada, EstadoSimulado, PosicionSimulada } from "@/operar/simulador/tipos";
import { A, B, C, D, ESTADO, dia, operacion, peso, posicion, valor } from "./apoyo/estado.ficticio";

const SIN: ComisionEstimada = { estado: "SIN_HISTORIA" };
const CON = (v: string): ComisionEstimada => ({ estado: "ESTIMADA", lado: "COMPRA", valor: D(v), ordenesBase: 2 });
const fila = (e: ReturnType<typeof calcularEfectos>, nemo: string) => e.especies.find((x) => x.nemotecnico === nemo)!;

describe("cantidades, valores y pesos", () => {
  it("una compra sube la cantidad de la especie, la valora al cierre y mueve los pesos", () => {
    const e = calcularEfectos(ESTADO, operacion(B, "COMPRAR", 41n, "11.37"), D("466.17"), SIN);
    const b = fila(e, B);
    expect([b.antes.cantidad, b.despues.cantidad]).toEqual([379n, 420n]);
    expect(valor(b.antes)!.eq(D("4438.09"))).toBe(true);
    expect(valor(b.despues)!.eq(D("4918.2"))).toBe(true);
    expect(e.valorAccionesAntes.eq(D("5711053.08"))).toBe(true);
    expect(e.valorAccionesDespues.eq(D("5711533.19"))).toBe(true);
    expect(peso(b.antes)!.eq(D("4438.09").div(D("5711053.08")).mul(100))).toBe(true);
    expect(peso(b.despues)!.eq(D("4918.2").div(D("5711533.19")).mul(100))).toBe(true);
    expect(fila(e, A).despues.cantidad).toBe(1237n);
  });

  it("las filas del tablero (vivas y cerradas) entran tal cual como posiciones, y «antes» cuadra exacto con su peso", () => {
    const entradas: EntradaEspecie[] = ESTADO.posiciones.map((p) => ({
      instrumentoId: p.instrumentoId, nemotecnico: p.nemotecnico, cantidad: p.cantidad, costoVivo: D("0"),
      cierre: p.cierre === null ? null : { precio: p.cierre.precio, fecha: dia("2027-03-16"), verificado: false },
      realizada: D("0"), dividendos: D("0"), comisiones: D("0"), lotesVivos: 1, serie: [],
    }));
    const tablero = calcularTablero(entradas);
    const posiciones: readonly PosicionSimulada[] = [...tablero.filas, ...tablero.cerradas];
    const e = calcularEfectos({ ...ESTADO, posiciones }, operacion(A, "VENDER", 37n, "4613.27"), D("170690.99"), SIN);
    expect(tablero.valorAcciones.eq(e.valorAccionesAntes)).toBe(true);
    for (const f of tablero.filas) expect(peso(fila(e, f.nemotecnico).antes)!.eq(f.pesoPct!), f.nemotecnico).toBe(true);
  });

  it("vender todo deja la fila en 0 acciones, valorada en 0 y con peso 0", () => {
    const b = fila(calcularEfectos(ESTADO, operacion(B, "VENDER", 379n, "11.71"), D("4438.09"), SIN), B);
    expect(b.despues).toEqual({ cantidad: 0n, valoracion: { estado: "VALORADA", valor: D("0"), pesoPct: D("0") } });
  });

  it("vender todo de la única especie: el valor de las acciones queda en 0 y no hay peso después", () => {
    const solo: EstadoSimulado = { ...ESTADO, posiciones: [posicion(A, 1237n, "4613.27")] };
    const e = calcularEfectos(solo, operacion(A, "VENDER", 1237n, "4613.27"), D("5706614.99"), SIN);
    expect(e.valorAccionesDespues.isZero()).toBe(true);
    expect(fila(e, A).despues.valoracion).toEqual({ estado: "VALORADA", valor: D("0"), pesoPct: null });
    expect(peso(fila(e, A).antes)!.eq(100)).toBe(true);
  });

  it("comprar una especie que estaba en 0: de peso 0 a su peso; las que siguen en 0 no se listan", () => {
    const e = calcularEfectos(ESTADO, operacion(C, "COMPRAR", 7n, "823.19"), D("5762.33"), SIN);
    const c = fila(e, C);
    expect([c.antes.cantidad, c.despues.cantidad]).toEqual([0n, 7n]);
    expect(c.antes.valoracion).toEqual({ estado: "VALORADA", valor: D("0"), pesoPct: D("0") });
    expect(valor(c.despues)!.eq(D("5762.33"))).toBe(true);
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

  it("una especie sin cierre dice SIN_CIERRE (no un peso suelto), queda fuera del total y sale en el aviso", () => {
    const e = calcularEfectos(conHueco, operacion(A, "COMPRAR", 3n, "4613.27"), D("13839.81"), SIN);
    expect(fila(e, B).antes.valoracion).toEqual({ estado: "SIN_CIERRE" });
    expect(fila(e, B).despues.valoracion).toEqual({ estado: "SIN_CIERRE" });
    expect(peso(fila(e, A).despues)!.eq(100)).toBe(true);
    expect(e.avisos).toEqual([{ codigo: "ESPECIES_SIN_CIERRE", especies: [{ instrumentoId: "id-ficticia-b", nemotecnico: B }] }]);
  });

  it("la operada sin cierre: SIN_CIERRE después y sale en el aviso", () => {
    const e = calcularEfectos(conHueco, operacion(B, "COMPRAR", 3n, "11.71"), D("35.13"), SIN);
    expect(fila(e, B).despues.valoracion).toEqual({ estado: "SIN_CIERRE" });
    expect(e.avisos.map((a) => a.codigo)).toEqual(["ESPECIES_SIN_CIERRE"]);
  });

  it("vender todo de una sin cierre: después vale 0 (no tiene acciones), y el aviso sigue por el antes", () => {
    const e = calcularEfectos(conHueco, operacion(B, "VENDER", 379n, "11.71"), D("4438.09"), SIN);
    expect(fila(e, B).despues.valoracion).toEqual({ estado: "VALORADA", valor: D("0"), pesoPct: D("0") });
    expect(e.avisos.map((a) => a.codigo)).toEqual(["ESPECIES_SIN_CIERRE"]);
  });

  it("todas sin cierre: valor de las acciones 0 y ningún peso", () => {
    const vacio: EstadoSimulado = { ...ESTADO, posiciones: [posicion(B, 379n, null)] };
    const e = calcularEfectos(vacio, operacion(B, "VENDER", 3n, "11.71"), D("35.13"), SIN);
    expect(e.valorAccionesAntes.isZero() && e.valorAccionesDespues.isZero()).toBe(true);
    expect([peso(fila(e, B).antes), peso(fila(e, B).despues)]).toEqual([null, null]);
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

  it("exacta cerca del tope: sin redondeo de las 20 cifras", () => {
    const e = calcularEfectos({ ...ESTADO, caja: D("-9999999999999.999999") }, operacion(B, "VENDER", 1n, "9999999999999.999998"), D("9999999999999.999998"), CON("9999999999999.9999"));
    expect(e.cajaDespues.toFixed()).toBe("-9999999999999.999901");
  });

  it("comprar por más de la caja: aviso (no error) con la caja, lo necesario y si incluye la comisión", () => {
    const e = calcularEfectos(ESTADO, operacion(A, "COMPRAR", 9n, "4613.27"), D("41519.43"), CON("2594.9644"));
    expect(e.cajaDespues.eq(D("-6202.9244"))).toBe(true);
    expect(e.avisos).toEqual([{ codigo: "COMPRA_SUPERA_CAJA", caja: D("37911.47"), necesario: D("44114.3944"), conComision: true }]);
    const sin = calcularEfectos(ESTADO, operacion(A, "COMPRAR", 9n, "4613.27"), D("41519.43"), SIN).avisos;
    expect(sin).toEqual([{ codigo: "COMPRA_SUPERA_CAJA", caja: D("37911.47"), necesario: D("41519.43"), conComision: false }]);
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

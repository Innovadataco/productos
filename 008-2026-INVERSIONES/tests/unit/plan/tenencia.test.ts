// Tenencia de una especie a una fecha, por fecha de operación (fase B, corte 3). Datos inventados.
import { describe, expect, it } from "vitest";
import { constanteEn, positivaEn, tenenciaEn, type MovimientoTenencia } from "@/plan/tenencia";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const mov = (iso: string, cantidad: bigint): MovimientoTenencia => ({ fecha: dia(iso), cantidad });

// Desordenados a propósito: el cálculo no depende del orden en que llegan.
const COMPRA_Y_VENTA = [mov("2031-01-05", -20n), mov("2031-01-01", 100n)];

describe("tenencia a una fecha", () => {
  it("suma compras y lotes y resta ventas con fecha de operación hasta ese día (el del mismo día cuenta)", () => {
    expect(tenenciaEn(COMPRA_Y_VENTA, dia("2030-12-31"))).toBe(0n);
    expect(tenenciaEn(COMPRA_Y_VENTA, dia("2031-01-01"))).toBe(100n);
    expect(tenenciaEn(COMPRA_Y_VENTA, dia("2031-01-04"))).toBe(100n);
    expect(tenenciaEn(COMPRA_Y_VENTA, dia("2031-01-05"))).toBe(80n);
  });

  it("sin movimientos es cero", () => {
    expect(tenenciaEn([], dia("2031-01-05"))).toBe(0n);
  });
});

describe("tenencia positiva en todo un rango (incluidas las dos puntas)", () => {
  it("es verdad si nunca llega a cero entre las dos fechas", () => {
    expect(positivaEn(COMPRA_Y_VENTA, dia("2031-01-01"), dia("2031-03-01"))).toBe(true);
  });

  it("es falso si al empezar todavía no había acciones", () => {
    expect(positivaEn(COMPRA_Y_VENTA, dia("2030-12-31"), dia("2031-01-03"))).toBe(false);
  });

  it("es falso si se vendió todo dentro del rango, aunque al empezar sí hubiera", () => {
    const vendioTodo = [...COMPRA_Y_VENTA, mov("2031-01-10", -80n)];
    expect(positivaEn(vendioTodo, dia("2031-01-02"), dia("2031-02-01"))).toBe(false);
    expect(positivaEn(vendioTodo, dia("2031-01-02"), dia("2031-01-09"))).toBe(true);
  });

  it("una tenencia negativa (ventas sin compras cargadas) no cuenta como positiva", () => {
    expect(positivaEn([mov("2031-01-01", -10n)], dia("2031-01-01"), dia("2031-01-02"))).toBe(false);
  });
});

describe("tenencia constante en un rango", () => {
  it("es constante si no cambia en (desde, hasta]: un movimiento justo en «desde» ya está adentro", () => {
    expect(constanteEn(COMPRA_Y_VENTA, dia("2031-01-01"), dia("2031-01-04"))).toBe(true);
    expect(constanteEn(COMPRA_Y_VENTA, dia("2031-01-05"), dia("2031-01-20"))).toBe(true);
  });

  it("no es constante si hay una compra o una venta dentro", () => {
    expect(constanteEn(COMPRA_Y_VENTA, dia("2031-01-04"), dia("2031-01-05"))).toBe(false);
    expect(constanteEn(COMPRA_Y_VENTA, dia("2030-12-31"), dia("2031-01-02"))).toBe(false);
  });

  it("una compra y una venta del mismo día que se anulan no la cambian", () => {
    const anuladas = [...COMPRA_Y_VENTA, mov("2031-01-12", 30n), mov("2031-01-12", -30n)];
    expect(constanteEn(anuladas, dia("2031-01-06"), dia("2031-01-20"))).toBe(true);
  });
});

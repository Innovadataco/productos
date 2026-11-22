// Comisión estimada con la historia del dueño: suma de comisiones sobre suma de valores de las órdenes aprobadas del
// mismo lado, con el número de órdenes en que se basa y el lado. Sin órdenes no se inventa una tarifa. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { estimarComision, tasaComisionHistorica } from "@/operar/simulador/comision";
import { CONTEXTO, D, orden } from "./apoyo/estado.ficticio";

describe("tasaComisionHistorica", () => {
  it("suma las comisiones y los valores de las órdenes aprobadas del lado pedido, y dice el lado", () => {
    const t = tasaComisionHistorica(CONTEXTO.ordenes, "COMPRA");
    expect(t).toEqual({ estado: "ESTIMABLE", lado: "COMPRA", sumaComisiones: D("365.67"), sumaValor: D("5850.72"), ordenesBase: 2 });
    expect(tasaComisionHistorica(CONTEXTO.ordenes, "VENTA")).toEqual({ estado: "ESTIMABLE", lado: "VENTA", sumaComisiones: D("84.72"), sumaValor: D("2711.04"), ordenesBase: 1 });
  });

  it("sin órdenes, o solo del otro lado, canceladas o con valor 0: sin historia", () => {
    expect(tasaComisionHistorica([], "COMPRA")).toEqual({ estado: "SIN_HISTORIA" });
    expect(tasaComisionHistorica([orden("VENTA", "2711.04", "84.72")], "COMPRA")).toEqual({ estado: "SIN_HISTORIA" });
    expect(tasaComisionHistorica([orden("COMPRA", "2711.04", "84.72", "CANCELADO")], "COMPRA")).toEqual({ estado: "SIN_HISTORIA" });
    expect(tasaComisionHistorica([orden("COMPRA", "0", "8.47")], "COMPRA")).toEqual({ estado: "SIN_HISTORIA" });
  });

  it("ordenesBase cuenta solo las que entran en la cuenta", () => {
    const t = tasaComisionHistorica(
      [orden("COMPRA", "1237.6", "77.35"), orden("COMPRA", "0", "3.71"), orden("COMPRA", "4613.12", "288.32", "CANCELADO"), orden("VENTA", "41.37", "1.13")],
      "COMPRA",
    );
    expect(t.estado === "ESTIMABLE" && t.ordenesBase).toBe(1);
  });

  it("una historia sin comisiones se puede estimar (en 0: es lo que dice la historia)", () => {
    const t = tasaComisionHistorica([orden("VENTA", "2711.04", "0")], "VENTA");
    expect(t.estado === "ESTIMABLE" && t.sumaComisiones.isZero()).toBe(true);
  });

  it("rechaza órdenes mal formadas (RangeError)", () => {
    expect(() => tasaComisionHistorica([orden("COMPRA", "-1237.6", "7.35")], "COMPRA")).toThrow(RangeError);
  });
});

describe("estimarComision", () => {
  const compras = () => tasaComisionHistorica(CONTEXTO.ordenes, "COMPRA");

  it("valor × comisiones / valores, redondeado a 4 decimales mitad hacia arriba (no al par), con su base y su lado", () => {
    // 4613,2712 / 16 = 288,32945 exacto: mitad hacia arriba da …295; al par daría …294.
    expect(estimarComision(D("4613.2712"), compras())).toEqual({ estado: "ESTIMADA", lado: "COMPRA", valor: D("288.3295"), ordenesBase: 2 });
    expect(D("288.32945").toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_EVEN).eq(D("288.3294"))).toBe(true);
  });

  it("sin historia: no estima", () => {
    expect(estimarComision(D("4613.2712"), { estado: "SIN_HISTORIA" })).toEqual({ estado: "SIN_HISTORIA" });
  });

  it("historia sin comisiones: comisión estimada en 0, con su base", () => {
    const c = estimarComision(D("4613.2712"), tasaComisionHistorica([orden("VENTA", "2711.04", "0")], "VENTA"));
    expect(c.estado === "ESTIMADA" && c.valor.isZero() && c.ordenesBase === 1 && c.lado === "VENTA").toBe(true);
  });
});

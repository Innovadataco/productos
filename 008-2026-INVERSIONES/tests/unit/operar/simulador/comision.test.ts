// Comisión estimada con la historia del dueño: Σ comisión / Σ valor de las órdenes aprobadas del mismo lado, con el
// número de órdenes en que se basa. Sin órdenes no se inventa una tarifa. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { estimarComision, tasaComisionHistorica } from "@/operar/simulador/comision";
import { CONTEXTO, D, orden } from "./apoyo/estado.ficticio";

describe("tasaComisionHistorica", () => {
  it("suma las comisiones y los valores de las órdenes aprobadas del lado pedido", () => {
    const t = tasaComisionHistorica(CONTEXTO.ordenes, "COMPRA");
    expect(t.estado).toBe("ESTIMABLE");
    if (t.estado !== "ESTIMABLE") return;
    expect(t.ordenesBase).toBe(2);
    expect(t.sumaComisiones.eq(D("365.67"))).toBe(true);
    expect(t.sumaValor.eq(D("5850.72"))).toBe(true);
    expect(t.tasa.eq(D("0.0625"))).toBe(true);
    const v = tasaComisionHistorica(CONTEXTO.ordenes, "VENTA");
    expect(v.estado === "ESTIMABLE" && v.tasa.eq(D("0.03125")) && v.ordenesBase === 1).toBe(true);
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

  it("una historia sin comisiones da tasa 0 (es lo que dice la historia)", () => {
    const t = tasaComisionHistorica([orden("VENTA", "2711.04", "0")], "VENTA");
    expect(t.estado === "ESTIMABLE" && t.tasa.isZero()).toBe(true);
  });

  it("rechaza órdenes mal formadas (RangeError)", () => {
    expect(() => tasaComisionHistorica([orden("COMPRA", "-1237.6", "7.35")], "COMPRA")).toThrow(RangeError);
  });
});

describe("estimarComision", () => {
  const compras = () => tasaComisionHistorica(CONTEXTO.ordenes, "COMPRA");

  it("valor × Σ comisión / Σ valor, redondeado a 4 decimales mitad hacia arriba (no al par)", () => {
    // 4613,2712 / 16 = 288,32945 exacto: mitad hacia arriba da …295; al par daría …294.
    const c = estimarComision(D("4613.2712"), compras());
    expect(c).toEqual({ estado: "ESTIMADA", valor: D("288.3295"), tasa: D("0.0625"), ordenesBase: 2 });
    expect(D("288.32945").toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_EVEN).eq(D("288.3294"))).toBe(true);
  });

  it("sin historia: no estima", () => {
    expect(estimarComision(D("4613.2712"), { estado: "SIN_HISTORIA" })).toEqual({ estado: "SIN_HISTORIA" });
  });

  it("tasa 0: comisión estimada en 0, con su base", () => {
    const c = estimarComision(D("4613.2712"), tasaComisionHistorica([orden("VENTA", "2711.04", "0")], "VENTA"));
    expect(c.estado === "ESTIMADA" && c.valor.isZero() && c.ordenesBase === 1).toBe(true);
  });
});

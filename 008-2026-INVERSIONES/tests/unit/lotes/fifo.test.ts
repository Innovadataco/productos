import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { asignarFifo, costoProporcional, type LoteFifo } from "@/lotes/fifo";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const lote = (id: string, fecha: string, cantidad: bigint, costo: string): LoteFifo => ({ id, fechaCompra: d(fecha), cantidad, costoTotal: new Prisma.Decimal(costo) });
const resumen = (r: ReturnType<typeof asignarFifo>) => (r.ok ? r.asignaciones.map((a) => [a.ventaId, a.loteId, a.cantidad, a.costoBase.toString()]) : r);

describe("asignarFifo", () => {
  const lotes = [lote("b", "2024-03-01", 50n, "6150"), lote("a", "2024-01-10", 100n, "10370")];

  it("consume primero el lote más antiguo, aunque venga después en la lista", () => {
    expect(resumen(asignarFifo(lotes, [{ id: "v1", fecha: d("2024-04-01"), cantidad: 30n }]))).toEqual([["v1", "a", 30n, "3111"]]);
  });

  it("una venta que agota un lote pasa al siguiente, con costo proporcional", () => {
    expect(resumen(asignarFifo(lotes, [{ id: "v1", fecha: d("2024-04-01"), cantidad: 120n }]))).toEqual([
      ["v1", "a", 100n, "10370"],
      ["v1", "b", 20n, "2460"],
    ]);
  });

  it("varias ventas en orden cronológico y vender todo deja la posición en cero", () => {
    const r = asignarFifo(lotes, [
      { id: "v2", fecha: d("2024-05-01"), cantidad: 90n },
      { id: "v1", fecha: d("2024-04-01"), cantidad: 60n },
    ]);
    expect(resumen(r)).toEqual([["v1", "a", 60n, "6222"], ["v2", "a", 40n, "4148"], ["v2", "b", 50n, "6150"]]);
  });

  it("una venta no consume lotes comprados después de ella", () => {
    expect(asignarFifo(lotes, [{ id: "v1", fecha: d("2024-02-01"), cantidad: 120n }])).toEqual({ ok: false, codigo: "VENTA_SIN_LOTES", ventaId: "v1" });
  });

  it("vender más de lo que hay es un error, no una posición negativa", () => {
    expect(asignarFifo(lotes, [{ id: "v1", fecha: d("2024-06-01"), cantidad: 151n }])).toMatchObject({ ok: false, codigo: "VENTA_SIN_LOTES" });
  });

  it("respeta primero las asignaciones bloqueadas (fijadas según el portal)", () => {
    const bloqueada = { ventaId: "v1", loteId: "b", cantidad: 50n, costoBase: new Prisma.Decimal("6150") };
    const r = asignarFifo(lotes, [{ id: "v1", fecha: d("2024-04-01"), cantidad: 70n }], [bloqueada]);
    expect(resumen(r)).toEqual([["v1", "a", 20n, "2074"]]);
  });

  it("el costo proporcional redondea a 4 decimales (medio al par)", () => {
    expect(costoProporcional(lote("x", "2024-01-01", 3n, "100"), 1n).toString()).toBe("33.3333");
    expect(costoProporcional(lote("x", "2024-01-01", 8n, "0.0001"), 4n).toString()).toBe("0");
  });
});

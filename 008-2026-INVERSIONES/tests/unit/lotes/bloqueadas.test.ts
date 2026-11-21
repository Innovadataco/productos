// Asignaciones bloqueadas (fijadas a mano por el dueño) en el FIFO puro: una bloqueada inválida rechaza la
// especie con un código claro y nunca deja un lote ni una venta sobre-asignados. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { asignarFifo, type Asignacion, type LoteFifo, type VentaFifo } from "@/lotes/fifo";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const lote = (id: string, fecha: string, cantidad: bigint, costo: string): LoteFifo => ({ id, fechaCompra: d(fecha), cantidad, costoTotal: new Prisma.Decimal(costo) });
const venta = (id: string, fecha: string, cantidad: bigint): VentaFifo => ({ id, fecha: d(fecha), cantidad });
const fija = (ventaId: string, loteId: string, cantidad: bigint, costo: string): Asignacion => ({ ventaId, loteId, cantidad, costoBase: new Prisma.Decimal(costo) });
const pares = (r: ReturnType<typeof asignarFifo>) => (r.ok ? r.asignaciones.map((a) => [a.ventaId, a.loteId, a.cantidad, a.costoBase.toString()]) : r);

describe("asignarFifo · bloqueada parcial (D5)", () => {
  it("nunca devuelve un par venta-lote que ya tiene bloqueada: completa la venta desde OTRO lote", () => {
    const r = asignarFifo([lote("a", "2024-01-10", 100n, "1000"), lote("b", "2024-02-10", 100n, "1200")], [venta("v1", "2024-03-01", 60n)], [fija("v1", "a", 20n, "200")]);
    expect(pares(r)).toEqual([["v1", "b", 40n, "480"]]);
  });

  it("si solo queda el mismo lote, rechaza con BLOQUEADA_INCOMPLETA (no duplica el par)", () => {
    const r = asignarFifo([lote("a", "2024-01-10", 100n, "1000")], [venta("v1", "2024-03-01", 60n)], [fija("v1", "a", 20n, "200")]);
    expect(r).toMatchObject({ ok: false, codigo: "BLOQUEADA_INCOMPLETA", ventaId: "v1" });
  });

  it("otras ventas sí siguen consumiendo el lote de la bloqueada", () => {
    const r = asignarFifo(
      [lote("a", "2024-01-10", 100n, "1000"), lote("b", "2024-02-10", 100n, "1200")],
      [venta("v1", "2024-03-01", 60n), venta("v2", "2024-04-01", 30n)],
      [fija("v1", "a", 20n, "200")],
    );
    expect(pares(r)).toEqual([["v1", "b", 40n, "480"], ["v2", "a", 30n, "300"]]);
  });
});

describe("asignarFifo · bloqueadas inválidas (D2, D3, D4, D6)", () => {
  const a = lote("a", "2024-01-10", 100n, "1000");

  it("D2: una bloqueada mayor que el lote (150 sobre 100) se rechaza", () => {
    expect(asignarFifo([a], [venta("v1", "2024-03-01", 150n)], [fija("v1", "a", 150n, "1500")])).toMatchObject({ ok: false, codigo: "BLOQUEADA_EXCEDE_LOTE", loteId: "a" });
  });

  it("D2: dos bloqueadas que juntas pasan el lote (80 + 80 sobre 100) se rechazan", () => {
    const r = asignarFifo([a], [venta("v1", "2024-03-01", 80n), venta("v2", "2024-03-02", 80n)], [fija("v1", "a", 80n, "800"), fija("v2", "a", 80n, "800")]);
    expect(r).toMatchObject({ ok: false, codigo: "BLOQUEADA_EXCEDE_LOTE", loteId: "a" });
  });

  it("D3: una bloqueada mayor que la venta (80 sobre 30) se rechaza", () => {
    expect(asignarFifo([a], [venta("v1", "2024-03-01", 30n)], [fija("v1", "a", 80n, "800")])).toMatchObject({ ok: false, codigo: "BLOQUEADA_EXCEDE_VENTA", ventaId: "v1" });
  });

  it("D4: una bloqueada en un lote comprado DESPUÉS de la venta se rechaza", () => {
    const r = asignarFifo([a, lote("b", "2024-05-01", 50n, "600")], [venta("v1", "2024-03-01", 10n)], [fija("v1", "b", 10n, "120")]);
    expect(r).toMatchObject({ ok: false, codigo: "BLOQUEADA_LOTE_POSTERIOR", ventaId: "v1", loteId: "b" });
  });

  it("D4: el mismo día sí vale (igual que el FIFO)", () => {
    expect(asignarFifo([a], [venta("v1", "2024-01-10", 10n)], [fija("v1", "a", 10n, "100")])).toEqual({ ok: true, asignaciones: [] });
  });

  it("D6: una bloqueada de una venta que no está en la lista no consume el lote: se rechaza", () => {
    const r = asignarFifo([a], [venta("v1", "2024-03-01", 50n)], [fija("ajena", "a", 50n, "500")]);
    expect(r).toMatchObject({ ok: false, codigo: "BLOQUEADA_VENTA_AJENA", ventaId: "ajena", loteId: "a" });
  });

  it("D6: una bloqueada sobre un lote que no es de la especie se rechaza", () => {
    expect(asignarFifo([a], [venta("v1", "2024-03-01", 10n)], [fija("v1", "otro", 10n, "100")])).toMatchObject({ ok: false, codigo: "BLOQUEADA_LOTE_AJENO", loteId: "otro" });
  });
});

describe("asignarFifo · costo de las bloqueadas", () => {
  it("el costo bloqueado de un lote no puede pasar su costo total (costo vivo negativo)", () => {
    const r = asignarFifo([lote("a", "2024-01-10", 100n, "1000")], [venta("v1", "2024-03-01", 50n)], [fija("v1", "a", 50n, "1500")]);
    expect(r).toMatchObject({ ok: false, codigo: "BLOQUEADA_EXCEDE_COSTO", loteId: "a" });
  });

  it("si el residual del lote saldría negativo, rechaza con COSTO_NEGATIVO (la base lo rechazaría y abortaría todo)", () => {
    const r = asignarFifo(
      [lote("a", "2024-01-10", 100n, "1000")],
      [venta("v1", "2024-03-01", 50n), venta("v2", "2024-03-02", 30n), venta("v3", "2024-03-03", 20n)],
      [fija("v1", "a", 50n, "900")],
    );
    expect(r).toMatchObject({ ok: false, codigo: "COSTO_NEGATIVO", loteId: "a" });
  });

  it("COSTO_NEGATIVO también sin residual: la suma de costo de un lote que no se agota pasa su costo total", () => {
    const r = asignarFifo(
      [lote("a", "2024-01-10", 100n, "1000")],
      [venta("v1", "2024-03-01", 50n), venta("v2", "2024-03-02", 30n)],
      [fija("v1", "a", 50n, "900")],
    );
    expect(r).toMatchObject({ ok: false, codigo: "COSTO_NEGATIVO", loteId: "a" });
  });
});

describe("asignarFifo · COSTO_NEGATIVO determinista", () => {
  it("con dos lotes excedidos informa siempre el más antiguo, venga en el orden que venga", () => {
    const [a, b] = [lote("a", "2024-01-10", 100n, "1000"), lote("b", "2024-02-10", 100n, "1000")];
    const ventas = [venta("v1", "2024-03-01", 80n), venta("v2", "2024-03-01", 50n), venta("v3", "2024-03-02", 30n)];
    const fijas = [fija("v1", "a", 50n, "900"), fija("v2", "b", 50n, "900")];
    expect(asignarFifo([a, b], ventas, fijas)).toMatchObject({ ok: false, codigo: "COSTO_NEGATIVO", loteId: "a" });
    expect(asignarFifo([b, a], ventas, fijas)).toMatchObject({ ok: false, codigo: "COSTO_NEGATIVO", loteId: "a" });
  });
});

describe("asignarFifo · lote agotado por bloqueadas (regla 7, ±1 COP)", () => {
  const a = lote("a", "2024-01-10", 100n, "1000");
  const ventas = [venta("v1", "2024-03-01", 60n), venta("v2", "2024-03-02", 40n)];

  it("si el costo no suma el del lote por más de 1 COP, rechaza con BLOQUEADA_COSTO_DESCUADRADO", () => {
    const r = asignarFifo([a], ventas, [fija("v1", "a", 60n, "600"), fija("v2", "a", 40n, "398.9999")]);
    expect(r).toMatchObject({ ok: false, codigo: "BLOQUEADA_COSTO_DESCUADRADO", loteId: "a" });
    expect(asignarFifo([a], ventas, [fija("v1", "a", 60n, "601.0001"), fija("v2", "a", 40n, "400")])).toMatchObject({ codigo: "BLOQUEADA_COSTO_DESCUADRADO" });
  });

  it("hasta 1 COP de diferencia se acepta (redondeo a 4 decimales del portal)", () => {
    expect(asignarFifo([a], ventas, [fija("v1", "a", 60n, "600"), fija("v2", "a", 40n, "399")])).toEqual({ ok: true, asignaciones: [] });
    expect(asignarFifo([a], ventas, [fija("v1", "a", 60n, "601"), fija("v2", "a", 40n, "400")])).toEqual({ ok: true, asignaciones: [] });
    const tres = lote("t", "2024-01-01", 3n, "100");
    const vs = [1, 2, 3].map((i) => venta(`v${i}`, `2024-02-0${i}`, 1n));
    expect(asignarFifo([tres], vs, vs.map((v) => fija(v.id, "t", 1n, "33.3333")))).toEqual({ ok: true, asignaciones: [] });
  });
});

// Regla de coherencia compartida por el FIFO y por posiciones: orden determinista de los códigos, sumas por
// venta y por lote, y la tolerancia de ±1 COP de un lote agotado. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { primerRechazo, TOLERANCIA_COSTO, ventasSinCuadrar } from "@/lotes/coherencia";
import type { Asignacion, LoteFifo, VentaFifo } from "@/lotes/tipos";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const lote = (id: string, fecha: string, cantidad: bigint, costo: string): LoteFifo => ({ id, fechaCompra: d(fecha), cantidad, costoTotal: new Prisma.Decimal(costo) });
const venta = (id: string, fecha: string, cantidad: bigint): VentaFifo => ({ id, fecha: d(fecha), cantidad });
const fila = (ventaId: string, loteId: string, cantidad: bigint, costo: string): Asignacion => ({ ventaId, loteId, cantidad, costoBase: new Prisma.Decimal(costo) });

describe("primerRechazo", () => {
  const lotes = [lote("a", "2024-01-10", 100n, "1000"), lote("b", "2024-05-01", 50n, "600")];
  const ventas = [venta("v1", "2024-03-01", 30n), venta("v2", "2024-06-01", 10n)];

  it("sin asignaciones, o con asignaciones que cuadran, no hay rechazo", () => {
    expect(primerRechazo(lotes, ventas, [])).toBeNull();
    expect(primerRechazo(lotes, ventas, [fila("v1", "a", 30n, "300"), fila("v2", "b", 10n, "120")])).toBeNull();
  });

  it("revisa código por código: una venta ajena gana a un lote posterior aunque venga después en la lista", () => {
    const r = primerRechazo(lotes, ventas, [fila("v1", "b", 10n, "120"), fila("zz", "a", 5n, "50")]);
    expect(r).toEqual({ codigo: "BLOQUEADA_VENTA_AJENA", ventaId: "zz", loteId: "a" });
  });

  it("dentro de un código, el primero por (venta, lote), sin importar el orden de entrada", () => {
    const filas = [fila("y", "a", 1n, "1"), fila("x", "b", 1n, "1")];
    expect(primerRechazo(lotes, ventas, filas)).toEqual({ codigo: "BLOQUEADA_VENTA_AJENA", ventaId: "x", loteId: "b" });
    expect(primerRechazo(lotes, ventas, [...filas].reverse())).toEqual({ codigo: "BLOQUEADA_VENTA_AJENA", ventaId: "x", loteId: "b" });
  });

  it("las sumas son por venta y por lote, no por fila", () => {
    const ventaGrande = [venta("v1", "2024-03-01", 200n)];
    expect(primerRechazo(lotes, ventaGrande, [fila("v1", "a", 60n, "600"), fila("v1", "a", 50n, "500")])).toEqual({ codigo: "BLOQUEADA_EXCEDE_LOTE", ventaId: null, loteId: "a" });
    expect(primerRechazo(lotes, ventas, [fila("v1", "a", 20n, "200"), fila("v1", "a", 20n, "200")])).toEqual({ codigo: "BLOQUEADA_EXCEDE_VENTA", ventaId: "v1", loteId: null });
  });

  it("el costo de un lote que no se agota no puede pasar su costo total, ni por un centavo", () => {
    expect(primerRechazo(lotes, ventas, [fila("v1", "a", 30n, "1000.0001")])).toMatchObject({ codigo: "BLOQUEADA_EXCEDE_COSTO", loteId: "a" });
    expect(primerRechazo(lotes, ventas, [fila("v1", "a", 30n, "1000")])).toBeNull();
  });

  it(`un lote agotado tolera ±${TOLERANCIA_COSTO.toString()} COP en la suma de su costo, y no más`, () => {
    const chico = [lote("c", "2024-01-10", 30n, "300")];
    expect(primerRechazo(chico, ventas, [fila("v1", "c", 30n, "301")])).toBeNull();
    expect(primerRechazo(chico, ventas, [fila("v1", "c", 30n, "299")])).toBeNull();
    expect(primerRechazo(chico, ventas, [fila("v1", "c", 30n, "301.0001")])).toMatchObject({ codigo: "BLOQUEADA_COSTO_DESCUADRADO", loteId: "c" });
    expect(primerRechazo(chico, ventas, [fila("v1", "c", 30n, "298.9999")])).toMatchObject({ codigo: "BLOQUEADA_COSTO_DESCUADRADO", loteId: "c" });
  });

  it("no muta las entradas", () => {
    const filas = [fila("y", "a", 1n, "1"), fila("v1", "a", 1n, "1")];
    const copia = [...filas];
    primerRechazo(lotes, ventas, filas);
    expect(filas).toEqual(copia);
  });
});

describe("ventasSinCuadrar", () => {
  const ventas = [venta("v1", "2024-03-01", 30n), venta("v2", "2024-06-01", 10n), venta("v3", "2024-07-01", 5n)];

  it("da las ventas sin asignar, asignadas de menos y asignadas de más", () => {
    expect(ventasSinCuadrar(ventas, [fila("v1", "a", 30n, "1"), fila("v2", "a", 4n, "1"), fila("v3", "a", 6n, "1")])).toEqual(["v2", "v3"]);
    expect(ventasSinCuadrar(ventas, [])).toEqual(["v1", "v2", "v3"]);
  });
});

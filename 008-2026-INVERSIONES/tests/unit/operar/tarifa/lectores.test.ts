// Los lectores de la tarifa y de la historia con la base simulada (revisión de base, MEDIOS 1 y 2): la historia de
// órdenes trae solo las que cuentan (aprobadas con valor) y sin ordenar; el simulador lee solo las vigentes del
// comisionista (sin el motivo); la historia de la pantalla, acotada. Datos inventados.
import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { leerOrdenesHistoricas, leerTarifas, leerTarifasVigentes } from "@/operar/tarifa/leer";

const D = (v: string) => new Prisma.Decimal(v);
const fila = (version: number, lado: "COMPRA" | "VENTA") => ({
  version, comisionista: "TRII", lado, porcentaje: D("0.2731"), minimoPorOrden: D("7.13"), fijoPorOrden: D("0"), ivaPct: D("17.31"),
  otrosCargos: [{ nombre: "C", tipo: "FIJO", valor: "2.11" }], vigenteDesde: new Date(Date.UTC(2027, 0, 11)),
});

describe("leerOrdenesHistoricas", () => {
  it("filtra en la base las aprobadas con valor y no ordena", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await leerOrdenesHistoricas({ orden: { findMany } } as never);
    const arg = findMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ estado: "APROBADO", totalInvertido: { gt: 0 } });
    expect(arg.orderBy).toBeUndefined();
    expect(arg.select).toEqual({ fechaOperacion: true, lado: true, estado: true, totalInvertido: true, comision: true });
  });
});

describe("leerTarifasVigentes", () => {
  it("una por lado, del comisionista, con vigencia hasta el día, la de mayor versión, sin motivo", async () => {
    const findMany = vi.fn().mockResolvedValue([fila(9, "COMPRA"), fila(4, "VENTA")]);
    const hoy = new Date(Date.UTC(2027, 2, 17));
    const v = await leerTarifasVigentes({ tarifaComision: { findMany } } as never, "TRII", hoy);
    const arg = findMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ comisionista: "TRII", vigenteDesde: { lte: hoy } });
    expect(arg.orderBy).toEqual([{ lado: "asc" }, { version: "desc" }]);
    expect(arg.distinct).toEqual(["lado"]);
    expect(arg.select.motivo).toBeUndefined();
    expect(v.COMPRA?.version).toBe(9);
    expect(v.VENTA?.otrosCargos[0]?.valor.toFixed()).toBe("2.11");
  });

  it("sin filas, sin tarifas (la historia decide)", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    expect(await leerTarifasVigentes({ tarifaComision: { findMany } } as never, "AV", new Date(Date.UTC(2027, 2, 17)))).toEqual({});
  });
});

describe("leerTarifas", () => {
  it("acota la historia con take", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    await leerTarifas({ tarifaComision: { findMany } } as never, 20);
    expect(findMany.mock.calls[0]![0].take).toBe(20);
  });

  it("un cargo guardado sin la forma de la CHECK lanza (no inventa una comisión)", async () => {
    const findMany = vi.fn().mockResolvedValue([{ ...fila(1, "COMPRA"), otrosCargos: [{ nombre: "C", tipo: "OTRO", valor: "1" }], motivo: "m", creadaEn: new Date() }]);
    await expect(leerTarifas({ tarifaComision: { findMany } } as never, 20)).rejects.toThrow(RangeError);
    findMany.mockResolvedValue([{ ...fila(1, "COMPRA"), otrosCargos: {}, motivo: "m", creadaEn: new Date() }]);
    await expect(leerTarifas({ tarifaComision: { findMany } } as never, 20)).rejects.toThrow(RangeError);
    findMany.mockResolvedValue([{ ...fila(1, "COMPRA"), comisionista: "OTRA", motivo: "m", creadaEn: new Date() }]);
    await expect(leerTarifas({ tarifaComision: { findMany } } as never, 20)).rejects.toThrow(RangeError);
  });
});

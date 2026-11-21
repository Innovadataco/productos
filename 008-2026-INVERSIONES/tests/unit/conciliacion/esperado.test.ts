/**
 * El cierre del día del corte que usa la conciliación no depende del orden en que la base devuelve las filas.
 * Con varias fuentes vigentes del mismo día: Yahoo primero; si no, la traída más recientemente; con el mismo
 * `traidoEn`, la fuente en orden alfabético (hay un solo cierre vigente por fuente). Hoy solo se escribe Yahoo,
 * pero un servicio de precios o la certificación pueden sumar otra fuente. Lector falso con filas en los dos
 * órdenes (datos inventados, FICT…).
 */
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { especiesAlCorte } from "@/conciliacion/esperado";

interface FilaCierre {
  readonly instrumentoId: string;
  readonly precio: Prisma.Decimal;
  readonly fuente: string;
  readonly traidoEn: Date;
}

const CORTE = new Date("2024-11-20T00:00:00Z");
const ID = "fict-especie";
const CERTIFICADA = new Map([[ID, { cantidad: 10n, precioValoracion: "150", valorMercado: "1500" }]]);
const fila = (fuente: string, precio: string, traidoEn: string): FilaCierre => ({ instrumentoId: ID, precio: new Prisma.Decimal(precio), fuente, traidoEn: new Date(traidoEn) });

/** Solo lo que lee `especiesAlCorte`: sin órdenes, sin escisiones y los cierres en el orden dado. */
function lector(cierres: readonly FilaCierre[]): Prisma.TransactionClient {
  return {
    lote: { findMany: async () => [] },
    eventoCorporativo: { findMany: async () => [] },
    precioCierre: { findMany: async () => cierres.map((c) => ({ ...c })) },
  } as unknown as Prisma.TransactionClient;
}

async function cierreElegido(cierres: readonly FilaCierre[]): Promise<string | null> {
  const [especie] = await especiesAlCorte(lector(cierres), CORTE, CERTIFICADA, []);
  return especie?.cierre ?? null;
}

/** El cierre elegido con las filas en el orden dado y en el inverso. */
const enLosDosOrdenes = async (cierres: readonly FilaCierre[]) => [await cierreElegido(cierres), await cierreElegido([...cierres].reverse())];

describe("especiesAlCorte: cierre del corte con varias fuentes", () => {
  it("dos fuentes que no son Yahoo con el mismo traidoEn: siempre la primera por nombre de fuente", async () => {
    const mismoMomento = "2024-11-20T22:00:00Z";
    expect(await enLosDosOrdenes([fila("fuente-ficticia-a", "100", mismoMomento), fila("fuente-ficticia-b", "200", mismoMomento)])).toEqual(["100", "100"]);
  });

  it("sin Yahoo, gana la traída más recientemente, aunque la base la devuelva después", async () => {
    expect(await enLosDosOrdenes([fila("fuente-ficticia-a", "100", "2024-11-20T21:00:00Z"), fila("fuente-ficticia-b", "200", "2024-11-20T23:00:00Z")])).toEqual(["200", "200"]);
  });

  it("Yahoo gana aunque otra fuente sea más reciente", async () => {
    expect(await enLosDosOrdenes([fila("fuente-ficticia-a", "200", "2024-11-21T09:00:00Z"), fila("yahoo", "100", "2024-11-20T22:00:00Z")])).toEqual(["100", "100"]);
  });

  it("sin cierres del día: null (nunca el de otro día)", async () => {
    expect(await enLosDosOrdenes([])).toEqual([null, null]);
  });
});

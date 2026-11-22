// Candado del acople con el lector de C5b (frente datos-oficiales-decretos-pantalla, C6b; revisión code-reviewer, MEDIO):
// datos.ts le pasa a leerDecretos (sin simular) la transacción ya abierta (enEstaTransaccion). Aquí corre el lector REAL
// con una base falsa que solo tiene `$transaction` (cualquier otra cosa revienta) y comprueba:
// - una sola transacción; todas las consultas de los decretos van al mismo tx que las series;
// - enSoloLectura vuelve a pedir SET TRANSACTION READ ONLY dentro de ella (PostgreSQL lo acepta: lo prueba la
//   integración, tests/integracion/datos-oficiales-decretos.test.ts).
// Si el lector de C5b llegara a usar otra cosa de la base que no sea `$transaction`, esto se pone rojo antes que la
// integración: entonces hay que pedirle un lector que reciba el tx. Cifras inventadas; «hoy» es el 17-mar-2021.
import { Prisma, type PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { datosOficiales } from "@/app/datos-oficiales/datos";
import { baseFalsaLectura } from "../datos-oficiales/base-falsa-lectura";

const HOY = new Date("2021-03-17T00:00:00Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

function base() {
  const { db: lector } = baseFalsaLectura([]);
  const consultas: string[] = [];
  const sentencias: string[] = [];
  const anotar = <T>(nombre: string, valor: T) => async () => { consultas.push(nombre); return valor; };
  const proximo = {
    id: "dec-p1", instrumentoId: "ins-a", tipo: "ORDINARIO", cuota: 1, valorPorAccion: new Prisma.Decimal("41.37"), fechaAnuncio: dia("2021-03-03"),
    fechaEx: dia("2021-03-24"), fechaPago: dia("2021-03-31"), referenciaOficial: "https://www.bvc.com.co/ficticio/c6b-real", version: 1, anulada: false,
    reemplazadoEn: null, instrumento: { nemotecnico: "FICTA" },
  };
  let decretos = 0;
  const tx = {
    ...lector,
    $executeRaw: async (partes: TemplateStringsArray) => { sentencias.push(partes.join("")); return 0; },
    // La primera lectura de decretos es la del cruce (sin filas); la segunda, la de los próximos.
    dividendoDecretado: { findMany: async () => { consultas.push("dividendoDecretado.findMany"); decretos += 1; return decretos === 2 ? [proximo] : []; } },
    dividendo: { findMany: anotar("dividendo.findMany", []), aggregate: anotar("dividendo.aggregate", { _max: { fechaPago: null } }) },
    cargaArchivo: { groupBy: anotar("cargaArchivo.groupBy", []) },
    orden: { findMany: anotar("orden.findMany", []) },
    lote: { findMany: anotar("lote.findMany", []) },
    instrumento: { findMany: anotar("instrumento.findMany", [{ id: "ins-a", nemotecnico: "FICTA", nombre: "Ficticia A" }]) },
  };
  let transacciones = 0;
  const conTransaccion = { $transaction: async (leer: (t: typeof tx) => Promise<unknown>) => { transacciones += 1; return leer(tx); } };
  const db = new Proxy(conTransaccion, {
    get: (o, k) => {
      if (k === "$transaction") return o.$transaction;
      throw new Error(`la pantalla tocó la base fuera de la transacción: ${String(k)}`);
    },
  }) as unknown as PrismaClient;
  return { db, consultas, sentencias, transacciones: () => transacciones };
}

describe("datosOficiales con el lector real de C5b", () => {
  it("una sola transacción; los decretos se leen en el mismo tx que las series", async () => {
    const b = base();
    const vista = await datosOficiales(b.db, HOY);
    expect(b.transacciones()).toBe(1);
    expect(b.sentencias).toEqual(["SET TRANSACTION READ ONLY", "SET TRANSACTION READ ONLY"]);
    expect(b.consultas).toEqual([
      "dividendoDecretado.findMany", "dividendo.findMany", "cargaArchivo.groupBy", "dividendo.aggregate",
      "dividendoDecretado.findMany", "orden.findMany", "lote.findMany", "instrumento.findMany",
    ]);
    expect(vista.decretos).toEqual({
      desde: "2020-03-17", cruce: [], sinTenencia: 0,
      proximos: [{
        clave: "dec-p1", especie: "FICTA", tipo: "ORDINARIO", cuota: 1, valorPorAccion: "41.37", fechaEx: "2021-03-24", fechaPago: "2021-03-31",
        referencia: "https://www.bvc.com.co/ficticio/c6b-real", version: 1, tenencia: "0", brutoEstimado: "0",
      }],
    });
  });
});

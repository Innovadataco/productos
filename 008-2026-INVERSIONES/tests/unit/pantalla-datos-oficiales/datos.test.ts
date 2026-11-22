// Lo que lee /datos-oficiales (frente datos-oficiales-pantalla, C6a) con una base falsa (sin PostgreSQL):
// - todo en UNA transacción REPEATABLE READ de solo lectura (enSoloLectura): la base falsa no tiene delegados fuera de la
//   transacción, así que una lectura por fuera revienta;
// - por serie: el último que ya empezó y su frescura con el mismo hoy, la historia de su ventana (un año; cinco para el
//   IPC) sin la TRM publicada por adelantado, y la variación del IPC CALCULADA contra el mismo mes del año anterior;
// - una serie con un valor que la base no debería tener queda «ERROR» sola (al registro, solo el código); un error de la
//   base se propaga (la página muestra SinBase).
// Cifras inventadas; «hoy» es el 17-mar-2021.
import { Prisma, type PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIA_MINIMO_LECTURA_MS } from "@/datos-oficiales/series/leer";
import { sumarDias } from "@/plan/fechas";
import { VENTANA_DIAS, datosOficiales } from "@/app/datos-oficiales/datos";
import { baseFalsaLectura, type FilaLecturaFalsa, type LlamadaLectura } from "../datos-oficiales/base-falsa-lectura";
import { IBR, IPC, TPM, TRM, baseDe } from "./ficticio";

const HOY = new Date("2021-03-17T00:00:00Z");
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);

const trm = (desde: string, hasta: string, valor: string): FilaLecturaFalsa => ({ serie: "TRM", desde, hasta, valor, fuente: "sfc:32sa-8pi3", traidoEn: "2021-03-16T23:41:00Z" });
const tpm = (d: string, valor: string | { toFixed(): string }): FilaLecturaFalsa => ({ serie: "TPM", desde: d, hasta: d, valor, fuente: "banrep:DF_CBR_DAILY_HIST.IRCBRM01.PA", traidoEn: "2021-03-17T12:13:00Z" });
const ibr = (d: string, valor: string): FilaLecturaFalsa => ({ serie: "IBR_3M_EA", desde: d, hasta: d, valor, fuente: "banrep:DF_IBR_DAILY_HIST.IRIBRM03.ER", traidoEn: "2021-03-06T14:02:00Z" });
const ipc = (p: (typeof IPC)["historia"][number]): FilaLecturaFalsa => ({ serie: "IPC_INDICE", desde: p.desde, hasta: p.hasta, valor: p.valor, fuente: "dane:anex-IPC-Indices", traidoEn: "2021-03-10T01:57:00Z" });

const FILAS: readonly FilaLecturaFalsa[] = [
  trm("2020-03-10", "2020-03-10", "3711.29"),
  ...TRM.historia.map((p) => trm(p.desde, p.hasta, p.valor)),
  // Publicada por adelantado (vale mañana): ni es la de hoy ni entra a la historia.
  trm("2021-03-18", "2021-03-18", "3925.33"),
  ...TPM.historia.map((p) => tpm(p.desde, p.valor)),
  ...IBR.historia.map((p) => ibr(p.desde, p.valor)),
  ...IPC.historia.map(ipc),
];

/** La base falsa dentro de una transacción falsa: guarda las opciones y las sentencias crudas. */
function base(filas: readonly FilaLecturaFalsa[]) {
  const { db: lector, llamadas } = baseFalsaLectura(filas);
  const sentencias: string[] = [];
  const opciones: unknown[] = [];
  const tx = { ...lector, $executeRaw: async (partes: TemplateStringsArray) => { sentencias.push(partes.join("")); return 0; } };
  const db = { $transaction: vi.fn(async (leer: (t: typeof tx) => Promise<unknown>, o: unknown) => { opciones.push(o); return leer(tx); }) };
  return { db: db as unknown as PrismaClient, transaccion: db.$transaction, llamadas, sentencias, opciones };
}

const rangoDe = (llamadas: readonly LlamadaLectura[], serie: string) => llamadas.find((l) => l.metodo === "findMany" && l.args.where.serie === serie)?.args.where;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("datosOficiales", () => {
  it("lee las cuatro series en una sola transacción REPEATABLE READ de solo lectura", async () => {
    const b = base(FILAS);
    const vista = await datosOficiales(b.db, HOY);
    expect(b.transaccion).toHaveBeenCalledTimes(1);
    expect(b.opciones[0]).toMatchObject({ isolationLevel: "RepeatableRead" });
    expect(b.sentencias).toEqual(["SET TRANSACTION READ ONLY"]);
    expect(vista.hoy).toBe("2021-03-17");
    expect(vista.series.map((s) => s.codigo)).toEqual(["TRM", "TPM", "IBR_3M_EA", "IPC_INDICE"]);
  });

  it("cada serie: el último que ya empezó, su frescura con el mismo hoy, su historia y, en el IPC, la variación calculada", async () => {
    const vista = await datosOficiales(base(FILAS).db, HOY);
    expect(vista.series).toEqual([TRM, TPM, IBR, IPC]);
  });

  it("las ventanas: un año para las diarias, cinco para el IPC, hasta hoy (nada que empiece después)", async () => {
    const b = base(FILAS);
    await datosOficiales(b.db, HOY);
    expect(VENTANA_DIAS).toEqual({ ANIO: 366, CINCO_ANIOS: 5 * 366 });
    for (const codigo of ["TRM", "TPM", "IBR_3M_EA"]) {
      expect(rangoDe(b.llamadas, codigo)?.hasta?.gte, codigo).toEqual(sumarDias(HOY, -365));
      expect(rangoDe(b.llamadas, codigo)?.desde?.lte, codigo).toEqual(HOY);
    }
    expect(rangoDe(b.llamadas, "IPC_INDICE")?.hasta?.gte).toEqual(sumarDias(HOY, -(5 * 366 - 1)));
  });

  it("la ventana nunca empieza antes del primer día que acepta la lectura", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hoy = new Date(Date.UTC(1902, 5, 17));
    const b = base([]);
    await datosOficiales(b.db, hoy);
    expect(rangoDe(b.llamadas, "IPC_INDICE")).toBeUndefined();
    const conIpc = base([{ serie: "IPC_INDICE", desde: "1902-05-01", hasta: "1902-05-31", valor: "37.91", fuente: "dane:anex-IPC-Indices" }]);
    const vista = await datosOficiales(conIpc.db, hoy);
    expect(rangoDe(conIpc.llamadas, "IPC_INDICE")?.hasta?.gte).toEqual(new Date(DIA_MINIMO_LECTURA_MS));
    // El mismo mes del año anterior cae antes de 1902: la variación no se puede calcular, la tarjeta sí sale.
    expect(vista.series[3]).toMatchObject({ estado: "CON_DATOS", variacion: { estado: "NO_SE_PUDO" } });
    expect(registro.mock.calls).toEqual([["[datos-oficiales] IPC_INDICE (variación): FECHA_INVALIDA"]]);
  });

  it("una serie sin ningún valor que ya empezó: SIN_DATOS (la TRM solo con la de mañana, también)", async () => {
    const vista = await datosOficiales(base([trm("2021-03-18", "2021-03-18", "3925.33"), ...IPC.historia.map(ipc)]).db, HOY);
    expect(vista.series.slice(0, 3)).toEqual([
      { ...baseDe("TRM"), estado: "SIN_DATOS" },
      { ...baseDe("TPM"), estado: "SIN_DATOS" },
      { ...baseDe("IBR_3M_EA"), estado: "SIN_DATOS" },
    ]);
  });

  it("sin el índice del mismo mes del año anterior, la variación queda SIN_BASE (nunca contra otro mes)", async () => {
    const sinBase = FILAS.filter((f) => !(f.serie === "IPC_INDICE" && f.desde === "2020-02-01"));
    const vista = await datosOficiales(base(sinBase).db, HOY);
    expect(vista.series[3]).toMatchObject({ estado: "CON_DATOS", variacion: { estado: "SIN_BASE", mesBase: "2020-02-01" } });
  });

  it("un valor que la base no debería tener deja esa serie en ERROR y las demás siguen; al registro, solo el código", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const filas = FILAS.map((f) => (f.serie === "TPM" && f.desde === "2021-03-16" ? tpm("2021-03-16", { toFixed: () => "0" }) : f));
    const vista = await datosOficiales(base(filas).db, HOY);
    expect(vista.series.map((s) => s.estado)).toEqual(["CON_DATOS", "ERROR", "CON_DATOS", "CON_DATOS"]);
    expect(vista.series[1]).toEqual({ ...baseDe("TPM"), estado: "ERROR" });
    expect(registro.mock.calls).toEqual([["[datos-oficiales] TPM: VALOR_INVALIDO"]]);
  });

  it("un error de la base se propaga (no se disfraza de ERROR de una serie)", async () => {
    const b = base(FILAS);
    const falla = new Prisma.PrismaClientKnownRequestError("falló en postgresql://u:clave-secreta@h", { code: "P2021", clientVersion: "5.22.0" });
    const tx = b.db as unknown as { $transaction: (f: (t: unknown) => Promise<unknown>, o: unknown) => Promise<unknown> };
    const conFalla = {
      $transaction: (leer: (t: unknown) => Promise<unknown>, o: unknown) =>
        tx.$transaction(async (t) => leer({ ...(t as object), valorSerieOficial: { findFirst: async () => { throw falla; }, findMany: async () => [] } }), o),
    } as unknown as PrismaClient;
    await expect(datosOficiales(conFalla, HOY)).rejects.toBe(falla);
  });

  it("un error que no es de la lectura (un defecto) tampoco se esconde", async () => {
    const roto = { $transaction: async (leer: (t: unknown) => Promise<unknown>) => leer({ $executeRaw: async () => 0, valorSerieOficial: { findFirst: async () => { throw new TypeError("x"); } } }) } as unknown as PrismaClient;
    await expect(datosOficiales(roto, HOY)).rejects.toThrow(TypeError);
  });

  it("cada día se lee como día: hoy es medianoche UTC del día de Colombia", async () => {
    const b = base(FILAS);
    await datosOficiales(b.db, HOY);
    expect(b.llamadas.filter((l) => l.metodo === "findFirst").every((l) => l.args.where.desde?.lte instanceof Date)).toBe(true);
    expect(b.llamadas.find((l) => l.metodo === "findFirst" && l.args.where.serie === "IPC_INDICE" && l.args.where.desde?.lte?.getTime() === dia("2020-02-01").getTime())).toBeDefined();
  });
});

// El camino único de las series oficiales (src/datos-oficiales/series/guardar.ts) contra la base de PRUEBAS, con las
// reglas de C1 (índice único parcial, exclusión de vigencias e inv_solo_retiro):
// - reimportar lo mismo no escribe nada; una revisión retira lo que se solapa e inserta en la misma transacción (el
//   retirado y su sucesor quedan con el mismo instante de la base); otra fuente con el mismo valor no versiona;
// - la forma real con que Prisma 5.22 entrega el choque del índice (P2002) y el de la exclusión (23P01, sin código);
// - una carrera real: otra transacción, sin confirmar, escribe lo que choca (o retira el vigente); guardar espera, choca
//   y reintenta releyendo (se cuenta la transacción de más); dos corridas de la misma serie se ponen en fila (candado de
//   asesoría) sin reintentos; el lote que se alarga retira y reemplaza en la misma transacción;
// - el CLI como proceso contra la base: 0 y, al repetir, 0 sin escribir, sin valores en la salida.
// No se puede borrar (inv_solo_retiro): cada caso usa su propia serie ficticia (FICT_<corrida>_<n>). Solo el CLI usa un
// código real (TRM) y lo hace en 1991, lejos de cualquier otra prueba. Cifras inventadas.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ENCABEZADO_CSV_SERIES } from "@/datos-oficiales/series/csv-series";
import { TAMANO_LOTE_SERIES, guardarSeries, type SerieAGuardar } from "@/datos-oficiales/series/guardar";
import { comprobar, correr, entornoMinimo } from "../ayudas/cli";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase();
let n = 0;
const nuevaSerie = () => `FICT_${corrida}_${(n += 1)}`;
const dia = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fila = (desde: string, hasta: string, valor: string) => ({ desde: dia(desde), hasta: dia(hasta), valor });
const serie = (codigo: string, valores: SerieAGuardar["valores"], fuente = "sfc:ficticia"): SerieAGuardar => ({ codigo, fuente, valores });
/** `cuantos` días seguidos desde `inicio`, de un día cada uno. */
const diarios = (inicio: string, cuantos: number, valor = "7.13") =>
  Array.from({ length: cuantos }, (_, i) => ({ desde: new Date(dia(inicio).getTime() + i * 86_400_000), hasta: new Date(dia(inicio).getTime() + i * 86_400_000), valor }));

/** Cuenta las transacciones que abre guardarSeries (los reintentos abren una más) mientras corre `cuerpo`. */
async function contandoTransacciones<T>(cuerpo: () => Promise<T>): Promise<{ resultado: T; transacciones: number }> {
  const espia = vi.spyOn(db, "$transaction");
  try {
    const resultado = await cuerpo();
    return { resultado, transacciones: espia.mock.calls.length };
  } finally {
    espia.mockRestore();
  }
}

const todas = async (codigo: string) =>
  (await db.valorSerieOficial.findMany({ where: { serie: codigo }, orderBy: [{ traidoEn: "asc" }, { desde: "asc" }] })).map((v) => ({
    desde: iso(v.desde), hasta: iso(v.hasta), valor: v.valor.toFixed(), fuente: v.fuente, vigente: v.reemplazadoEn === null, traidoEn: v.traidoEn, reemplazadoEn: v.reemplazadoEn,
  }));

class Deshacer extends Error {}

/** El error que lanza `cuerpo` dentro de una transacción que siempre se deshace. */
async function errorEnTransaccion(cuerpo: (tx: Prisma.TransactionClient) => Promise<void>): Promise<unknown> {
  let error: unknown = null;
  try {
    await db.$transaction(async (tx) => {
      try {
        await cuerpo(tx);
      } catch (e) {
        error = e;
      }
      throw new Deshacer();
    });
  } catch (e) {
    if (!(e instanceof Deshacer)) throw e;
  }
  return error;
}

/** Espera (con tope) a que alguna sesión de esta base esté esperando un candado: la escritura chocó con la otra transacción. */
async function hastaQueEspere(): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    const [f] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
    if ((f?.n ?? 0) > 0) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("la escritura nunca esperó a la otra transacción");
}

/** Corre `escribir` en una transacción que queda abierta hasta que se llame a `confirmar`. */
async function transaccionAbierta(escribir: (tx: Prisma.TransactionClient) => Promise<unknown>) {
  let confirmar!: () => void;
  const confirmada = new Promise<void>((r) => (confirmar = r));
  let lista!: () => void;
  const escrita = new Promise<void>((r) => (lista = r));
  const fin = db.$transaction(async (tx) => {
    await escribir(tx);
    lista();
    await confirmada;
  }, { timeout: 20_000 });
  await escrita;
  return { confirmar, fin };
}

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("guardarSeries · contra la base", () => {
  it("guarda una serie nueva y reimportarla no escribe nada (mismas filas, misma hora de la base)", async () => {
    const s = nuevaSerie();
    const valores = [fila("2027-03-05", "2027-03-07", "4613.27"), fila("2027-03-08", "2027-03-08", "4613.29"), fila("2027-03-09", "2027-03-09", "4613.31")];
    const [primero] = await guardarSeries(db, [serie(s, valores)]);
    expect(primero).toEqual({ codigo: s, filas: 3, nuevas: 3, revisadas: 0, retiradas: 0, sinCambios: 0, diasDescubiertos: 0, ultimoHasta: dia("2027-03-09"), fallo: null });
    const antes = await todas(s);
    const [otra] = await guardarSeries(db, [serie(s, valores)]);
    expect(otra).toMatchObject({ nuevas: 0, revisadas: 0, retiradas: 0, sinCambios: 3, fallo: null });
    expect(await todas(s)).toEqual(antes);
  });

  it("una revisión retira los vigentes que se solapan e inserta en la misma transacción: el retirado y su sucesor, con el mismo instante", async () => {
    const s = nuevaSerie();
    await guardarSeries(db, [serie(s, [fila("2027-03-05", "2027-03-07", "4613.27"), fila("2027-03-08", "2027-03-08", "4613.29")])]);
    const [r] = await guardarSeries(db, [serie(s, [fila("2027-03-05", "2027-03-05", "4613.27"), fila("2027-03-06", "2027-03-06", "4613.33"), fila("2027-03-08", "2027-03-08", "4613.29")])]);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 2, retiradas: 1, sinCambios: 1, diasDescubiertos: 1, fallo: null });
    const filas = await todas(s);
    expect(filas.map((f) => [f.desde, f.hasta, f.valor, f.vigente])).toEqual([
      ["2027-03-05", "2027-03-07", "4613.27", false], ["2027-03-08", "2027-03-08", "4613.29", true],
      ["2027-03-05", "2027-03-05", "4613.27", true], ["2027-03-06", "2027-03-06", "4613.33", true],
    ]);
    expect(filas[0]!.reemplazadoEn).toEqual(filas[2]!.traidoEn);
  });

  it("otra fuente con el mismo valor y la misma vigencia no versiona", async () => {
    const s = nuevaSerie();
    await guardarSeries(db, [serie(s, [fila("2027-03-08", "2027-03-08", "131.47")], "dane:ficticia-marzo")]);
    const [r] = await guardarSeries(db, [serie(s, [fila("2027-03-08", "2027-03-08", "131.47")], "dane:ficticia-abril")]);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 0, sinCambios: 1 });
    expect((await todas(s)).map((f) => f.fuente)).toEqual(["dane:ficticia-marzo"]);
  });
});

describe("Prisma 5.22 · la forma de los dos choques (lo que guardar.ts reconoce)", () => {
  it("la exclusión (desde distinto que se solapa): PrismaClientUnknownRequestError, sin código, con el SQLSTATE 23P01 en el mensaje", async () => {
    const s = nuevaSerie();
    const e = await errorEnTransaccion(async (tx) => {
      await tx.valorSerieOficial.createMany({ data: [{ serie: s, desde: dia("2027-03-05"), hasta: dia("2027-03-07"), valor: new Prisma.Decimal("4613.27"), fuente: "sfc:ficticia" }] });
      await tx.valorSerieOficial.createMany({ data: [{ serie: s, desde: dia("2027-03-06"), hasta: dia("2027-03-06"), valor: new Prisma.Decimal("4613.29"), fuente: "sfc:ficticia" }] });
    });
    expect(e).toBeInstanceOf(Prisma.PrismaClientUnknownRequestError);
    expect((e as { code?: unknown }).code).toBeUndefined();
    expect((e as Error).message).toMatch(/\b23P01\b/);
  });

  it("el índice único parcial (mismo desde), con el orden de una base recién migrada: P2002", async () => {
    const s = nuevaSerie();
    const e = await errorEnTransaccion(async (tx) => {
      await tx.valorSerieOficial.createMany({ data: [{ serie: s, desde: dia("2027-03-05"), hasta: dia("2027-03-05"), valor: new Prisma.Decimal("4613.27"), fuente: "sfc:ficticia" }] });
      await tx.valorSerieOficial.createMany({ data: [{ serie: s, desde: dia("2027-03-05"), hasta: dia("2027-03-06"), valor: new Prisma.Decimal("4613.29"), fuente: "sfc:ficticia" }] });
    });
    expect(e).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((e as { code?: unknown }).code).toBe("P2002");
  });
});

describe("guardarSeries · una carrera real con otra transacción", () => {
  it.each([
    ["por la exclusión (la otra escribió un desde distinto que se solapa)", "2027-03-06"],
    ["por el índice único (la otra escribió el mismo desde)", "2027-03-05"],
  ])("%s: guardar espera, choca, relee y revisa lo que la otra dejó", async (_, desdeDeLaOtra) => {
    const s = nuevaSerie();
    const otra = await transaccionAbierta((tx) =>
      tx.valorSerieOficial.createMany({ data: [{ serie: s, desde: dia(desdeDeLaOtra), hasta: dia("2027-03-07"), valor: new Prisma.Decimal("4613.21"), fuente: "sfc:ficticia" }] }));
    const { resultado: [r], transacciones } = await contandoTransacciones(async () => {
      const guardando = guardarSeries(db, [serie(s, [fila("2027-03-05", "2027-03-07", "4613.27")])]);
      await hastaQueEspere();
      otra.confirmar();
      await otra.fin;
      return guardando;
    });
    expect(transacciones, "chocó y reintentó una vez").toBe(2);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 1, retiradas: 1, fallo: null });
    expect((await todas(s)).map((f) => [f.desde, f.valor, f.vigente])).toEqual([[desdeDeLaOtra, "4613.21", false], ["2027-03-05", "4613.27", true]]);
  });

  it("la otra escribió lo mismo: guardar choca, relee y queda sin cambios", async () => {
    const s = nuevaSerie();
    const otra = await transaccionAbierta((tx) =>
      tx.valorSerieOficial.createMany({ data: [{ serie: s, desde: dia("2027-03-05"), hasta: dia("2027-03-07"), valor: new Prisma.Decimal("4613.27"), fuente: "sfc:ficticia" }] }));
    const { resultado: [r], transacciones } = await contandoTransacciones(async () => {
      const guardando = guardarSeries(db, [serie(s, [fila("2027-03-05", "2027-03-07", "4613.27")])]);
      await hastaQueEspere();
      otra.confirmar();
      await otra.fin;
      return guardando;
    });
    expect(transacciones, "chocó y reintentó una vez").toBe(2);
    expect(r).toMatchObject({ nuevas: 0, revisadas: 0, sinCambios: 1, fallo: null });
    expect(await db.valorSerieOficial.count({ where: { serie: s } })).toBe(1);
  });
});

describe("guardarSeries · el retiro que cuenta menos, el candado por serie y el lote alargado", () => {
  it("otra transacción retira el vigente entre la lectura y el retiro: el retiro cuenta menos, se relee y la fila entra nueva", async () => {
    const s = nuevaSerie();
    await guardarSeries(db, [serie(s, [fila("2027-03-05", "2027-03-05", "4613.27")])]);
    const vigente = await db.valorSerieOficial.findFirstOrThrow({ where: { serie: s, reemplazadoEn: null } });
    const otra = await transaccionAbierta((tx) => tx.valorSerieOficial.updateMany({ where: { id: vigente.id }, data: { reemplazadoEn: new Date() } }));
    const { resultado: [r], transacciones } = await contandoTransacciones(async () => {
      const guardando = guardarSeries(db, [serie(s, [fila("2027-03-05", "2027-03-05", "4613.31")])]);
      await hastaQueEspere();
      otra.confirmar();
      await otra.fin;
      return guardando;
    });
    expect(transacciones, "el retiro contó menos y reintentó una vez").toBe(2);
    expect(r).toMatchObject({ nuevas: 1, revisadas: 0, retiradas: 0, fallo: null });
    expect((await todas(s)).map((f) => [f.desde, f.valor, f.vigente])).toEqual([["2027-03-05", "4613.27", false], ["2027-03-05", "4613.31", true]]);
  });

  it("dos corridas a la vez de la misma serie se ponen en fila: una escribe, la otra queda sin cambios, sin reintentos", async () => {
    const s = nuevaSerie();
    const valores = diarios("2019-03-04", 3);
    const { resultado: [a, b], transacciones } = await contandoTransacciones(() => Promise.all([guardarSeries(db, [serie(s, valores)]), guardarSeries(db, [serie(s, valores)])]));
    expect(transacciones, "una transacción por corrida, sin reintentos").toBe(2);
    expect([a![0]!, b![0]!].map((x) => [x.nuevas, x.sinCambios, x.fallo]).sort()).toEqual([[0, 3, null], [3, 0, null]]);
    expect(await db.valorSerieOficial.count({ where: { serie: s } })).toBe(3);
  });

  it("un vigente retirado que pasa del corte del lote: su retiro y todo su reemplazo quedan con el mismo instante; el lote siguiente, con otro", async () => {
    const s = nuevaSerie();
    const valores = diarios("2019-01-01", TAMANO_LOTE_SERIES + 3);
    const [desde, hasta] = [valores[TAMANO_LOTE_SERIES - 1]!.desde, valores[TAMANO_LOTE_SERIES + 1]!.hasta];
    await guardarSeries(db, [serie(s, [{ desde, hasta, valor: "7.11" }])]);
    const [r] = await guardarSeries(db, [serie(s, valores)]);
    expect(r).toMatchObject({ nuevas: TAMANO_LOTE_SERIES, revisadas: 3, retiradas: 1, diasDescubiertos: 0, fallo: null });
    const filas = await todas(s);
    const retirado = filas.find((f) => !f.vigente)!;
    const instante = (iso: string) => filas.find((f) => f.vigente && f.desde === iso)!.traidoEn.getTime();
    for (const v of valores.slice(TAMANO_LOTE_SERIES - 1, TAMANO_LOTE_SERIES + 2)) expect(instante(iso(v.desde))).toBe(retirado.reemplazadoEn!.getTime());
    expect(instante(iso(valores[0]!.desde))).toBe(retirado.reemplazadoEn!.getTime());
    expect(instante(iso(valores[TAMANO_LOTE_SERIES + 2]!.desde))).toBeGreaterThan(retirado.reemplazadoEn!.getTime());
  });
});

describe("CLI importar-series.ts como proceso", { timeout: 120_000 }, () => {
  it("importa con 0 y repite con 0 sin escribir; imprime conteos y fechas, nunca valores", async () => {
    const carpeta = mkdtempSync(join(tmpdir(), "inv008-series-cli-"));
    try {
      const ruta = join(carpeta, "series.ficticio.csv");
      writeFileSync(ruta, `${ENCABEZADO_CSV_SERIES}\nTRM,1991-12-06,1991-12-08,641.37,sfc:32sa-8pi3\nTRM,1991-12-09,1991-12-09,641.53,sfc:32sa-8pi3\n`);
      const env = entornoMinimo({ DATABASE_URL: process.env.DATABASE_URL ?? "" });
      const nunca = ["641.37", "641.53", carpeta];
      const primero = correr("importar-series.ts", ["--archivo", ruta], env);
      comprobar(primero, 0, "📄 CSV de series · filas: 2 · series: 1", nunca);
      expect(primero.texto).toContain("✅ TRM · filas: 2 · nuevas: 2 · revisadas: 0 · retiradas: 0 · sin cambios: 0 · último hasta: ");
      const antes = await db.valorSerieOficial.count({ where: { serie: "TRM" } });
      comprobar(correr("importar-series.ts", ["--archivo", ruta], env), 0, "nuevas: 0 · revisadas: 0 · retiradas: 0 · sin cambios: 2", nunca);
      expect(await db.valorSerieOficial.count({ where: { serie: "TRM" } })).toBe(antes);
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});

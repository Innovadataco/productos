// SPEC-13 «nunca un precio viejo como de hoy», contra la base de PRUEBAS con un Yahoo falso (sin red).
// Usa los festivos públicos sembrados por las migraciones (Jueves y Viernes Santo de 2024).
// Especies, precios y volúmenes inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actualizarPrecios } from "@/precios/actualizar";
import type { Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ts = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 14, 30) / 1000;
const DESPUES = new Date("2024-04-10T20:00:00Z");

interface Barra { readonly dia: string; readonly close: number; readonly volume: number | null }
const yahoo = (barras: readonly Barra[]): Buscar => async () =>
  new Response(JSON.stringify({
    chart: { result: [{ meta: { currency: "COP" }, timestamp: barras.map((b) => ts(b.dia)), indicators: { quote: [{ close: barras.map((b) => b.close), volume: barras.map((b) => b.volume) }] } }] },
  }));
const especie = async (sufijo: string) => (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PN${sufijo}${corrida}`, nombre: "Ficticia SN" } })).id;
const vigentes = async (instrumentoId: string) =>
  (await db.precioCierre.findMany({ where: { instrumentoId, reemplazadoEn: null }, orderBy: { fecha: "asc" } })).map((p) => [p.fecha.toISOString().slice(0, 10), p.precio.toString()]);

// Semana Santa de 2024: martes y miércoles hábiles; jueves 28 y viernes 29 festivos sembrados; sábado 30; lunes 1 hábil.
const SEMANA: Barra[] = [
  { dia: "2024-03-26", close: 100, volume: 1500 },
  { dia: "2024-03-27", close: 100, volume: 0 }, // hábil SIN negociación: repite el cierre
  { dia: "2024-03-28", close: 100, volume: 0 }, // festivo: cierre repetido, volume 0
  { dia: "2024-03-29", close: 100, volume: null }, // festivo: cierre repetido, volume null
  { dia: "2024-03-30", close: 100, volume: 5 }, // sábado
  { dia: "2024-04-01", close: 101, volume: null }, // hábil, volume null: se mantiene lo de hoy
];

beforeAll(async () => {
  const base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
  // Precondición: el calendario sembrado trae los festivos que usa la prueba.
  const festivos = await db.calendarioBvc.findMany({ where: { dia: { in: [utc("2024-03-28"), utc("2024-03-29")] }, esHabil: false } });
  if (festivos.length !== 2) throw new Error("calendario_bvc de 2024 sin los festivos esperados");
});

afterAll(async () => {
  await db.$disconnect();
});

describe("actualizarPrecios · días no hábiles y sin negociación", () => {
  it("regresión: no guarda el festivo (cierre repetido, volume 0) ni el día hábil con volume 0; lo reporta", async () => {
    const id = await especie("A");
    const r = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(SEMANA), instrumentoIds: [id], ahora: DESPUES });
    expect(await vigentes(id)).toEqual([["2024-03-26", "100"], ["2024-04-01", "101"]]);
    expect(r).toMatchObject({ cierresNuevos: 2, omitidasNoHabil: 3, omitidasSinNegociacion: 1, omitidasSinCalendario: 0, fallidas: [] });
  });

  it("datos ya guardados: la corrida con --desde retira el vigente de un día que ahora se omite, sin borrar historia", async () => {
    const id = await especie("B");
    const viejo = (dia: string, precio: number) =>
      db.precioCierre.create({ data: { instrumentoId: id, fecha: utc(dia), precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" } });
    // Como los dejó el código anterior: cierres del festivo y del día sin negociación con el precio viejo.
    await Promise.all([viejo("2024-03-26", 100), viejo("2024-03-27", 100), viejo("2024-03-28", 100), viejo("2024-03-29", 100)]);
    const r = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(SEMANA), instrumentoIds: [id], ahora: DESPUES });
    expect(await vigentes(id)).toEqual([["2024-03-26", "100"], ["2024-04-01", "101"]]);
    expect(r).toMatchObject({ cierresNuevos: 1, cierresRevisados: 0, cierresRetirados: 3, fallidas: [] });
    // Historia: las 4 filas viejas siguen; las 3 retiradas quedan con reemplazadoEn y sin sucesor.
    const retiradas = await db.precioCierre.findMany({ where: { instrumentoId: id, reemplazadoEn: { not: null } }, orderBy: { fecha: "asc" } });
    expect(retiradas.map((p) => p.fecha.toISOString().slice(0, 10))).toEqual(["2024-03-27", "2024-03-28", "2024-03-29"]);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(5);
    // Repetir no retira nada más.
    const otra = await actualizarPrecios(db, { desde: utc("2024-03-26"), hasta: utc("2024-04-01"), buscar: yahoo(SEMANA), instrumentoIds: [id], ahora: DESPUES });
    expect(otra).toMatchObject({ cierresNuevos: 0, cierresRetirados: 0 });
  });

  it("un año que calendario_bvc no cubre: la barra de un día entre semana no se guarda y se reporta", async () => {
    expect(await db.calendarioBvc.count({ where: { dia: { gte: utc("2019-01-01"), lt: utc("2020-01-01") } } })).toBe(0);
    const id = await especie("C");
    const r = await actualizarPrecios(db, { desde: utc("2019-03-12"), hasta: utc("2019-03-12"), buscar: yahoo([{ dia: "2019-03-12", close: 90, volume: 700 }]), instrumentoIds: [id], ahora: DESPUES });
    expect(await vigentes(id)).toEqual([]);
    expect(r).toMatchObject({ cierresNuevos: 0, omitidasSinCalendario: 1 });
  });
});

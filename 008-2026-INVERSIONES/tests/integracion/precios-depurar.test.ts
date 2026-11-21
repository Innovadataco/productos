// precios:depurar (SPEC-13) contra la base de PRUEBAS con un Yahoo falso (sin red): cierres vigentes ya
// guardados de días no hábiles o sin negociación. Ensayo por defecto; --aplicar exige el nombre de la base.
// Usa los festivos públicos sembrados (Jueves y Viernes Santo de 2024). Especies, precios y volúmenes inventados.
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { depurarPrecios } from "@/precios/depurar";
import type { Buscar } from "@/precios/yahoo";

const db = new PrismaClient();
const corrida = Date.now().toString(36).toUpperCase().slice(-5);
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ts = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 14, 30) / 1000;
const DESPUES = new Date("2024-04-10T20:00:00Z");
const DESDE = utc("2024-03-26");
const HASTA = utc("2024-04-01");
let base = "";

interface Barra { readonly dia: string; readonly close: number; readonly volume: number | null }
const yahoo = (barras: readonly Barra[]): Buscar => async () =>
  new Response(JSON.stringify({
    chart: { result: [{ meta: { currency: "COP" }, timestamp: barras.map((b) => ts(b.dia)), indicators: { quote: [{ close: barras.map((b) => b.close), volume: barras.map((b) => b.volume) }] } }] },
  }));
const SEMANA: Barra[] = [
  { dia: "2024-03-26", close: 100, volume: 1500 },
  { dia: "2024-03-27", close: 100, volume: 0 }, // hábil sin negociación
  { dia: "2024-03-28", close: 100, volume: 0 }, // festivo
  { dia: "2024-04-01", close: 101, volume: null }, // hábil, volumen null
];

/** Especie con los cierres que dejó el código anterior: 26 (bien), 27 (sin negociación), 28 y 29 (festivos), 1-abr (bien). */
async function especieConHistoria(sufijo: string): Promise<string> {
  const id = (await db.instrumento.create({ data: { tipo: "ACCION", nemotecnico: `PD${sufijo}${corrida}`, nombre: "Ficticia D" } })).id;
  for (const [dia, precio] of [["2024-03-26", 100], ["2024-03-27", 100], ["2024-03-28", 100], ["2024-03-29", 100], ["2024-04-01", 101]] as const) {
    await db.precioCierre.create({ data: { instrumentoId: id, fecha: utc(dia), precio: new Prisma.Decimal(precio), fuente: "yahoo", estado: "NO_VERIFICADO" } });
  }
  return id;
}
const vigentes = async (id: string) => (await db.precioCierre.findMany({ where: { instrumentoId: id, reemplazadoEn: null }, orderBy: { fecha: "asc" } })).map((p) => p.fecha.toISOString().slice(0, 10));
const opciones = (id: string, extra: { aplicar?: boolean; base?: string; buscar?: Buscar } = {}) => ({
  desde: DESDE, hasta: HASTA, buscar: extra.buscar ?? yahoo(SEMANA), instrumentoIds: [id], ahora: DESPUES, aplicar: extra.aplicar ?? false, base: extra.base,
});

beforeAll(async () => {
  base = (await db.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`)[0]?.db ?? "";
  if (!base.endsWith("_test")) throw new Error(`Se negó a correr sobre «${base}»`);
});

afterAll(async () => {
  await db.$disconnect();
});

describe("depurarPrecios", () => {
  it("ensayo: cuenta lo que sobra y los supuestos de volumen, sin escribir nada", async () => {
    const id = await especieConHistoria("A");
    const r = await depurarPrecios(db, opciones(id));
    expect(r).toMatchObject({
      base, aplicado: false, especies: 1, vigentesRevisados: 5, aRetirarNoHabil: 2, aRetirarSinNegociacion: 1, retirados: 0, cambiadosPorOtro: 0,
      sinCalendario: 0, aunNoDefinitivos: 0, diagnostico: { barras: 4, sinNegociacionConCierreDistinto: 0, habilesConVolumenNull: 1 }, fallidas: [],
    });
    expect(await vigentes(id)).toEqual(["2024-03-26", "2024-03-27", "2024-03-28", "2024-03-29", "2024-04-01"]);
  });

  it("--aplicar con otra base se niega (BASE_NO_COINCIDE) y no escribe", async () => {
    const id = await especieConHistoria("B");
    await expect(depurarPrecios(db, opciones(id, { aplicar: true, base: "otra_base" }))).rejects.toMatchObject({ name: "ErrorDepuracion", codigo: "BASE_NO_COINCIDE" });
    expect(await vigentes(id)).toHaveLength(5);
  });

  it("--aplicar retira (reemplazadoEn, sin sucesor; nada se borra) y la segunda corrida da 0", async () => {
    const id = await especieConHistoria("C");
    const r = await depurarPrecios(db, opciones(id, { aplicar: true, base }));
    expect(r).toMatchObject({ aplicado: true, aRetirarNoHabil: 2, aRetirarSinNegociacion: 1, retirados: 3, cambiadosPorOtro: 0 });
    expect(await vigentes(id)).toEqual(["2024-03-26", "2024-04-01"]);
    expect(await db.precioCierre.count({ where: { instrumentoId: id } })).toBe(5);
    const otra = await depurarPrecios(db, opciones(id, { aplicar: true, base }));
    expect(otra).toMatchObject({ vigentesRevisados: 2, aRetirarNoHabil: 0, aRetirarSinNegociacion: 0, retirados: 0 });
  });

  it("si Yahoo falla para la especie: retira igual los días no hábiles, no toca los hábiles y reporta el código", async () => {
    const id = await especieConHistoria("E");
    const caido: Buscar = async () => new Response("{}", { status: 503 });
    const r = await depurarPrecios(db, opciones(id, { aplicar: true, base, buscar: caido }));
    expect(r).toMatchObject({ aRetirarNoHabil: 2, aRetirarSinNegociacion: 0, retirados: 2, fallidas: [{ instrumentoId: id, codigo: "YAHOO_HTTP_503" }] });
    expect(await vigentes(id)).toEqual(["2024-03-26", "2024-03-27", "2024-04-01"]);
  });

  it("no toca cierres de otra fuente ni ya reemplazados", async () => {
    const id = await especieConHistoria("F");
    await db.precioCierre.create({ data: { instrumentoId: id, fecha: utc("2024-03-28"), precio: new Prisma.Decimal(100), fuente: "otra-ficticia", estado: "NO_VERIFICADO" } });
    const r = await depurarPrecios(db, opciones(id, { aplicar: true, base }));
    expect(r).toMatchObject({ vigentesRevisados: 5, retirados: 3 });
    expect(await db.precioCierre.count({ where: { instrumentoId: id, fuente: "otra-ficticia", reemplazadoEn: null } })).toBe(1);
  });
});
